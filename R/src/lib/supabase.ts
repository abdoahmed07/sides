import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Only the public anon key belongs in the front-end. Row-level security does the
// protecting. Never put a service-role key or any AI key here.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } }) : null;
