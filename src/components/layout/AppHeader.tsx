/**
 * Responsive Application Header
 * Features:
 * - Perspective pills: Combined Household / Yi Jia / Rachel
 * - Currency indicator: SGD S$
 * - Connection status: Demo Mock vs Live Supabase
 * - Theme toggle: Light / Dark mode
 */

import { Sun, Moon, Users, User, Coins, Plus } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';

export interface AppHeaderProps {
  className?: string;
  onOpenQuickAdd?: () => void;
}

export function AppHeader({ className = '', onOpenQuickAdd }: AppHeaderProps) {
  const {
    perspective,
    setPerspective,
    members,
    theme,
    toggleTheme,
    isMockMode,
  } = useHousehold();

  // Find partner display names from members or fallbacks
  const yiJiaMember = members.find((m) =>
    m.display_name.toLowerCase().includes('yi jia')
  );
  const rachelMember = members.find((m) =>
    m.display_name.toLowerCase().includes('rachel')
  );

  const yiJiaName = yiJiaMember ? yiJiaMember.display_name : 'Yi Jia';
  const rachelName = rachelMember ? rachelMember.display_name : 'Rachel';

  return (
    <header
      className={`sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/95 ${className}`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Left / Center: Perspective Pills */}
        <div className="flex items-center space-x-1 sm:space-x-2">
          <nav
            aria-label="Perspective Switcher"
            className="flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
          >
            {/* Combined Household */}
            <button
              type="button"
              onClick={() => setPerspective('household')}
              aria-pressed={perspective === 'household'}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:text-sm ${
                perspective === 'household'
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Users className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>Combined Household</span>
            </button>

            {/* Yi Jia */}
            <button
              type="button"
              onClick={() => setPerspective('yijia')}
              aria-pressed={perspective === 'yijia'}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:text-sm ${
                perspective === 'yijia'
                  ? 'bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{yiJiaName}</span>
            </button>

            {/* Rachel */}
            <button
              type="button"
              onClick={() => setPerspective('rachel')}
              aria-pressed={perspective === 'rachel'}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all sm:px-3 sm:text-sm ${
                perspective === 'rachel'
                  ? 'bg-white text-rose-700 shadow-sm dark:bg-slate-700 dark:text-rose-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>{rachelName}</span>
            </button>
          </nav>
        </div>

        {/* Right: Badges, Quick Add & Theme Toggle */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Quick Add Button (Desktop optional trigger) */}
          {onOpenQuickAdd && (
            <button
              type="button"
              onClick={onOpenQuickAdd}
              aria-label="Quick Add"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Expense</span>
            </button>
          )}

          {/* Currency Badge */}
          <div
            title="Household Currency: Singapore Dollar"
            className="hidden items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 sm:flex dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
          >
            <Coins className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>SGD S$</span>
          </div>

          {/* Connection Status Badge */}
          <div
            title={
              isMockMode
                ? 'Running with local mock seed data'
                : 'Connected to live Supabase backend'
            }
            className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium ${
              isMockMode
                ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/30 dark:text-emerald-300'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                isMockMode ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="hidden sm:inline">
              {isMockMode ? 'Demo Mock' : 'Live Supabase'}
            </span>
            <span className="sm:hidden">{isMockMode ? 'Mock' : 'Live'}</span>
          </div>

          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={`Toggle theme (currently ${theme})`}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-amber-400" />
            ) : (
              <Moon className="h-4 w-4 text-slate-600" />
            )}
          </button>
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
