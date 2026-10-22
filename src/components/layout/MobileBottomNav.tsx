/**
 * Mobile Bottom Navigation Bar
 * Fixed 4-tab navigation bar for mobile viewports with centered Quick Add floating action button (FAB):
 * 1. Home (Dashboard)
 * 2. Spend (Expenses & Budget)
 * +  Quick Add Expense (FAB)
 * 3. Balances (Accounts & Net Worth)
 * 4. Plan (Goals, Loans & Policies)
 */

import {
  LayoutDashboard,
  Plus,
  Receipt,
  Landmark,
  Compass,
} from 'lucide-react';

export interface MobileBottomNavProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  onQuickAdd?: () => void;
  className?: string;
}

export function MobileBottomNav({
  activeTab = 'dashboard',
  onSelectTab,
  onQuickAdd,
  className = '',
}: MobileBottomNavProps) {
  const isSpendActive = activeTab === 'expenses' || activeTab === 'budget';
  const isPlanActive = ['plan', 'goals', 'loans', 'recurring'].includes(activeTab);

  return (
    <nav
      aria-label="Mobile Navigation"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 transition-colors duration-200 ${className}`}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2 relative">
        {/* Tab 1: Home / Dashboard */}
        <button
          type="button"
          onClick={() => onSelectTab?.('dashboard')}
          aria-label="Dashboard"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'dashboard'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-5 w-5" />
          <span className="text-[11px] mt-1">Home</span>
        </button>

        {/* Tab 2: Spend & Budget */}
        <button
          type="button"
          onClick={() => onSelectTab?.('expenses')}
          aria-label="Expenses"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isSpendActive
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="h-5 w-5" />
          <span className="text-[11px] mt-1">Spend</span>
        </button>

        {/* Center Floating Quick Add Action (FAB) */}
        <div className="flex flex-col items-center justify-center flex-1 -mt-5">
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Quick Add"
            className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-500/30 hover:scale-105 active:scale-95 transition-transform focus:outline-none focus:ring-4 focus:ring-emerald-500/20"
          >
            <Plus className="h-6 w-6 stroke-[2.5]" />
          </button>
          <span className="text-[10px] mt-0.5 text-slate-500 font-medium dark:text-slate-400">
            Quick Add
          </span>
        </div>

        {/* Tab 3: Balances & Net Worth */}
        <button
          type="button"
          onClick={() => onSelectTab?.('accounts')}
          aria-label="Accounts"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'accounts'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Landmark className="h-5 w-5" />
          <span className="text-[11px] mt-1">Balances</span>
        </button>

        {/* Tab 4: Plan (Goals, Loans, Recurring) */}
        <button
          type="button"
          onClick={() => onSelectTab?.('plan')}
          aria-label="Plan"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            isPlanActive
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Compass className="h-5 w-5" />
          <span className="text-[11px] mt-1">Plan</span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
