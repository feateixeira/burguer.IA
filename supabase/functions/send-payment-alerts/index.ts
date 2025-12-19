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
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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

    // Verificar se é dia 05 (opcional - pode ser chamado manualmente)
    const today = new Date()
    const todayDay = today.getDate()
    
    // Chamar função SQL que envia os alertas
    const { data, error } = await supabaseAdmin.rpc('cron_send_payment_alerts')

    if (error) {
      console.error('Error sending payment alerts:', error)
      throw error
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment alerts sent successfully',
        day: todayDay,
        is_day_5: todayDay === 5
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('Error in send-payment-alerts function:', error)
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


