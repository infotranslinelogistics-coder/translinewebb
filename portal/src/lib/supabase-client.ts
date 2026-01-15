import { createClient } from '@supabase/supabase-js';
import { projectId, publicAnonKey } from '../utils/supabase/info';

const supabaseUrl = `https://${projectId}.supabase.co`;

// Use service role key for admin operations (from environment variable)
// Falls back to anon key if service role key is not configured
const supabaseKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || publicAnonKey;

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

// Also export a public client for auth operations that should use anon key
export const supabaseAuth = createClient(supabaseUrl, publicAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
