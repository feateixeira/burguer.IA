import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';
import * as bcrypt from "https://deno.land/x/bcrypt@v0.2.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { password } = await req.json();

    // Validate password is 4 digits
    if (!/^\d{4}$/.test(password)) {
      return new Response(
        JSON.stringify({ error: 'Password must be exactly 4 digits' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's establishment_id
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('establishment_id')
      .eq('user_id', user.id)
      .single();

    if (profileError || !profile?.establishment_id) {
      return new Response(
        JSON.stringify({ error: 'Establishment not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get admin password hash from establishment (server-side only, never exposed to client)
    const { data: establishment, error: establishmentError } = await supabaseClient
      .from('establishments')
      .select('admin_password_hash, settings')
      .eq('id', profile.establishment_id)
      .single();

    if (establishmentError || !establishment) {
      return new Response(
        JSON.stringify({ error: 'Establishment settings not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If no password is configured, deny access (security: require explicit setup)
    if (!establishment.admin_password_hash) {
      return new Response(
        JSON.stringify({ valid: false, error: 'Admin password not configured' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password server-side (hash never exposed to client)
    const isValid = await bcrypt.compare(password, establishment.admin_password_hash);

    console.log('Admin password verification:', { 
      userId: user.id, 
      establishmentId: profile.establishment_id,
      valid: isValid 
    });

    // Get session timeout from settings
    const settings = establishment.settings as any || {};
    const sessionTimeout = settings.admin_session_timeout || 30; // minutes

    return new Response(
      JSON.stringify({ 
        valid: isValid,
        sessionTimeout 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in verify-admin-password function:', error);
    return new Response(
      JSON.stringify({ error: error.message, valid: false }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

