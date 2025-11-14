import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const VERCEL_REVALIDATE_SECRET = Deno.env.get('VERCEL_REVALIDATE_SECRET');
    const VERCEL_REVALIDATE_URL = Deno.env.get('VERCEL_REVALIDATE_URL');

    if (!VERCEL_REVALIDATE_SECRET || !VERCEL_REVALIDATE_URL) {
      console.warn('Vercel revalidation not configured. Set VERCEL_REVALIDATE_SECRET and VERCEL_REVALIDATE_URL environment variables.');
      return new Response(
        JSON.stringify({ success: false, message: 'Revalidation not configured' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { paths } = body;

    if (!paths || !Array.isArray(paths) || paths.length === 0) {
      return new Response(
        JSON.stringify({ error: 'paths array is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Revalidate all paths
    const revalidatePromises = paths.map(async (path: string) => {
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
              return { path, success: true };
            }
          }
          
          return { path, success: false, error: errorText };
        } else {
          console.log(`✅ Successfully revalidated ${path}`);
          return { path, success: true };
        }
      } catch (error) {
        console.error(`Error revalidating ${path}:`, error);
        return { path, success: false, error: error.message };
      }
    });

    const results = await Promise.all(revalidatePromises);
    const successCount = results.filter(r => r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        revalidated: successCount,
        total: paths.length,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in revalidate-cache function:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

