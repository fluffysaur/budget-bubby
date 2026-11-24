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
import {
    findCurrentMember,
    normalisePerspective,
    resolvePerspectiveMember,
} from "../lib/members";
import {
    THEME_STORAGE_KEY,
    applyThemeClass,
    readStoredTheme,
} from "../lib/theme";
import { useAuth } from "./AuthContext";

export interface HouseholdContextValue {
    perspective: Perspective;
    setPerspective: (perspective: Perspective) => void;
    members: HouseholdMember[];
    /** The member the current perspective shows; null for the household view. */
    activeMember: HouseholdMember | null;
    /** The member using this device (from the signed-in user), if known. */
    currentMember: HouseholdMember | null;
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
    /**
     * Switch to the current member's own view once they are known, and again
     * if a different member signs in. Used by the app shell after sign-in.
     */
    followCurrentMember?: boolean;
}

function HouseholdProviderInner({
    children,
    initialPerspective = "household",
    initialTheme,
    defaultPerspective,
    followCurrentMember = false,
}: HouseholdProviderProps) {
    const requestedPerspective = defaultPerspective || initialPerspective;
    const [perspective, setPerspective] =
        useState<Perspective>(requestedPerspective);
    const { memberIdentity } = useAuth();

    // Follow perspective props when they change (adjusted during render)
    const [lastRequested, setLastRequested] = useState(requestedPerspective);
    if (requestedPerspective !== lastRequested) {
        setLastRequested(requestedPerspective);
        setPerspective(requestedPerspective);
    }

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

    const currentMember = useMemo(
        () => findCurrentMember(members, memberIdentity),
        [members, memberIdentity],
    );

    // Open on the signed-in member's own view once they resolve
    const currentMemberId = currentMember?.id ?? null;
    const [followedMemberId, setFollowedMemberId] = useState<string | null>(
        null,
    );
    if (
        followCurrentMember &&
        currentMemberId &&
        currentMemberId !== followedMemberId
    ) {
        setFollowedMemberId(currentMemberId);
        setPerspective(currentMemberId);
    }

    // A perspective that is not a known member (e.g. a legacy partner slot
    // from older stored state) falls back to the household view.
    const effectivePerspective = useMemo(
        () => normalisePerspective(perspective, members),
        [perspective, members],
    );

    const activeMember = useMemo(
        () => resolvePerspectiveMember(members, effectivePerspective),
        [members, effectivePerspective],
    );

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
            perspective: effectivePerspective,
            setPerspective,
            members,
            activeMember,
            currentMember,
            theme,
            toggleTheme,
            isMockMode,
            overview,
            loading,
            refreshData,
        }),
        [
            effectivePerspective,
            setPerspective,
            members,
            activeMember,
            currentMember,
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
