/**
 * Household Context & Perspective State Management
 * Provides global perspective (Combined Household vs each member),
 * theme (light vs dark with DOM synchronization), and active member resolution.
 */

import React, {
    createContext,
    useContext,
    useState,
    useEffect,
    useMemo,
    useCallback,
    useRef,
} from "react";
import type {
    HouseholdMember,
    HouseholdOverview,
    Perspective,
} from "../types/finance";
export type { Perspective, Perspective as PerspectiveType };
import { isDemoModeActive } from "../services/financeService";
import { isSupabaseConfigured } from "../services/supabaseClient";
import { useHouseholdOverviewQuery } from "../hooks/finance/budget";
import { useLazyMockDefaults } from "../hooks/useLazyMockDefaults";
import { useQueryClient, QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { matchPartnerMember } from "../lib/members";
import {
    THEME_STORAGE_KEY,
    applyThemeClass,
    readStoredTheme,
} from "../lib/theme";
import { useOptionalAuth } from "./AuthContext";

export interface HouseholdContextValue {
    perspective: Perspective;
    setPerspective: (perspective: Perspective) => void;
    members: HouseholdMember[];
    activeMember: HouseholdMember | null;
    theme: "light" | "dark";
    toggleTheme: () => void;
    isMockMode: boolean;
    overview: HouseholdOverview | null;
    loading: boolean;
    refreshData: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(
    undefined,
);

export interface HouseholdProviderProps {
    children: React.ReactNode;
    initialPerspective?: Perspective;
    initialTheme?: "light" | "dark";
    defaultPerspective?: Perspective;
}

function HouseholdProviderInner({
    children,
    initialPerspective = "household",
    initialTheme,
    defaultPerspective,
}: HouseholdProviderProps) {
    const [perspective, setPerspective] = useState<Perspective>(
        defaultPerspective || initialPerspective,
    );
    const auth = useOptionalAuth();
    const loggedInPartner = auth?.loggedInPartner ?? null;
    const authUserId = auth?.user?.id ?? null;

    useEffect(() => {
        if (defaultPerspective) {
            setPerspective(defaultPerspective);
        } else if (initialPerspective) {
            setPerspective(initialPerspective);
        }
    }, [defaultPerspective, initialPerspective]);

    // Initialize theme from prop, localStorage, or fallback to 'light'
    const [theme, setTheme] = useState<"light" | "dark">(() => {
        if (initialTheme) return initialTheme;
        return readStoredTheme();
    });

    // Sync DOM with theme changes
    useEffect(() => {
        if (typeof document !== "undefined") {
            applyThemeClass(theme);
            try {
                localStorage.setItem(THEME_STORAGE_KEY, theme);
            } catch {
                // Ignore storage write errors in restricted environments
            }
        }
    }, [theme]);

    // Determine whether running in mock demo mode
    const isMockMode = !isSupabaseConfigured() || isDemoModeActive();
    const queryClient = useQueryClient();

    // Query household overview through TanStack Query
    const {
        data: overviewData,
        isLoading: loading,
        refetch,
    } = useHouseholdOverviewQuery();

    const overview = overviewData ?? null;
    const hasOverviewMembers = Boolean(
        overviewData?.members && overviewData.members.length > 0,
    );
    const { members: mockMembers } = useLazyMockDefaults(
        isMockMode && !hasOverviewMembers,
    );
    const members = useMemo(() => {
        if (overviewData?.members && overviewData.members.length > 0) {
            return overviewData.members;
        }
        return isMockMode ? mockMembers : [];
    }, [overviewData, isMockMode, mockMembers]);

    // Global refresh function: invalidates all finance queries and refetches active ones
    const refreshData = useCallback(async () => {
        await queryClient.invalidateQueries({ queryKey: ["finance"] });
        await refetch();
    }, [queryClient, refetch]);

    // Resolve active member based on current perspective
    const activeMember = useMemo<HouseholdMember | null>(() => {
        if (perspective === "household") {
            return null;
        }

        // Member id, or a partner slot (e.g. the signed-in partner's default view).
        // Unknown values (e.g. a legacy name-based id) fall back to no member.
        return matchPartnerMember(
            members,
            perspective,
            perspective === loggedInPartner ? authUserId : null,
        );
    }, [perspective, members, loggedInPartner, authUserId]);

    const themeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (themeTimerRef.current) {
                clearTimeout(themeTimerRef.current);
            }
        };
    }, []);

    // Theme toggle action
    const toggleTheme = useCallback(() => {
        if (typeof document !== "undefined") {
            const root = document.documentElement;
            root.classList.add("theme-transition");
            if (themeTimerRef.current) {
                clearTimeout(themeTimerRef.current);
            }
            themeTimerRef.current = setTimeout(() => {
                root.classList.remove("theme-transition");
                themeTimerRef.current = null;
            }, 200);
        }
        setTheme((prev) => (prev === "light" ? "dark" : "light"));
    }, []);

    const contextValue: HouseholdContextValue = useMemo(
        () => ({
            perspective,
            setPerspective,
            members,
            activeMember,
            theme,
            toggleTheme,
            isMockMode,
            overview,
            loading,
            refreshData,
        }),
        [
            perspective,
            setPerspective,
            members,
            activeMember,
            theme,
            toggleTheme,
            isMockMode,
            overview,
            loading,
            refreshData,
        ],
    );

    return (
        <HouseholdContext.Provider value={contextValue}>
            {children}
        </HouseholdContext.Provider>
    );
}

export function HouseholdProvider(props: HouseholdProviderProps) {
    return (
        <QueryClientProvider client={queryClient}>
            <HouseholdProviderInner {...props} />
        </QueryClientProvider>
    );
}

export function useHousehold(): HouseholdContextValue {
    const context = useContext(HouseholdContext);
    if (!context) {
        throw new Error("useHousehold must be used within a HouseholdProvider");
    }
    return context;
}

export function useOptionalHousehold(): HouseholdContextValue | null {
    const context = useContext(HouseholdContext);
    return context || null;
}
