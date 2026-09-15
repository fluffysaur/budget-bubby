/**
 * Household Context & Perspective State Management
 * Provides global perspective (Combined Household vs Yi Jia vs Rachel),
 * theme (light vs dark with DOM synchronization), and active member resolution.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
  useCallback,
} from 'react';
import type { HouseholdMember, HouseholdOverview, Perspective } from '../types/finance';
import { mockMembers } from '../data/mockSeedData';
import { financeService } from '../services/financeService';
import { isSupabaseConfigured } from '../services/supabaseClient';

export interface HouseholdContextValue {
  perspective: Perspective;
  setPerspective: (perspective: Perspective) => void;
  members: HouseholdMember[];
  activeMember: HouseholdMember | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  isMockMode: boolean;
  overview: HouseholdOverview | null;
  loading: boolean;
  refreshData: () => Promise<void>;
}

const HouseholdContext = createContext<HouseholdContextValue | undefined>(undefined);

export interface HouseholdProviderProps {
  children: React.ReactNode;
  initialPerspective?: Perspective;
  initialTheme?: 'light' | 'dark';
}

const THEME_STORAGE_KEY = 'budget_buddy_theme';

export function HouseholdProvider({
  children,
  initialPerspective = 'household',
  initialTheme,
}: HouseholdProviderProps) {
  const [perspective, setPerspective] = useState<Perspective>(initialPerspective);
  const [members, setMembers] = useState<HouseholdMember[]>(mockMembers);
  const [overview, setOverview] = useState<HouseholdOverview | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (initialPerspective) {
      setPerspective(initialPerspective);
    }
  }, [initialPerspective]);

  // Initialize theme from prop, localStorage, or fallback to 'light'
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (initialTheme) return initialTheme;
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    }
    return 'light';
  });

  // Sync DOM with theme changes
  useEffect(() => {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      try {
        localStorage.setItem(THEME_STORAGE_KEY, theme);
      } catch {
        // Ignore storage write errors in restricted environments
      }
    }
  }, [theme]);

  // Determine whether running in mock demo mode
  const isMockMode = useMemo(() => !isSupabaseConfigured(), []);

  // Fetch household overview and members
  const refreshData = useCallback(async () => {
    try {
      setLoading(true);
      const data = await financeService.getHouseholdOverview();
      setOverview(data);
      if (data.members && data.members.length > 0) {
        setMembers(data.members);
      }
    } catch (err) {
      console.error('Failed to load household data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Resolve active member based on current perspective
  const activeMember = useMemo<HouseholdMember | null>(() => {
    if (perspective === 'household') {
      return null;
    }

    const pLower = perspective.toLowerCase().trim();
    const found = members.find((m) => {
      if (m.id === perspective) return true;
      const mLower = m.display_name.toLowerCase().trim();
      const mSanitized = mLower.replace(/\s+/g, '');
      const pSanitized = pLower.replace(/\s+/g, '');
      return mLower === pLower || mSanitized === pSanitized || mLower.includes(pLower);
    });

    return found || null;
  }, [perspective, members]);

  // Theme toggle action
  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const contextValue: HouseholdContextValue = {
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
  };

  return (
    <HouseholdContext.Provider value={contextValue}>
      {children}
    </HouseholdContext.Provider>
  );
}

export function useHousehold(): HouseholdContextValue {
  const context = useContext(HouseholdContext);
  if (!context) {
    throw new Error('useHousehold must be used within a HouseholdProvider');
  }
  return context;
}
