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
    // No Supabase Edge Functions, tentar diferentes formas de obter as variáveis
    // Listar todas as variáveis disponíveis para debug
    const allEnvVars = Deno.env.toObject()
    const allKeys = Object.keys(allEnvVars)
    
    console.log('=== ENVIRONMENT DEBUG START ===')
    console.log('All env var keys:', allKeys)
    console.log('SUPABASE keys:', allKeys.filter(k => k.includes('SUPABASE')))
    console.log('KEY keys:', allKeys.filter(k => k.includes('KEY')))
    
    // Tentar obter a URL de diferentes formas
    // No Supabase, algumas variáveis são injetadas automaticamente
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 
                       Deno.env.get('SUPABASE_SERVICE_URL') ||
                       (Deno.env.get('SUPABASE_PROJECT_REF') ? 
                         `https://${Deno.env.get('SUPABASE_PROJECT_REF')}.supabase.co` : null)
    
    if (!supabaseUrl) {
      throw new Error('SUPABASE_URL or SUPABASE_PROJECT_REF must be configured as an environment variable')
    }
    
    // Tentar obter a service role key - Supabase não permite prefixo SUPABASE_ em secrets
    // Então devemos usar SERVICE_ROLE_KEY
    const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ||
                              Deno.env.get('SERVICE_ROLE_SECRET') ||
                              Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || // Fallback caso esteja configurada
                              Deno.env.get('SUPABASE_SERVICE_KEY')
    
    // Logs de debug detalhados
    console.log('Environment check results:', {
      hasUrl: !!supabaseUrl,
      url: supabaseUrl,
      hasServiceKey: !!supabaseServiceKey,
      serviceKeyLength: supabaseServiceKey?.length || 0,
      serviceKeyFirstChars: supabaseServiceKey?.substring(0, 20) || 'none',
      checkingKeys: {
        SERVICE_ROLE_KEY: !!Deno.env.get('SERVICE_ROLE_KEY'),
        SERVICE_ROLE_SECRET: !!Deno.env.get('SERVICE_ROLE_SECRET'),
        SUPABASE_SERVICE_ROLE_KEY: !!Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),
        SUPABASE_SERVICE_KEY: !!Deno.env.get('SUPABASE_SERVICE_KEY')
      }
    })
    console.log('=== ENVIRONMENT DEBUG END ===')
    
    if (!supabaseUrl) {
      console.error('ERROR: Missing SUPABASE_URL')
      console.error('Available SUPABASE env vars:', allKeys.filter(k => k.includes('SUPABASE')))
      throw new Error('Configuração do servidor incompleta: SUPABASE_URL não encontrada. Configure a URL do projeto na Edge Function.')
    }
    
    if (!supabaseServiceKey) {
      console.error('ERROR: Missing SERVICE_ROLE_KEY')
      console.error('Available env vars with "KEY":', allKeys.filter(k => k.includes('KEY')))
      console.error('Available env vars with "SERVICE":', allKeys.filter(k => k.includes('SERVICE')))
      console.error('All available keys:', allKeys)
      throw new Error('Configuração do servidor incompleta: SERVICE_ROLE_KEY não encontrada. Verifique se você adicionou o secret "SERVICE_ROLE_KEY" (sem prefixo SUPABASE_) em Edge Functions → create-user → Settings → Secrets.')
    }
    
    // Verificar se a key parece válida (JWT geralmente tem ~200+ caracteres)
    if (supabaseServiceKey.length < 50) {
      console.error('ERROR: Service key too short:', supabaseServiceKey.length, 'characters')
      throw new Error('A SERVICE_ROLE_KEY configurada parece estar incorreta (muito curta: ' + supabaseServiceKey.length + ' caracteres). Verifique se o valor completo da service_role key foi copiado (deve ter ~200+ caracteres).')
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

    const { email, password, name, establishmentName, subscriptionType, planType, trialDays, trialEndDate, nextPaymentDate } = await req.json()
    
    // Validate required fields
    if (!email || !password) {
      throw new Error('Email and password are required')
    }
    
    if (!email.includes('@')) {
      throw new Error('Invalid email format')
    }
    
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters')
    }

    // Verify that the request is from an admin user
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header is required')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Invalid authentication')
    }

    // Check if the user is an admin
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', user.id)
      .single()

    if (!profile?.is_admin) {
      throw new Error('Access denied. Admin privileges required.')
    }

    // Create the new user
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        establishment_name: establishmentName
      }
    })

    if (createError) {
      console.error('Error creating user in auth:', createError)
      throw createError
    }

    if (!newUser.user) {
      throw new Error('User creation succeeded but no user data returned')
    }

    // Create or get establishment
    let establishmentId: string | null = null
    
    // Sempre cria um estabelecimento, mesmo se não fornecido um nome
    const finalEstablishmentName = establishmentName || email.split('@')[0] || `Estabelecimento ${newUser.user.id.substring(0, 8)}`
    
    try {
      // Check if establishment exists (using service role bypasses RLS)
      const { data: existingEstab, error: selectError } = await supabaseAdmin
        .from('establishments')
        .select('id')
        .eq('name', finalEstablishmentName)
        .maybeSingle()

      if (selectError && selectError.code !== 'PGRST116') {
        console.error('Error checking establishment:', selectError)
        throw new Error(`Failed to check establishment: ${selectError.message}`)
      }

      if (existingEstab) {
        establishmentId = existingEstab.id
      } else {
        // Create new establishment
        const { data: newEstablishment, error: estabError } = await supabaseAdmin
          .from('establishments')
          .insert({
            name: finalEstablishmentName,
            slug: finalEstablishmentName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '').substring(0, 50)
          })
          .select('id')
          .single()

        if (estabError) {
          console.error('Error creating establishment:', estabError)
          throw new Error(`Failed to create establishment: ${estabError.message || estabError.code}`)
        }
        
        if (!newEstablishment?.id) {
          throw new Error('Establishment created but no ID returned')
        }
        
        establishmentId = newEstablishment.id
      }
    } catch (estabErr: any) {
      console.error('Establishment creation/check failed:', estabErr)
      throw estabErr
    }

    // Create profile for the new user (using service role bypasses RLS)
    try {
      const profileData: any = {
        user_id: newUser.user.id,
        full_name: name || email,
        status: 'active',
        establishment_id: establishmentId,
        subscription_type: subscriptionType || 'trial',
        payment_status: subscriptionType === 'monthly' ? 'pending' : null
      }

      // Adicionar campos de assinatura baseado no tipo
      if (subscriptionType === 'trial' && trialEndDate) {
        profileData.trial_end_date = trialEndDate
      } else if (subscriptionType === 'monthly') {
        if (nextPaymentDate) {
          profileData.next_payment_date = nextPaymentDate
        }
        profileData.payment_status = 'pending'
        
        // Adicionar tipo de plano e valor
        if (planType === 'prata' || planType === 'gold') {
          profileData.plan_type = planType
          profileData.plan_amount = planType === 'prata' ? 180.00 : 230.00
        }
      }

      const { error: profileError } = await supabaseAdmin
        .from('profiles')
        .insert(profileData)

      if (profileError) {
        console.error('Error creating profile:', profileError)
        // Check if it's a unique/duplicate error (profile might already exist via trigger)
        const isDuplicateError = 
          profileError.code === '23505' || // Unique violation
          profileError.message?.includes('duplicate') ||
          profileError.message?.includes('unique constraint')
        
        if (!isDuplicateError) {
          throw new Error(`Failed to create profile: ${profileError.message || profileError.code}`)
        } else {
          console.log('Profile already exists (likely created by trigger), continuing...')
        }
      } else {
        console.log('Profile created successfully')
      }
    } catch (profileErr: any) {
      console.error('Profile creation failed:', profileErr)
      throw profileErr
    }

    console.log(`Admin ${user.email} created user ${email} with profile`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Error in create-user function:', error)
    console.error('Error stack:', error.stack)
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      code: error.code,
      status: error.status,
      cause: error.cause
    })
    
    // Mensagem de erro mais amigável
    let errorMessage = error.message || 'Erro inesperado ao criar usuário';
    
    // Mensagens específicas para erros comuns
    if (error.message?.includes('Missing') || error.message?.includes('SERVICE_ROLE_KEY')) {
      errorMessage = 'Configuração do servidor incompleta. Verifique se SERVICE_ROLE_KEY está configurada nos Secrets da Edge Function.';
    } else if (error.message?.includes('Invalid authentication')) {
      errorMessage = 'Autenticação inválida. Faça login novamente.';
    } else if (error.message?.includes('Access denied') || error.message?.includes('Admin privileges')) {
      errorMessage = 'Acesso negado. Apenas administradores podem criar usuários.';
    } else if (error.message?.includes('already registered') || error.message?.includes('already exists') || error.message?.includes('User already registered')) {
      errorMessage = 'Este email já está cadastrado no sistema.';
    } else if (error.code === '23505') {
      errorMessage = 'Este email já está cadastrado no sistema.';
    } else if (error.message?.includes('password')) {
      errorMessage = 'Erro na senha: ' + error.message;
    }
    
    // Return appropriate status code
    const statusCode = error.status || error.code === 'PGRST116' ? 404 : 
                        error.code === '23505' ? 409 : // Unique violation
                        error.code === '23503' ? 400 : // Foreign key violation
                        500
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
        // Incluir código de erro para debug (apenas em desenvolvimento)
        ...(process.env.DENO_ENV !== 'production' ? { debug: error.message, code: error.code } : {})
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: statusCode,
      }
    )
  }
})
