import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const VERCEL_REVALIDATE_SECRET = Deno.env.get('VERCEL_REVALIDATE_SECRET');
    const VERCEL_REVALIDATE_URL = Deno.env.get('VERCEL_REVALIDATE_URL');

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Configuração do Supabase não encontrada');
    }

    // Use service role to bypass RLS
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get authentication token from request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user session
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authentication' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    let body;
    try {
      body = await req.json();
    } catch (parseError) {
      console.error('Error parsing request body:', parseError);
      return new Response(
        JSON.stringify({ error: 'Corpo da requisição inválido. Verifique se os dados estão em formato JSON válido.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { productId, productData, isUpdate } = body;

    if (!productData) {
      return new Response(
        JSON.stringify({ error: 'productData é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result;
    let establishmentId: string | null = null;

    // Validate required fields
    if (!productData.name || productData.name.trim() === '') {
      return new Response(
        JSON.stringify({ error: 'Nome do produto é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (productData.price === undefined || productData.price === null || isNaN(productData.price)) {
      return new Response(
        JSON.stringify({ error: 'Preço do produto é obrigatório e deve ser um número válido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Perform update or insert
    if (isUpdate && productId) {
      // Update existing product
      const { data: existingProduct, error: fetchError } = await supabase
        .from('products')
        .select('establishment_id')
        .eq('id', productId)
        .single();

      if (fetchError) {
        console.error('Error fetching existing product:', fetchError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar produto: ' + fetchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!existingProduct) {
        return new Response(
          JSON.stringify({ error: 'Produto não encontrado' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      establishmentId = existingProduct.establishment_id;

      const { data, error } = await supabase
        .from('products')
        .update(productData)
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        console.error('Error updating product:', error);
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao atualizar produto: ' + (error.message || 'Erro desconhecido'),
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = data;
    } else {
      // Insert new product
      if (!productData.establishment_id) {
        return new Response(
          JSON.stringify({ error: 'establishment_id é obrigatório para novos produtos' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      establishmentId = productData.establishment_id;

      // Validate establishment exists
      const { data: establishment, error: estError } = await supabase
        .from('establishments')
        .select('id')
        .eq('id', establishmentId)
        .single();

      if (estError || !establishment) {
        return new Response(
          JSON.stringify({ error: 'Estabelecimento não encontrado ou inválido' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Validate category if provided
      if (productData.category_id) {
        const { data: category, error: catError } = await supabase
          .from('categories')
          .select('id')
          .eq('id', productData.category_id)
          .single();

        if (catError || !category) {
          return new Response(
            JSON.stringify({ error: 'Categoria não encontrada ou inválida' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      const { data, error } = await supabase
        .from('products')
        .insert(productData)
        .select()
        .single();

      if (error) {
        console.error('Error inserting product:', error);
        console.error('Product data:', JSON.stringify(productData, null, 2));
        return new Response(
          JSON.stringify({ 
            error: 'Erro ao criar produto: ' + (error.message || 'Erro desconhecido'),
            details: error.details || null,
            hint: error.hint || null,
            code: error.code || null
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      result = data;
    }

    // Get establishment slug for revalidation
    let establishmentSlug: string | null = null;
    if (establishmentId) {
      const { data: establishment } = await supabase
        .from('establishments')
        .select('slug')
        .eq('id', establishmentId)
        .single();

      if (establishment) {
        establishmentSlug = establishment.slug;
      }
    }

    // On-Demand Revalidation: Invalidate cache for relevant routes
    // This uses Vercel's On-Demand Revalidation API
    if (VERCEL_REVALIDATE_SECRET && VERCEL_REVALIDATE_URL) {
      try {
        // Revalidate /dashboard/produtos (admin page)
        const revalidatePaths = [
          '/dashboard/produtos',
        ];

        // If we have establishment slug, also revalidate public menu page
        if (establishmentSlug) {
          revalidatePaths.push(`/cardapio/${establishmentSlug}`);
        }

        // Call Vercel On-Demand Revalidation API
        // For Next.js projects: use /api/revalidate endpoint
        // For other projects on Vercel: use the webhook URL configured in Vercel dashboard
        const revalidatePromises = revalidatePaths.map(async (path) => {
          try {
            // Try Next.js revalidation format first
            const revalidateUrl = VERCEL_REVALIDATE_URL.endsWith('/api/revalidate')
              ? VERCEL_REVALIDATE_URL
              : `${VERCEL_REVALIDATE_URL}/api/revalidate`;

            const revalidateResponse = await fetch(revalidateUrl, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${VERCEL_REVALIDATE_SECRET}`,
              },
              body: JSON.stringify({
                path,
                secret: VERCEL_REVALIDATE_SECRET,
              }),
            });

            if (!revalidateResponse.ok) {
              const errorText = await revalidateResponse.text();
              console.error(`Failed to revalidate ${path}:`, errorText);
              
              // Fallback: try as webhook if revalidation endpoint fails
              if (VERCEL_REVALIDATE_URL.includes('webhook')) {
                const webhookResponse = await fetch(VERCEL_REVALIDATE_URL, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    paths: [path],
                    revalidate: true,
                  }),
                });

                if (webhookResponse.ok) {
                  console.log(`✅ Successfully revalidated ${path} via webhook`);
                }
              }
            } else {
              console.log(`✅ Successfully revalidated ${path}`);
            }
          } catch (error) {
            console.error(`Error revalidating ${path}:`, error);
          }
        });

        await Promise.all(revalidatePromises);
      } catch (revalidateError) {
        // Log but don't fail the request if revalidation fails
        console.error('Revalidation error (non-critical):', revalidateError);
      }
    } else {
      console.warn('Vercel revalidation not configured. Set VERCEL_REVALIDATE_SECRET and VERCEL_REVALIDATE_URL environment variables.');
    }

    return new Response(
      JSON.stringify({ success: true, data: result }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in update-product function:', error);
    console.error('Error stack:', error.stack);
    console.error('Error details:', JSON.stringify(error, null, 2));
    
    const errorMessage = error?.message || error?.toString() || 'Erro interno do servidor';
    const statusCode = error?.status || error?.statusCode || 500;
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error?.details || null,
        hint: error?.hint || null,
        code: error?.code || null
      }),
      { status: statusCode, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

