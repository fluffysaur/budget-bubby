/**
 * Budget Buddy - Main Application Shell & Routing Hub
 * Coordinates:
 * - Desktop sidebar and mobile bottom navigation
 * - Top header with perspective switcher, currency badge & theme toggle
 * - Perspective context banner
 * - Central route matching for Dashboard, Budget, Expenses, Accounts, Goals, Loans, Recurring
 * - Global Quick Add Expense modal
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
import { DesktopSidebar } from './components/layout/DesktopSidebar';
import { AppHeader } from './components/layout/AppHeader';
import { PerspectiveBanner } from './components/layout/PerspectiveBanner';
import { MobileBottomNav } from './components/layout/MobileBottomNav';
import { QuickAddExpenseModal } from './components/expenses/QuickAddExpenseModal';
import { DashboardPage } from './pages/DashboardPage';
import { BudgetPage } from './pages/BudgetPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { AccountsPage } from './pages/AccountsPage';
import { GoalsPage } from './pages/GoalsPage';
import { LoansPage } from './pages/LoansPage';
import { RecurringPage } from './pages/RecurringPage';
import { PlanPage } from './pages/PlanPage';
import type { Expense } from './types/finance';

function AppLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { refreshData } = useHousehold();

  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);

  // Extract active tab id from route path
  const activeTab = useMemo(() => {
    const segment = location.pathname.replace(/^\//, '').split('/')[0];
    if (!segment || segment === 'dashboard') return 'dashboard';
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
    (expense: Expense) => {
      refreshData();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('expenseAdded', { detail: expense }));
      }
    },
    [refreshData]
  );

  // Global custom event listener to open Quick Add modal from anywhere
  useEffect(() => {
    const handleGlobalOpen = () => setIsQuickAddOpen(true);
    window.addEventListener('openQuickAdd', handleGlobalOpen);
    return () => window.removeEventListener('openQuickAdd', handleGlobalOpen);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans">
      {/* Desktop Navigation Sidebar */}
      <DesktopSidebar activeTab={activeTab} onSelectTab={handleSelectTab} />

      {/* Main Application Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Responsive Header */}
        <AppHeader onOpenQuickAdd={handleOpenQuickAdd} />

        {/* Financial Perspective Context Banner */}
        <PerspectiveBanner />

        {/* Scrollable Viewport / Route Container */}
        <main className="flex-1 overflow-y-auto px-4 py-6 pb-24 md:pb-10">
          <Routes>
            <Route path="/" element={<DashboardPage onNavigateTab={handleSelectTab} />} />
            <Route path="/dashboard" element={<DashboardPage onNavigateTab={handleSelectTab} />} />
            <Route path="/budget" element={<BudgetPage />} />
            <Route path="/expenses" element={<ExpensesPage />} />
            <Route path="/accounts" element={<AccountsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/loans" element={<LoansPage />} />
            <Route path="/recurring" element={<RecurringPage />} />
            <Route path="/plan" element={<PlanPage onNavigateTab={handleSelectTab} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
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
      />
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
      <div className="flex h-screen w-full items-center justify-center bg-slate-900 text-emerald-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span className="text-xs font-semibold text-slate-400 tracking-wider uppercase">Loading Budget Buddy...</span>
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

