/**
 * Budget Bubby - Main Application Shell & Routing Hub
 * Coordinates:
 * - Desktop sidebar and mobile bottom navigation
 * - Top header with perspective switcher, currency badge & theme toggle
 * - Perspective context banner
 * - Central route matching for Dashboard, Budget, Expenses, Accounts, Goals, Loans, Recurring, Fast Log
 * - Global Quick Add Expense modal
 */

import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import {
  BrowserRouter,
  MemoryRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  HouseholdProvider,
  useHousehold,
  useOptionalHousehold,
} from './context/HouseholdContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { PinLoginScreen } from './components/auth/PinLoginScreen';
import { isSupabaseConfigured } from './services/supabaseClient';
import { financeService } from './services/financeService';
import { DesktopSidebar } from './components/layout/DesktopSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { QuickAddExpenseModal } from './components/expenses/QuickAddExpenseModal';
import { ExpenseSuccessCelebration } from './components/expenses/ExpenseSuccessCelebration';
import { OfflineBanner } from './components/pwa/OfflineBanner';
import { PWAUpdateToast } from './components/pwa/PWAUpdateToast';
import type { Expense, Category } from './types/finance';

// Route-level code-splitting for fast initial boot (<50ms first paint)
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const BudgetPage = lazy(() => import('./pages/BudgetPage'));
const ExpensesPage = lazy(() => import('./pages/ExpensesPage'));
const AccountsPage = lazy(() => import('./pages/AccountsPage'));
const PlanPage = lazy(() => import('./pages/PlanPage'));
const FastLogPage = lazy(() => import('./pages/FastLogPage'));

/**
 * Branded Skeleton Loader displayed during route transition / lazy bundle resolution
 */
export function RouteSkeletonLoader() {
  return (
    <div
      role="status"
      aria-label="Loading page content"
      data-testid="route-skeleton-loader"
      className="w-full space-y-6 animate-pulse py-2"
    >
      {/* Header bar placeholder */}
      <div className="flex items-center justify-between">
        <div className="h-8 bg-[#d8d0c7]/60 dark:bg-slate-800 rounded-xl w-48" />
        <div className="h-8 bg-[#d8d0c7]/60 dark:bg-slate-800 rounded-xl w-28" />
      </div>

      {/* Hero card / 3-column stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="h-28 bg-(--bg-card) rounded-2xl p-4 border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)" />
        <div className="h-28 bg-(--bg-card) rounded-2xl p-4 border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)" />
        <div className="h-28 bg-(--bg-card) rounded-2xl p-4 border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) sm:col-span-2 lg:col-span-1" />
      </div>

      {/* Main card placeholder */}
      <div className="h-72 bg-(--bg-card) rounded-2xl p-6 border-[1.5px] border-(--border-ink) shadow-(--shadow-cute) flex flex-col justify-between">
        <div className="h-6 bg-[#d8d0c7]/70 dark:bg-slate-700 rounded-lg w-1/4" />
        <div className="space-y-3">
          <div className="h-4 bg-[#d8d0c7]/50 dark:bg-slate-700/60 rounded-md w-full" />
          <div className="h-4 bg-[#d8d0c7]/50 dark:bg-slate-700/60 rounded-md w-5/6" />
          <div className="h-4 bg-[#d8d0c7]/40 dark:bg-slate-700/40 rounded-md w-4/6" />
        </div>
        <div className="h-4 bg-[#d8d0c7]/40 dark:bg-slate-700/40 rounded-md w-1/3" />
      </div>
    </div>
  );
}

function AppLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshData, members } = useHousehold();

  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    financeService.getCategories().then((cats) => {
      if (cats && cats.length > 0) setCategories(cats);
    }).catch(() => {});
  }, []);

  // Extract active tab id from route path
  const activeTab = useMemo(() => {
    const segment = location.pathname.replace(/^\//, '').split('/')[0];
    if (!segment || segment === 'dashboard') return 'dashboard';
    if (['goals', 'loans', 'recurring'].includes(segment)) return 'plan';
    if (segment === 'fast-log') return 'expenses';
    return segment;
  }, [location.pathname]);

  const handleSelectTab = useCallback(
    (tabId: string) => {
      if (tabId === 'dashboard') {
        navigate('/');
      } else {
        navigate(`/${tabId}`);
      }
    },
    [navigate]
  );

  const handleOpenQuickAdd = useCallback(() => {
    setIsQuickAddOpen(true);
  }, []);

  const handleCloseQuickAdd = useCallback(() => {
    setIsQuickAddOpen(false);
  }, []);

  const handleExpenseAdded = useCallback(
    async (_newExpense: Expense) => {
      await refreshData();
    },
    [refreshData]
  );

  // Keyboard shortcut: Press 'c' to open Quick Add modal (when not focused in inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeTag = document.activeElement?.tagName.toLowerCase();
      if (
        activeTag === 'input' ||
        activeTag === 'textarea' ||
        activeTag === 'select' ||
        (document.activeElement as HTMLElement)?.isContentEditable
      ) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        if (!e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          setIsQuickAddOpen((prev) => !prev);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Allow other pages to open Quick Add via custom event
  useEffect(() => {
    const handleGlobalOpen = () => setIsQuickAddOpen(true);
    window.addEventListener('openQuickAdd', handleGlobalOpen);
    return () => window.removeEventListener('openQuickAdd', handleGlobalOpen);
  }, []);

  return (
    <div className="flex h-screen bg-(--bg-canvas) text-(--text-ink) overflow-hidden font-sans">
      {/* Desktop Navigation Sidebar */}
      <DesktopSidebar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Main Application Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Offline Status Connectivity Banner */}
        <OfflineBanner />

        {/* Responsive Header */}
        <AppHeader
          onOpenQuickAdd={handleOpenQuickAdd}
          onNavigateTab={handleSelectTab}
        />

        {/* Scrollable Viewport / Route Container (Constrained width on desktop) */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 pb-24 md:pb-10">
          <div className="mx-auto w-full max-w-5xl">
            <Suspense fallback={<RouteSkeletonLoader />}>
              <Routes>
                <Route path="/" element={<DashboardPage onNavigateTab={handleSelectTab} />} />
                <Route path="/dashboard" element={<DashboardPage onNavigateTab={handleSelectTab} />} />
                <Route path="/budget" element={<BudgetPage />} />
                <Route path="/expenses" element={<ExpensesPage />} />
                <Route path="/fast-log" element={<FastLogPage onNavigateTab={handleSelectTab} />} />
                <Route path="/accounts" element={<AccountsPage />} />
                <Route path="/goals" element={<PlanPage initialTab="goals" onNavigateTab={handleSelectTab} />} />
                <Route path="/loans" element={<PlanPage initialTab="loans" onNavigateTab={handleSelectTab} />} />
                <Route path="/recurring" element={<PlanPage initialTab="recurring" onNavigateTab={handleSelectTab} />} />
                <Route path="/plan" element={<PlanPage onNavigateTab={handleSelectTab} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </Suspense>
          </div>
        </main>
      </div>

      {/* Mobile Fixed Bottom Navigation */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={handleSelectTab}
        onQuickAdd={handleOpenQuickAdd}
      />

      {/* Global Quick Add Expense Modal */}
      <QuickAddExpenseModal
        isOpen={isQuickAddOpen}
        onClose={handleCloseQuickAdd}
        onExpenseAdded={handleExpenseAdded}
        categories={categories}
        members={members}
      />

      {/* Fun Celebratory Feedback on adding expense */}
      <ExpenseSuccessCelebration />

      {/* PWA Update & Offline Ready Toast */}
      <PWAUpdateToast />
    </div>
  );
}

/**
 * AppShell provides layout content, wrapping with HouseholdProvider if not already present.
 * Shows PinLoginScreen if Supabase is configured and user is not authenticated.
 */
export function AppShell() {
  const { isAuthenticated, authLoading, loggedInPartner } = useAuth();
  const optionalContext = useOptionalHousehold();

  // If live Supabase is configured and we are still verifying the session
  if (isSupabaseConfigured() && authLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-(--bg-canvas) text-(--text-ink)">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-[#dfc2ff] border-t-transparent" />
          <span className="text-xs font-bold text-(--text-muted) tracking-wider uppercase font-mono-num">Loading Budget Bubby...</span>
        </div>
      </div>
    );
  }

  // If live Supabase is configured and user is not authenticated, show PIN Lock Screen
  if (isSupabaseConfigured() && !isAuthenticated) {
    return <PinLoginScreen />;
  }

  const defaultPerspective = loggedInPartner || 'household';

  if (!optionalContext) {
    return (
      <HouseholdProvider defaultPerspective={defaultPerspective}>
        <AppLayoutInner />
      </HouseholdProvider>
    );
  }
  return <AppLayoutInner />;
}

export interface AppProps {
  initialEntries?: string[];
  initialAuthenticated?: boolean;
}

/**
 * Root App component.
 * Uses MemoryRouter when initialEntries is provided (ideal for testing),
 * otherwise defaults to BrowserRouter for production web apps.
 */
export function App({ initialEntries, initialAuthenticated }: AppProps = {}) {
  const RouterComponent = initialEntries ? MemoryRouter : BrowserRouter;
  const routerProps = initialEntries ? { initialEntries } : {};

  return (
    <AuthProvider initialAuthenticated={initialAuthenticated}>
      <RouterComponent {...routerProps}>
        <AppShell />
      </RouterComponent>
    </AuthProvider>
  );
}

export default App;

