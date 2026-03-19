
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId, newPassword } = await req.json();

    if (!userId || typeof userId !== 'string') {
      throw new Error('userId is required');
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw new Error('newPassword must be a string of at least 8 characters');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Update auth.users password
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      { password: newPassword }
    );

    if (authError) throw authError;

    // Update public.users table for consistency (optional, for display)
    const { error: dbError } = await supabaseAdmin
      .from('users')
      .update({ password: newPassword })
      .eq('id', userId);

    if (dbError) {
      console.error('Failed to update users table:', dbError);
      // Don't fail the whole operation; auth update succeeded
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password reset successful' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Edge Function Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

