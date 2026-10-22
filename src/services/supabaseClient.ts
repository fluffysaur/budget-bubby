import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/**
 * Configured partner email addresses for PIN authentication.
 */
export function getPartnerEmails(): { yiJiaEmail: string; rachelEmail: string } {
  const yiJiaEmail = (import.meta.env.VITE_YIJIA_EMAIL as string | undefined)?.trim() || 'yijia@example.com';
  const rachelEmail = (import.meta.env.VITE_RACHEL_EMAIL as string | undefined)?.trim() || 'rachel@example.com';
  return { yiJiaEmail, rachelEmail };
}

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
