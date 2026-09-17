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
 */
export function AppShell() {
  const optionalContext = useOptionalHousehold();
  if (!optionalContext) {
    return (
      <HouseholdProvider>
        <AppLayoutInner />
      </HouseholdProvider>
    );
  }
  return <AppLayoutInner />;
}

export interface AppProps {
  initialEntries?: string[];
}

/**
 * Root App component.
 * Uses MemoryRouter when initialEntries is provided (ideal for testing),
 * otherwise defaults to BrowserRouter for production web apps.
 */
export function App({ initialEntries }: AppProps = {}) {
  const RouterComponent = initialEntries ? MemoryRouter : BrowserRouter;
  const routerProps = initialEntries ? { initialEntries } : {};

  return (
    <RouterComponent {...routerProps}>
      <AppShell />
    </RouterComponent>
  );
}

export default App;

