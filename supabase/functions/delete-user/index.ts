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
    // Tenta múltiplas variáveis de ambiente para compatibilidade
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('SUPABASE_PROJECT_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
        envKeys: Object.keys(Deno.env.toObject())
      })
      throw new Error('Missing environment variables: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY required')
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

    // Get user_id from request body
    const { user_id } = await req.json()

    if (!user_id) {
      throw new Error('user_id is required')
    }

    // Prevent deleting yourself
    if (user_id === user.id) {
      throw new Error('Cannot delete your own account')
    }

    // Delete related data first (cascade should handle most, but let's be explicit)
    
    // Delete user notifications
    await supabaseAdmin
      .from('user_notifications')
      .delete()
      .eq('user_id', user_id)

    // Delete audit logs
    await supabaseAdmin
      .from('audit_logs')
      .delete()
      .eq('user_id', user_id)

    // Delete team members (if any)
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('establishment_id')
      .eq('user_id', user_id)
      .maybeSingle()

    if (userProfile?.establishment_id) {
      // Delete team members for this establishment that belong to this user
      await supabaseAdmin
        .from('team_members')
        .delete()
        .eq('establishment_id', userProfile.establishment_id)
        .eq('user_id', user_id)
    }

    // Delete profile (this will cascade to other related tables)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', user_id)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      // Continue anyway - might already be deleted
    }

    // Finally, delete the user from auth.users using admin API
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user_id)

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError)
      throw new Error(`Failed to delete user: ${deleteError.message}`)
    }

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    )

  } catch (error: any) {
    console.error('Error in delete-user function:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    )
  }
})
