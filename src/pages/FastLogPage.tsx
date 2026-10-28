/**
 * FastLogPage
 * Dedicated standalone page / PWA shortcut route for 1-tap fast logging.
 */

import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap } from 'lucide-react';
import { FastLogWidget } from '../components/expenses/FastLogWidget';
import { useHousehold } from '../context/HouseholdContext';
import { useCategoriesQuery } from '../hooks/useFinanceQueries';

export interface FastLogPageProps {
  onNavigateTab?: (tabId: string) => void;
}

export function FastLogPage({ onNavigateTab }: FastLogPageProps) {
  const navigate = useNavigate();
  const { members, activeMember, refreshData } = useHousehold();
  const { data: categoriesData } = useCategoriesQuery();
  const categories = categoriesData || [];

  return (
    <div className="mx-auto max-w-md py-4 px-2 sm:px-0">
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            if (onNavigateTab) {
              onNavigateTab('expenses');
            } else {
              navigate('/expenses');
            }
          }}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Ledger</span>
        </button>

        <span className="flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
          <Zap className="h-3.5 w-3.5 fill-current" />
          <span>PWA Quick Log</span>
        </span>
      </div>

      <FastLogWidget
        categories={categories}
        members={members}
        defaultPayerId={activeMember?.id}
        onExpenseLogged={() => {
          refreshData();
        }}
      />
    </div>
  );
}

export default FastLogPage;
