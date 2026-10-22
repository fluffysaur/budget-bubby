/**
 * AuthContext - Manages Supabase authentication with 6-digit PIN identification
 * Maps unique 6-digit PINs directly to Yi Jia or Rachel.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, getPartnerEmails } from '../services/supabaseClient';

export type PartnerId = 'yijia' | 'rachel';

const DEMO_MODE_STORAGE_KEY = 'budget_buddy_demo_pin';

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loggedInPartner: PartnerId | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  authLoading: boolean;
  authError: string | null;
  signInWithPin: (pin: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export interface AuthProviderProps {
  children: React.ReactNode;
  initialAuthenticated?: boolean; // useful for testing
  initialPartner?: PartnerId | null;
}

export function AuthProvider({
  children,
  initialAuthenticated,
  initialPartner = null,
}: AuthProviderProps) {
  const isLive = isSupabaseConfigured();

  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loggedInPartner, setLoggedInPartner] = useState<PartnerId | null>(initialPartner);
  const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
    if (typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage.getItem(DEMO_MODE_STORAGE_KEY) === 'true';
    }
    return false;
  });
  const [authLoading, setAuthLoading] = useState<boolean>(!isLive ? false : true);
  const [authError, setAuthError] = useState<string | null>(null);

  // Link authenticated user to household_members table via RPC
  const linkMemberProfile = useCallback(async (email: string) => {
    if (!supabase) return;
    try {
      await supabase.rpc('claim_household_member_profile', { user_email: email });
    } catch (err) {
      console.warn('Could not auto-link member profile:', err);
    }
  }, []);

  // Determine partner id from email address
  const resolvePartnerFromEmail = useCallback((email?: string | null): PartnerId | null => {
    if (!email) return null;
    const { yiJiaEmail, rachelEmail } = getPartnerEmails();
    const clean = email.toLowerCase().trim();
    if (clean === yiJiaEmail.toLowerCase().trim() || clean.includes('yijia')) {
      return 'yijia';
    }
    if (clean === rachelEmail.toLowerCase().trim() || clean.includes('rachel')) {
      return 'rachel';
    }
    return null;
  }, []);

  // Initialize and listen to Supabase auth state changes
  useEffect(() => {
    if (!isLive || !supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    // Fetch initial active session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!isMounted) return;
      if (currentSession?.user) {
        setSession(currentSession);
        setUser(currentSession.user);
        const partner = resolvePartnerFromEmail(currentSession.user.email);
        setLoggedInPartner(partner);
        if (currentSession.user.email) {
          linkMemberProfile(currentSession.user.email);
        }
      } else {
        setSession(null);
        setUser(null);
        setLoggedInPartner(null);
      }
      setAuthLoading(false);
    }).catch((err) => {
      console.error('Failed to get session:', err);
      if (isMounted) setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        const partner = resolvePartnerFromEmail(newSession.user.email);
        setLoggedInPartner(partner);
        if (newSession.user.email) {
          linkMemberProfile(newSession.user.email);
        }
      } else {
        setLoggedInPartner(null);
      }
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [isLive, resolvePartnerFromEmail, linkMemberProfile]);

  // Sign in by verifying the unique 6-digit PIN against both configured partner accounts
  const signInWithPin = useCallback(
    async (pin: string): Promise<boolean> => {
      setAuthError(null);

      // Support PIN 000000 to enter Demo Mode
      if (pin === '000000') {
        setIsDemoMode(true);
        if (typeof window !== 'undefined' && window.sessionStorage) {
          window.sessionStorage.setItem(DEMO_MODE_STORAGE_KEY, 'true');
        }
        setLoggedInPartner('yijia');
        setAuthLoading(false);
        return true;
      }

      // In mock mode (no Supabase configured), simulate authentication
      if (!isLive || !supabase) {
        if (pin === '123456' || pin.length === 6) {
          // If first digit is 1, treat as Yi Jia, otherwise Rachel for mock demonstration
          const mockPartner: PartnerId = pin.startsWith('2') ? 'rachel' : 'yijia';
          setLoggedInPartner(mockPartner);
          return true;
        }
        setAuthError('Invalid PIN code');
        return false;
      }

      setAuthLoading(true);
      const { yiJiaEmail, rachelEmail } = getPartnerEmails();

      try {
        console.log(`[Auth] Attempting sign in with emails: Yi Jia (${yiJiaEmail}), Rachel (${rachelEmail})`);

        // 1. Try Yi Jia's account with the entered PIN
        const res1 = await supabase.auth.signInWithPassword({
          email: yiJiaEmail,
          password: pin,
        });

        if (res1.data.session && res1.data.user) {
          setSession(res1.data.session);
          setUser(res1.data.user);
          setLoggedInPartner('yijia');
          setIsDemoMode(false);
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
          }
          await linkMemberProfile(yiJiaEmail);
          setAuthLoading(false);
          return true;
        }

        if (res1.error && res1.error.message !== 'Invalid login credentials') {
          console.warn('[Auth] Yi Jia sign-in notice:', res1.error.message);
        }

        // 2. If Yi Jia's didn't match, try Rachel's account
        const res2 = await supabase.auth.signInWithPassword({
          email: rachelEmail,
          password: pin,
        });

        if (res2.data.session && res2.data.user) {
          setSession(res2.data.session);
          setUser(res2.data.user);
          setLoggedInPartner('rachel');
          setIsDemoMode(false);
          if (typeof window !== 'undefined' && window.sessionStorage) {
            window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
          }
          await linkMemberProfile(rachelEmail);
          setAuthLoading(false);
          return true;
        }

        if (res2.error && res2.error.message !== 'Invalid login credentials') {
          console.warn('[Auth] Rachel sign-in notice:', res2.error.message);
        }

        // Check if there was an email confirmation error or config mismatch
        const specificError =
          (res1.error?.message?.includes('Email not confirmed') || res2.error?.message?.includes('Email not confirmed'))
            ? 'Email address not confirmed in Supabase. Please auto-confirm it in Supabase Auth.'
            : (res1.error?.message && res1.error.message !== 'Invalid login credentials')
            ? res1.error.message
            : 'Invalid PIN code. Enter 000000 to enter Demo Mode.';

        setAuthError(specificError);
        setAuthLoading(false);
        return false;
      } catch (err: any) {
        console.error('Sign in error:', err);
        setAuthError(err?.message || 'Authentication failed. Please try again.');
        setAuthLoading(false);
        return false;
      }
    },
    [isLive, linkMemberProfile]
  );

  const signOut = useCallback(async () => {
    setAuthLoading(true);
    setIsDemoMode(false);
    if (typeof window !== 'undefined' && window.sessionStorage) {
      window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
    }
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error('Sign out error:', err);
      }
    }
    setSession(null);
    setUser(null);
    setLoggedInPartner(null);
    setAuthLoading(false);
  }, []);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const isAuthenticated = useMemo(() => {
    if (initialAuthenticated !== undefined) return initialAuthenticated;
    if (isDemoMode) return true;
    if (!isLive) return true; // mock mode is accessible by default unless testing
    return Boolean(session && user);
  }, [initialAuthenticated, isDemoMode, isLive, session, user]);

  const value: AuthContextValue = {
    user,
    session,
    loggedInPartner,
    isAuthenticated,
    isDemoMode,
    authLoading,
    authError,
    signInWithPin,
    signOut,
    clearAuthError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

const defaultAuthContextValue: AuthContextValue = {
  user: null,
  session: null,
  loggedInPartner: null,
  isAuthenticated: true,
  isDemoMode: false,
  authLoading: false,
  authError: null,
  signInWithPin: async () => true,
  signOut: async () => {},
  clearAuthError: () => {},
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    return defaultAuthContextValue;
  }
  return context;
}

export function useOptionalAuth(): AuthContextValue | null {
  const context = useContext(AuthContext);
  return context || null;
}
