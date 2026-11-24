/**
 * AuthContext - Manages Supabase authentication with 6-digit PIN identification.
 * A PIN is the password of one member's auth account; the signed-in email (or
 * auth user id) identifies which household member is using this device.
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useCallback,
    useMemo,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase, isSupabaseConfigured } from "../services/supabaseClient";
import { queryClient } from "../lib/queryClient";
import {
    clearPersistedQueryCache,
    syncPersistedCacheUser,
} from "../lib/queryPersistence";

import { getMemberSignInEmails } from "../lib/memberSignIn";
import type { MemberIdentity } from "../lib/members";
import { DEMO_MEMBER_EMAILS } from "../data/demoMembers";

const DEMO_MODE_STORAGE_KEY = "budget_buddy_demo_pin";

export interface AuthContextValue {
    user: User | null;
    session: Session | null;
    /** Email of the member who signed in on this device, if anyone did. */
    signedInEmail: string | null;
    /** Who the current member is: the signed-in user, or the demo member. */
    memberIdentity: MemberIdentity | null;
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
    initialMemberEmail?: string | null;
}

export function AuthProvider({
    children,
    initialAuthenticated,
    initialMemberEmail = null,
}: AuthProviderProps) {
    const isLive = isSupabaseConfigured();

    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [signedInEmail, setSignedInEmail] = useState<string | null>(
        initialMemberEmail,
    );
    const [isDemoMode, setIsDemoMode] = useState<boolean>(() => {
        if (typeof window !== "undefined" && window.sessionStorage) {
            return (
                window.sessionStorage.getItem(DEMO_MODE_STORAGE_KEY) === "true"
            );
        }
        return false;
    });
    const [authLoading, setAuthLoading] = useState<boolean>(
        !isLive ? false : true,
    );
    const [authError, setAuthError] = useState<string | null>(null);

    // Link authenticated user to household_members table via RPC
    const linkMemberProfile = useCallback(async () => {
        if (!supabase) return;
        try {
            // Identity is read server-side from the verified JWT.
            await supabase.rpc("claim_household_member_profile");
        } catch (err) {
            console.warn("Could not auto-link member profile:", err);
        }
    }, []);

    // Initialize and listen to Supabase auth state changes
    useEffect(() => {
        if (!isLive || !supabase) {
            setAuthLoading(false);
            return;
        }

        let isMounted = true;

        // Fetch initial active session
        supabase.auth
            .getSession()
            .then(({ data: { session: currentSession } }) => {
                if (!isMounted) return;
                if (currentSession?.user) {
                    syncPersistedCacheUser(currentSession.user.id, queryClient);
                    setSession(currentSession);
                    setUser(currentSession.user);
                    setSignedInEmail(currentSession.user.email ?? null);
                    if (currentSession.user.email) {
                        linkMemberProfile();
                    }
                } else {
                    setSession(null);
                    setUser(null);
                    setSignedInEmail(null);
                }
                setAuthLoading(false);
            })
            .catch((err) => {
                console.error("Failed to get session:", err);
                if (isMounted) setAuthLoading(false);
            });

        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (!isMounted) return;
            if (newSession?.user) {
                syncPersistedCacheUser(newSession.user.id, queryClient);
            } else if (event === "SIGNED_OUT") {
                clearPersistedQueryCache();
                queryClient.clear();
            }
            setSession(newSession);
            setUser(newSession?.user ?? null);
            if (newSession?.user) {
                setSignedInEmail(newSession.user.email ?? null);
                if (newSession.user.email) {
                    linkMemberProfile();
                }
            } else {
                setSignedInEmail(null);
            }
            setAuthLoading(false);
        });

        return () => {
            isMounted = false;
            subscription.unsubscribe();
        };
    }, [isLive, linkMemberProfile]);

    // Sign in by verifying the 6-digit PIN against each member's account
    const signInWithPin = useCallback(
        async (pin: string): Promise<boolean> => {
            setAuthError(null);

            // Support PIN 000000 to enter Demo Mode
            if (pin === "000000") {
                queryClient.clear();
                setIsDemoMode(true);
                if (typeof window !== "undefined" && window.sessionStorage) {
                    window.sessionStorage.setItem(
                        DEMO_MODE_STORAGE_KEY,
                        "true",
                    );
                }
                setSignedInEmail(DEMO_MEMBER_EMAILS[0]);
                setAuthLoading(false);
                return true;
            }

            // In mock mode (no Supabase configured), simulate authentication
            if (!isLive || !supabase) {
                if (pin === "123456" || pin.length === 6) {
                    // A PIN starting with 2 signs in as the second demo member
                    setSignedInEmail(
                        pin.startsWith("2")
                            ? DEMO_MEMBER_EMAILS[1]
                            : DEMO_MEMBER_EMAILS[0],
                    );
                    return true;
                }
                setAuthError("Invalid PIN code");
                return false;
            }

            setAuthLoading(true);

            try {
                // Try each member's account with the entered PIN, in order.
                const emails = getMemberSignInEmails();
                if (emails.length === 0) {
                    console.warn(
                        "[Auth] No member sign-in emails configured (VITE_MEMBER_EMAILS is empty).",
                    );
                    setAuthError(
                        "Sign-in isn't set up yet. Please contact your household admin.",
                    );
                    setAuthLoading(false);
                    return false;
                }
                const errors: (string | undefined)[] = [];
                for (const [index, email] of emails.entries()) {
                    const res = await supabase.auth.signInWithPassword({
                        email,
                        password: pin,
                    });

                    if (res.data.session && res.data.user) {
                        setSession(res.data.session);
                        setUser(res.data.user);
                        setSignedInEmail(res.data.user.email ?? email);
                        setIsDemoMode(false);
                        if (
                            typeof window !== "undefined" &&
                            window.sessionStorage
                        ) {
                            window.sessionStorage.removeItem(
                                DEMO_MODE_STORAGE_KEY,
                            );
                        }
                        syncPersistedCacheUser(res.data.user.id, queryClient);
                        await linkMemberProfile();
                        setAuthLoading(false);
                        return true;
                    }

                    const message = res.error?.message;
                    errors.push(message);
                    if (message && message !== "Invalid login credentials") {
                        console.warn(
                            `[Auth] member ${index + 1} sign-in notice:`,
                            message,
                        );
                    }
                }

                // Check if there was an email confirmation error or config mismatch
                const firstError = errors[0];
                const specificError = errors.some((e) =>
                    e?.includes("Email not confirmed"),
                )
                    ? "Email address not confirmed in Supabase. Please auto-confirm it in Supabase Auth."
                    : firstError && firstError !== "Invalid login credentials"
                      ? firstError
                      : "Invalid PIN code. Enter 000000 to enter Demo Mode.";

                setAuthError(specificError);
                setAuthLoading(false);
                return false;
            } catch (err: unknown) {
                console.error("Sign in error:", err);
                setAuthError(
                    err instanceof Error
                        ? err.message
                        : "Authentication failed. Please try again.",
                );
                setAuthLoading(false);
                return false;
            }
        },
        [isLive, linkMemberProfile],
    );

    const signOut = useCallback(async () => {
        setAuthLoading(true);
        setIsDemoMode(false);
        if (typeof window !== "undefined" && window.sessionStorage) {
            window.sessionStorage.removeItem(DEMO_MODE_STORAGE_KEY);
        }
        if (supabase) {
            try {
                await supabase.auth.signOut();
            } catch (err) {
                console.error("Sign out error:", err);
            }
        }
        clearPersistedQueryCache();
        queryClient.clear();
        setSession(null);
        setUser(null);
        setSignedInEmail(null);
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

    // Demo and mock data always have a current member: the signed-in demo
    // member, else the first one. Live mode only knows the signed-in user.
    const isDemoData = isDemoMode || !isLive;
    const userId = user?.id ?? null;
    const memberIdentity = useMemo<MemberIdentity | null>(() => {
        if (isDemoData) {
            return {
                userId: null,
                email: signedInEmail ?? DEMO_MEMBER_EMAILS[0],
            };
        }
        if (!userId && !signedInEmail) return null;
        return { userId, email: signedInEmail };
    }, [isDemoData, signedInEmail, userId]);

    const value: AuthContextValue = {
        user,
        session,
        signedInEmail,
        memberIdentity,
        isAuthenticated,
        isDemoMode,
        authLoading,
        authError,
        signInWithPin,
        signOut,
        clearAuthError,
    };

    return (
        <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
    );
}

const defaultAuthContextValue: AuthContextValue = {
    user: null,
    session: null,
    signedInEmail: null,
    memberIdentity: { userId: null, email: DEMO_MEMBER_EMAILS[0] },
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
