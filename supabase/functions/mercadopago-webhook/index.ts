import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credenciais do Mercado Pago
const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || 
  'APP_USR-1420249389711899-121909-c07b8fc1940242b66013075f5383a488-208727634'

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: {
        ...corsHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
      },
      status: 200 
    })
  }

  try {
    // Obter Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
                       Deno.env.get('SUPABASE_SERVICE_URL') ||
                       (Deno.env.get('SUPABASE_PROJECT_REF') ? 
                         `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.supabase.co` : null)
    
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL must be configured')
    }

    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ||
                              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    
    if (!supabaseServiceKey) {
      throw new Error('SERVICE_ROLE_KEY must be configured')
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    // Obter dados do webhook
    const webhookData = await req.json()
    console.log('Mercado Pago Webhook received:', JSON.stringify(webhookData, null, 2))

    // Verificar tipo de notificação
    const type = webhookData.type
    const data = webhookData.data

    if (type === 'payment') {
      // Obter informações do pagamento
      const paymentId = data.id
      
      const mpResponse = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
        }
      })

      if (!mpResponse.ok) {
        throw new Error(`Failed to fetch payment ${paymentId} from Mercado Pago`)
      }

      const payment = await mpResponse.json()
      
      // Obter user_id do external_reference ou metadata
      const userId = payment.external_reference || payment.metadata?.user_id
      
      if (!userId) {
        console.error('No user_id found in payment data')
        return new Response(
          JSON.stringify({ error: 'No user_id found in payment' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Salvar/atualizar pagamento no banco
      const { error: paymentError } = await supabaseAdmin
        .from('mercadopago_payments')
        .upsert({
          user_id: userId,
          mercadopago_payment_id: payment.id.toString(),
          mercadopago_subscription_id: payment.subscription_id?.toString() || null,
          status: payment.status === 'approved' ? 'approved' : 
                  payment.status === 'rejected' ? 'rejected' : 
                  payment.status === 'cancelled' ? 'cancelled' : 'pending',
          payment_type: payment.payment_type_id,
          payment_method_id: payment.payment_method_id,
          transaction_amount: payment.transaction_amount,
          currency_id: payment.currency_id || 'BRL',
          description: payment.description,
          external_reference: payment.external_reference,
          date_created: payment.date_created,
          date_approved: payment.date_approved,
          date_last_updated: payment.date_last_updated,
          webhook_data: webhookData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'mercadopago_payment_id'
        })

      if (paymentError) {
        console.error('Error saving payment:', paymentError)
      }

      // Se pagamento foi aprovado, atualizar perfil
      if (payment.status === 'approved') {
        // Calcular próxima data de pagamento (dia 05 do próximo mês)
        const nextMonth = new Date()
        nextMonth.setMonth(nextMonth.getMonth() + 1)
        nextMonth.setDate(5)
        
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            payment_status: 'paid',
            last_payment_date: new Date().toISOString(),
            next_payment_date: nextMonth.toISOString(),
            mercadopago_payment_id: payment.id.toString(),
            mercadopago_status: 'authorized',
            mercadopago_last_webhook_date: new Date().toISOString()
          })
          .eq('user_id', userId)

        if (profileError) {
          console.error('Error updating profile:', profileError)
        }

        // Criar notificação para o usuário
        await supabaseAdmin
          .from('user_notifications')
          .insert({
            user_id: userId,
            title: '✅ Pagamento Aprovado',
            message: `Seu pagamento de R$ ${payment.transaction_amount.toFixed(2)} foi aprovado com sucesso!`,
            type: 'payment',
            created_by: null
          })
      } else if (payment.status === 'rejected') {
        // Criar notificação de pagamento rejeitado
        await supabaseAdmin
          .from('user_notifications')
          .insert({
            user_id: userId,
            title: '❌ Pagamento Rejeitado',
            message: `Seu pagamento foi rejeitado. Por favor, tente novamente ou entre em contato com o suporte.`,
            type: 'payment',
            created_by: null
          })

        // Atualizar status do perfil
        await supabaseAdmin
          .from('profiles')
          .update({
            payment_status: 'pending',
            mercadopago_status: 'pending',
            mercadopago_last_webhook_date: new Date().toISOString()
          })
          .eq('user_id', userId)
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Error processing Mercado Pago webhook:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Internal server error',
        details: error.toString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})


