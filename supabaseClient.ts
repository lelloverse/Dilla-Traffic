/// <reference types="vite/client" />
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: sessionStorage,  // Use sessionStorage: clears on tab close, prevents stale tokens across sessions
  },
});

console.log('🪨 Supabase client initialized:', {
  url: supabaseUrl ? supabaseUrl.slice(0, 30) + '...' : 'MISSING',
  anonKey: supabaseAnonKey ? 'SET' : 'MISSING'
});

