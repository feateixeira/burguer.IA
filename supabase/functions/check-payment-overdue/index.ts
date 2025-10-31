import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing environment variables')
    }

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    // Verificar e atualizar status de pagamentos atrasados
    const { data: overdueProfiles, error: updateError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, full_name, next_payment_date')
      .eq('subscription_type', 'monthly')
      .eq('payment_status', 'pending')
      .lt('next_payment_date', new Date().toISOString())

    if (updateError) {
      throw new Error(`Erro ao buscar perfis atrasados: ${updateError.message}`)
    }

    // Atualizar status para 'overdue'
    if (overdueProfiles && overdueProfiles.length > 0) {
      const userIds = overdueProfiles.map(p => p.user_id)
      
      await supabaseAdmin
        .from('profiles')
        .update({ payment_status: 'overdue' })
        .in('user_id', userIds)

      // Buscar estabelecimentos para os usuários
      const { data: establishmentsData } = await supabaseAdmin
        .from('profiles')
        .select('user_id, establishment_id')
        .in('user_id', userIds)

      // Verificar se já passou do dia 08 do mês seguinte ao vencimento
      const today = new Date()
      const todayDay = today.getDate()
      const todayMonth = today.getMonth()
      const todayYear = today.getFullYear()

      // Enviar notificações apenas se já passou do dia 08 do mês seguinte
      const profilesToNotify = overdueProfiles.filter(profile => {
        if (!profile.next_payment_date) return false
        const paymentDate = new Date(profile.next_payment_date)
        const paymentMonth = paymentDate.getMonth()
        const paymentYear = paymentDate.getFullYear()
        
        // Calcular dia 08 do mês seguinte ao vencimento
        const nextMonth = new Date(paymentYear, paymentMonth + 1, 8)
        
        // Notificar apenas se hoje já passou do dia 08 do mês seguinte
        return today >= nextMonth
      })

      // Enviar notificações para usuários atrasados
      if (profilesToNotify.length > 0) {
        const notifications = profilesToNotify.map(profile => ({
          user_id: profile.user_id,
          title: '⚠️ Mensalidade Atrasada',
          message: `Sua mensalidade está atrasada. Por favor, entre em contato para regularizar seu pagamento.`,
          type: 'payment',
          created_by: null // Sistema
        }))

        await supabaseAdmin
          .from('user_notifications')
          .insert(notifications)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: `Verificação concluída. ${profilesToNotify.length} notificações enviadas.`,
          overdue: overdueProfiles.length,
          notified: profilesToNotify.length
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Verificar testes que expiraram e bloquear usuários
    const { data: expiredTrials, error: trialError } = await supabaseAdmin
      .from('profiles')
      .select('user_id, trial_end_date')
      .eq('subscription_type', 'trial')
      .not('trial_end_date', 'is', null)
      .lt('trial_end_date', new Date().toISOString())
      .eq('status', 'active')

    if (trialError) {
      console.error('Erro ao buscar testes expirados:', trialError)
    } else if (expiredTrials && expiredTrials.length > 0) {
      const expiredUserIds = expiredTrials.map(p => p.user_id)
      
      // Bloquear usuários com teste expirado
      await supabaseAdmin
        .from('profiles')
        .update({ status: 'blocked' })
        .in('user_id', expiredUserIds)

      // Enviar notificação antes de bloquear
      const trialNotifications = expiredTrials.map(profile => ({
        user_id: profile.user_id,
        title: '⏰ Período de Teste Expirado',
        message: 'Seu período de teste expirou. Entre em contato para converter para assinatura mensal.',
        type: 'warning',
        created_by: null
      }))

      await supabaseAdmin
        .from('user_notifications')
        .insert(trialNotifications)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Verificação concluída',
        overdue: overdueProfiles?.length || 0,
        expiredTrials: expiredTrials?.length || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('Error in check-payment-overdue function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

