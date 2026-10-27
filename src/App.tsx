/**
 * App.tsx
 * Budget Bubby - Couples Finance & Daily Ledger
 * Root layout and route configuration
 */

import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  Plus,
  LayoutDashboard,
  Wallet,
  Receipt,
  Landmark,
  Compass,
} from 'lucide-react';
import { HouseholdProvider, useHousehold } from './context/HouseholdContext';
import { DesktopSidebar } from './components/navigation/DesktopSidebar';
import { MobileTabBar } from './components/navigation/MobileTabBar';
import { AppHeader } from './components/navigation/AppHeader';
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
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-48" />
        <div className="h-8 bg-slate-200 dark:bg-slate-800 rounded-lg w-28" />
      </div>

      {/* Hero card / 3-column stats skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="h-28 bg-slate-200 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800" />
        <div className="h-28 bg-slate-200 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800" />
        <div className="h-28 bg-slate-200 dark:bg-slate-800/80 rounded-2xl p-4 border border-slate-200/50 dark:border-slate-800 sm:col-span-2 lg:col-span-1" />
      </div>

      {/* Main card placeholder */}
      <div className="h-72 bg-slate-200 dark:bg-slate-800/60 rounded-2xl p-6 border border-slate-200/50 dark:border-slate-800 flex flex-col justify-between">
        <div className="h-6 bg-slate-300 dark:bg-slate-700 rounded w-1/4" />
        <div className="space-y-3">
          <div className="h-4 bg-slate-300 dark:bg-slate-700/60 rounded w-full" />
          <div className="h-4 bg-slate-300 dark:bg-slate-700/60 rounded w-5/6" />
          <div className="h-4 bg-slate-300 dark:bg-slate-700/40 rounded w-4/6" />
        </div>
        <div className="h-4 bg-slate-300 dark:bg-slate-700/40 rounded w-1/3" />
      </div>
    </div>
  );
}

function AppLayoutInner() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentMember, members, categories } = useHousehold();

  // Quick-Add modal open state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);

  // Success celebration state
  const [loggedExpense, setLoggedExpense] = useState<Expense | null>(null);
  const [loggedCategory, setLoggedCategory] = useState<Category | undefined>(undefined);

  // Keyboard shortcut listener: 'c' opens Quick-Add
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if typing in an input, textarea, or contentEditable element
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        setIsQuickAddOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Determine active tab identifier from pathname
  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/' || path.startsWith('/dashboard')) return 'dashboard';
    if (path.startsWith('/budget')) return 'budget';
    if (path.startsWith('/expenses') || path.startsWith('/fast-log')) return 'expenses';
    if (path.startsWith('/accounts')) return 'accounts';
    if (
      path.startsWith('/plan') ||
      path.startsWith('/goals') ||
      path.startsWith('/loans') ||
      path.startsWith('/recurring')
    )
      return 'plan';
    return 'dashboard';
  };

  const handleSelectTab = (tabId: string) => {
    switch (tabId) {
      case 'dashboard':
        navigate('/dashboard');
        break;
      case 'budget':
        navigate('/budget');
        break;
      case 'expenses':
        navigate('/expenses');
        break;
      case 'accounts':
        navigate('/accounts');
        break;
      case 'plan':
        navigate('/plan');
        break;
      default:
        navigate('/');
    }
  };

  const handleExpenseAdded = (expense: Expense) => {
    // Locate the matching category for celebration modal icon/name
    const cat = categories.find((c) => c.id === expense.category_id);
    setLoggedExpense(expense);
    setLoggedCategory(cat);

    // Dispatch global event so pages can auto-refresh
    window.dispatchEvent(new CustomEvent('expenseAdded', { detail: expense }));
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 font-sans text-slate-900 antialiased dark:bg-slate-900 dark:text-slate-100">
      {/* Offline sync status and offline indicator banner */}
      <OfflineBanner />

      {/* PWA Update Ready Prompt Toast */}
      <PWAUpdateToast />

      {/* Desktop Fixed Sidebar */}
      <DesktopSidebar
        activeTab={getActiveTab()}
        onSelectTab={handleSelectTab}
        onQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top App Header with Member Switcher & Biometrics */}
        <AppHeader onQuickAdd={() => setIsQuickAddOpen(true)} />

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

      {/* Floating Action Button (FAB) on Mobile */}
      <div className="fixed bottom-20 right-4 z-40 md:hidden">
        <button
          onClick={() => setIsQuickAddOpen(true)}
          aria-label="Add expense"
          className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-600 text-white shadow-xl hover:bg-emerald-700 active:scale-95 transition-transform focus:outline-none focus:ring-4 focus:ring-emerald-500/30"
        >
          <Plus className="h-7 w-7 stroke-[2.5]" />
        </button>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <MobileTabBar
        activeTab={getActiveTab()}
        onSelectTab={handleSelectTab}
        onQuickAdd={() => setIsQuickAddOpen(true)}
      />

      {/* Quick Add Expense Modal */}
      <QuickAddExpenseModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onExpenseAdded={handleExpenseAdded}
        categories={categories}
        members={members}
        defaultPayerId={currentMember?.id}
      />

      {/* Celebration animation modal */}
      {loggedExpense && (
        <ExpenseSuccessCelebration
          isOpen={!!loggedExpense}
          onClose={() => setLoggedExpense(null)}
          expense={loggedExpense}
          category={loggedCategory}
        />
      )}
    </div>
  );
}

export function App() {
  return (
    <HouseholdProvider>
      <Router>
        <AppLayoutInner />
      </Router>
    </HouseholdProvider>
  );
}

export default App;
