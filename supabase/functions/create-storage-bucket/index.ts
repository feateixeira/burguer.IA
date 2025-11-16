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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verificar se o bucket já existe
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      throw listError
    }

    const bucketExists = buckets?.some(b => b.name === 'establishments')
    
    if (bucketExists) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Bucket já existe',
          bucket: 'establishments'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      )
    }

    // Criar o bucket
    const { data: bucket, error: createError } = await supabaseAdmin.storage.createBucket('establishments', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: ['image/*']
    })

    if (createError) {
      console.error('Error creating bucket:', createError)
      throw createError
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Bucket criado com sucesso',
        bucket: bucket
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )
  } catch (error: any) {
    console.error('Error in create-storage-bucket:', error)
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Erro ao criar bucket' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})

