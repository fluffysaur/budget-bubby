/**
 * Mobile Bottom Navigation Bar
 * Fixed navigation bar for mobile viewports with centered Quick Add floating action button (FAB).
 */

import {
  LayoutDashboard,
  PieChart,
  Plus,
  Receipt,
  Landmark,
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
  return (
    <nav
      aria-label="Mobile Navigation"
      className={`md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-lg border-t border-slate-200 dark:bg-slate-900/95 dark:border-slate-800 transition-colors duration-200 ${className}`}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2 relative">
        {/* Tab 1: Dashboard */}
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
          <span className="text-[11px] mt-1">Dashboard</span>
        </button>

        {/* Tab 2: Budget */}
        <button
          type="button"
          onClick={() => onSelectTab?.('budget')}
          aria-label="Budget"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'budget'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <PieChart className="h-5 w-5" />
          <span className="text-[11px] mt-1">Budget</span>
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

        {/* Tab 3: Expenses */}
        <button
          type="button"
          onClick={() => onSelectTab?.('expenses')}
          aria-label="Expenses"
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
            activeTab === 'expenses'
              ? 'text-emerald-600 dark:text-emerald-400 font-semibold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Receipt className="h-5 w-5" />
          <span className="text-[11px] mt-1">Expenses</span>
        </button>

        {/* Tab 4: Accounts */}
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
          <span className="text-[11px] mt-1">Accounts</span>
        </button>
      </div>
    </nav>
  );
}

export default MobileBottomNav;
