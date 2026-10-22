/**
 * PlanPage Component
 * Consolidated 5th navigation hub for Long-Term Financial Planning:
 * - Segmented sub-tabs: Goals | Loans | Recurring | Bonus Calculator
 * - Embeds GoalsPage, LoansPage, RecurringPage, and Bonus calculator seamlessly
 * - Eliminates scattered sidebar links while preserving route compatibility
 */

import { useState, useEffect } from 'react';
import {
  Target,
  CreditCard,
  CalendarClock,
  Sparkles,
} from 'lucide-react';
import { PageHeader } from '../components/ui';
import { GoalsPage } from './GoalsPage';
import { LoansPage } from './LoansPage';
import { RecurringPage } from './RecurringPage';
import { BonusAllocationCollapsible } from '../components/budget/BonusAllocationCollapsible';

export type PlanSubTab = 'goals' | 'loans' | 'recurring' | 'bonus';

export interface PlanPageProps {
  initialTab?: PlanSubTab;
  onNavigateTab?: (tab: string) => void;
  className?: string;
}

const SUB_TABS: { id: PlanSubTab; label: string; icon: typeof Target }[] = [
  { id: 'goals', label: 'Goals', icon: Target },
  { id: 'loans', label: 'Loans & Mortgage', icon: CreditCard },
  { id: 'recurring', label: 'Recurring & Taxes', icon: CalendarClock },
  { id: 'bonus', label: 'Bonus Calculator', icon: Sparkles },
];

export function PlanPage({ initialTab = 'goals', className = '' }: PlanPageProps) {
  const [activeTab, setActiveTab] = useState<PlanSubTab>(initialTab);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  return (
    <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
      {/* Page Header */}
      <PageHeader
        title="Plan"
        subtitle="Savings milestones, mortgage payoff schedule, recurring policies, and bonus allocations"
      />

      {/* Segmented Sub-Tab Bar */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-200/70 dark:bg-slate-800/80 rounded-2xl overflow-x-auto">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Embedded Sub-Tab Content */}
      <div className="pt-1">
        {activeTab === 'goals' && <GoalsPage embedded={true} />}
        {activeTab === 'loans' && <LoansPage embedded={true} />}
        {activeTab === 'recurring' && <RecurringPage embedded={true} />}
        {activeTab === 'bonus' && (
          <div className="space-y-4">
            <BonusAllocationCollapsible defaultOpen={true} />
          </div>
        )}
      </div>
    </div>
  );
}

export default PlanPage;
