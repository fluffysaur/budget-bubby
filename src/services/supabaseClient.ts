import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Checks if Supabase credentials are configured with valid non-placeholder values.
 */
export function isSupabaseConfigured(): boolean {
  if (!supabaseUrl || !supabaseAnonKey) {
    return false;
  }

  const cleanUrl = supabaseUrl.trim().toLowerCase();
  const cleanKey = supabaseAnonKey.trim();

  if (
    cleanUrl === '' ||
    cleanUrl.includes('your-supabase') ||
    cleanUrl.includes('placeholder') ||
    cleanUrl.includes('example.com')
  ) {
    return false;
  }

  if (
    cleanKey === '' ||
    cleanKey.includes('placeholder') ||
    cleanKey.includes('your-anon-key')
  ) {
    return false;
  }

  try {
    new URL(cleanUrl);
  } catch {
    return false;
  }

  return true;
}

/**
 * Shared Supabase Client instance (null when running in mock demo mode).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null;
