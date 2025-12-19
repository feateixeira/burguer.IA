import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Credenciais do Mercado Pago (devem ser configuradas como secrets no Supabase)
const MERCADOPAGO_ACCESS_TOKEN = Deno.env.get('MERCADOPAGO_ACCESS_TOKEN') || 
  'APP_USR-1420249389711899-121909-c07b8fc1940242b66013075f5383a488-208727634'
const MERCADOPAGO_PUBLIC_KEY = Deno.env.get('MERCADOPAGO_PUBLIC_KEY') || 
  'APP_USR-66642fb9-8e7e-4445-9f2e-a7f8f0e2e315'

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

    // Verificar autenticação do usuário
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter dados do request
    const { plan_type } = await req.json()
    
    if (!plan_type || !['gold', 'platinum', 'premium'].includes(plan_type)) {
      return new Response(
        JSON.stringify({ error: 'Invalid plan_type. Must be gold, platinum, or premium' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Obter perfil do usuário
    const { data: profileSimple, error: profileSimpleError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (profileSimpleError || !profileSimple) {
      return new Response(
        JSON.stringify({ 
          error: 'Profile not found',
          details: 'User profile does not exist. Please contact support.'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Buscar estabelecimento se tiver establishment_id
    let profile = profileSimple
    if (profileSimple.establishment_id) {
      const { data: establishment } = await supabaseAdmin
        .from('establishments')
        .select('*')
        .eq('id', profileSimple.establishment_id)
        .single()
      
      if (establishment) {
        profile = { ...profileSimple, establishments: establishment }
      } else {
        profile = { ...profileSimple, establishments: null }
      }
    } else {
      profile = { ...profileSimple, establishments: null }
    }

    // Calcular valores do plano
    const planAmounts: Record<string, number> = {
      gold: 160.00,
      platinum: 180.00,
      premium: 220.00
    }

    const amount = planAmounts[plan_type]
    const planNames: Record<string, string> = {
      gold: 'Standard',
      platinum: 'Gold',
      premium: 'Premium'
    }

    // Obter URL base para callbacks
    const baseUrl = supabaseUrl.replace('/rest/v1', '').replace('/functions/v1', '')

    // Criar preferência de pagamento no Mercado Pago
    const preferenceData = {
      items: [
        {
          title: `Assinatura Mensal - Plano ${planNames[plan_type]}`,
          description: `Assinatura mensal do plano ${planNames[plan_type]} - Burguer.IA`,
          quantity: 1,
          unit_price: amount,
          currency_id: 'BRL'
        }
      ],
      payer: {
        name: profile.full_name || user.email?.split('@')[0] || 'Cliente',
        email: user.email || '',
      },
      back_urls: {
        success: `${baseUrl}/payment/success`,
        failure: `${baseUrl}/payment/failure`,
        pending: `${baseUrl}/payment/pending`
      },
      auto_return: 'approved',
      external_reference: user.id,
      notification_url: `${baseUrl}/functions/v1/mercadopago-webhook`,
      statement_descriptor: 'BURGUER.IA',
      // Configurar métodos de pagamento - PIX será priorizado
      payment_methods: {
        excluded_payment_types: [],
        excluded_payment_methods: [],
        installments: 1
      },
      metadata: {
        user_id: user.id,
        plan_type: plan_type,
        establishment_id: profile.establishment_id
      }
    }

    // Criar preferência no Mercado Pago
    const mpResponse = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${MERCADOPAGO_ACCESS_TOKEN}`
      },
      body: JSON.stringify(preferenceData)
    })

    if (!mpResponse.ok) {
      const errorData = await mpResponse.text()
      console.error('Mercado Pago API Error:', mpResponse.status, errorData)
      throw new Error(`Mercado Pago API error: ${mpResponse.status} - ${errorData}`)
    }

    const preference = await mpResponse.json()

    // Verificar se init_point existe
    if (!preference.init_point && !preference.sandbox_init_point) {
      console.error('No init_point in Mercado Pago response')
      throw new Error('Mercado Pago não retornou link de pagamento')
    }

    // Usar init_point ou sandbox_init_point
    const initPoint = preference.init_point || preference.sandbox_init_point
    
    // Nota: O Mercado Pago não permite abrir direto no PIX via parâmetro na URL do init_point.
    // No entanto, com a configuração de payment_methods acima, o PIX aparecerá como uma das
    // primeiras opções no checkout. O cliente verá o PIX destacado entre as opções disponíveis.

    // Calcular próxima data de pagamento (dia 05 do próximo mês)
    const nextMonth = new Date()
    nextMonth.setMonth(nextMonth.getMonth() + 1)
    nextMonth.setDate(5)
    nextMonth.setHours(0, 0, 0, 0)

    // Atualizar perfil com dados do Mercado Pago
    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        plan_type: plan_type,
        plan_amount: amount,
        subscription_type: 'monthly',
        payment_status: 'pending',
        mercadopago_init_point: initPoint,
        mercadopago_status: 'pending',
        next_payment_date: nextMonth.toISOString()
      })
      .eq('user_id', user.id)

    if (updateError) {
      console.error('Error updating profile:', updateError)
      throw updateError
    }

    return new Response(
      JSON.stringify({
        success: true,
        init_point: initPoint,
        preference_id: preference.id,
        public_key: MERCADOPAGO_PUBLIC_KEY
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Error creating Mercado Pago subscription:', error)
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
