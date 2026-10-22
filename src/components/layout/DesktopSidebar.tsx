/**
 * Desktop Sidebar Navigation
 * Fixed-width sidebar for desktop viewports providing grouped navigation:
 * - Core Daily & Monthly tabs (Dashboard, Expenses, Budget, Accounts & Net Worth)
 * - Long-Term Plan tabs (Plan Overview, Goals, Loans, Recurring & Policies)
 */

import type { ComponentType } from 'react';
import {
  LayoutDashboard,
  PieChart,
  Receipt,
  Landmark,
  Target,
  CreditCard,
  CalendarClock,
  Compass,
  Wallet,
  Heart,
} from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';

export interface NavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  description?: string;
  section?: 'core' | 'plan';
}

export const NAV_ITEMS: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    description: 'Daily spend check & quick actions',
    section: 'core',
  },
  {
    id: 'expenses',
    label: 'Expenses',
    icon: Receipt,
    description: 'Daily ledger & monthly spend trends',
    section: 'core',
  },
  {
    id: 'budget',
    label: 'Budget',
    icon: PieChart,
    description: 'Spendable caps & CPF waterfall',
    section: 'core',
  },
  {
    id: 'accounts',
    label: 'Accounts & Net Worth',
    icon: Landmark,
    description: 'Month-end balances & asset trends',
    section: 'core',
  },
  {
    id: 'plan',
    label: 'Plan Overview',
    icon: Compass,
    description: 'Unified goals, loans & policies hub',
    section: 'plan',
  },
  {
    id: 'goals',
    label: 'Goals',
    icon: Target,
    description: 'Savings targets & pacing track',
    section: 'plan',
  },
  {
    id: 'loans',
    label: 'Loans',
    icon: CreditCard,
    description: 'HDB mortgage & debt payoff',
    section: 'plan',
  },
  {
    id: 'recurring',
    label: 'Recurring & Policies',
    icon: CalendarClock,
    description: 'Subscriptions, insurance & taxes',
    section: 'plan',
  },
];

export interface DesktopSidebarProps {
  activeTab?: string;
  onSelectTab?: (tab: string) => void;
  className?: string;
}

export function DesktopSidebar({
  activeTab = 'dashboard',
  onSelectTab,
  className = '',
}: DesktopSidebarProps) {
  const { perspective, activeMember, members } = useHousehold();

  const coreItems = NAV_ITEMS.filter((item) => item.section !== 'plan');
  const planItems = NAV_ITEMS.filter((item) => item.section === 'plan');

  const renderNavItem = (item: NavItem) => {
    const Icon = item.icon;
    const isActive = activeTab === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onSelectTab?.(item.id)}
        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-emerald-50 text-emerald-800 shadow-xs dark:bg-emerald-950/40 dark:text-emerald-300 font-semibold'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
        }`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${
            isActive
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-400 dark:text-slate-500'
          }`}
        />
        <div className="flex flex-col text-left truncate">
          <span className="truncate">{item.label}</span>
        </div>
      </button>
    );
  };

  return (
    <aside
      className={`hidden md:flex flex-col w-64 lg:w-68 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shrink-0 transition-colors duration-200 ${className}`}
    >
      {/* Brand Header */}
      <div className="h-16 flex items-center px-5 border-b border-slate-200 dark:border-slate-800 gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-white shadow-md shadow-emerald-500/20">
          <Wallet className="h-4.5 w-4.5" />
        </div>
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5 font-bold text-slate-900 dark:text-white tracking-tight text-sm">
            <span>Budget Buddy</span>
            <Heart className="h-3.5 w-3.5 text-rose-500 fill-rose-500" />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Yi Jia &amp; Rachel
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Sidebar">
        <div className="space-y-1">
          <div className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Daily &amp; Monthly
          </div>
          {coreItems.map(renderNavItem)}
        </div>

        <div className="space-y-1">
          <div className="px-3.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Long-Term Plan
          </div>
          {planItems.map(renderNavItem)}
        </div>
      </nav>

      {/* Household / Perspective Status Footer */}
      <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-1 overflow-hidden">
              <span
                title="Yi Jia"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700 ring-2 ring-white dark:bg-blue-900 dark:text-blue-200 dark:ring-slate-900"
              >
                👨
              </span>
              <span
                title="Rachel"
                className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-100 text-xs text-rose-700 ring-2 ring-white dark:bg-rose-900 dark:text-rose-200 dark:ring-slate-900"
              >
                👩
              </span>
            </div>
            <div className="text-xs">
              <p className="font-medium text-slate-800 dark:text-slate-200">
                {perspective === 'household'
                  ? 'Combined View'
                  : activeMember
                  ? `${activeMember.display_name}'s View`
                  : perspective}
              </p>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                {members.length} Household Members
              </p>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default DesktopSidebar;
