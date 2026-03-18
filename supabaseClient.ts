/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
  throw new Error('Missing Supabase environment variables');
}

export const createSupabaseClient = (useServiceRole = false) => {
  const key = useServiceRole ? supabaseServiceRoleKey : supabaseAnonKey;
  const options = {
    auth: {
      autoRefreshToken: false,
      persistSession: !useServiceRole,
    },
  };
  
  return createClient(supabaseUrl, key, options);
};

export const supabase = createSupabaseClient(false);
export const supabaseAdmin = createSupabaseClient(true);

