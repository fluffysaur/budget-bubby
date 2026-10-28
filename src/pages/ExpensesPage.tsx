/**
 * Expenses Page
 * Minimal, Ledger-First Spend Hub:
 * - PageHeader with '+ Bulk Log' and 'Add Expense'
 * - Compact 3-metric summary strip: Total Spent, Shared Spending, and Unsettled / Who Owes Whom
 * - Mobile-friendly collapsible filter bar & responsive transaction ledger table right at the top
 * - Collapsible Spend Trends & Tags drawers below the ledger
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Receipt,
  Plus,
  ArrowRightLeft,
  Scale,
  CheckCircle2,
  Filter,
  ChevronDown,
  ChevronUp,
  Tag,
  FileSpreadsheet,
  BarChart3,
  PiggyBank,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, StatCard, CollapsibleSection } from '../components/ui';
import {
  useExpensesQuery,
  useAllExpensesQuery,
  usePoliciesQuery,
  useCategoriesQuery,
  useGoalsQuery,
  useBaseProfilesQuery,
  useBaseAllocationsQuery,
} from '../hooks/useFinanceQueries';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getCurrentMonth } from '../lib/dateUtils';
import {
  calculateSharedExpenseSettlement,
  calculateExpenseTrendsSummary,
  calculateSpendablePacing,
  detectUnspentMonthEndSurplus,
} from '../lib/financialFormulas';
import { mockCategories, mockMembers, mockBaseProfiles, mockBaseAllocations } from '../data/mockSeedData';
import { QuickAddExpenseModal } from '../components/expenses/QuickAddExpenseModal';
import { BulkAddExpenseModal } from '../components/expenses/BulkAddExpenseModal';
import { ExpenseFilterBar } from '../components/expenses/ExpenseFilterBar';
import { ExpenseListTable } from '../components/expenses/ExpenseListTable';
import { ExpenseTrendsCard } from '../components/expenses/ExpenseTrendsCard';
import { SpendTagsOverviewCard } from '../components/expenses/SpendTagsOverviewCard';
import { MonthEndSweepBanner } from '../components/budget/MonthEndSweepBanner';
import { SurplusSweepModal, type SurplusSweepAllocation } from '../components/budget/SurplusSweepModal';
import { BankSurplusModal } from '../components/budget/BankSurplusModal';
import type { ExpenseFilter } from '../types/finance';

export interface ExpensesPageProps {
  className?: string;
  embedded?: boolean;
}

export function ExpensesPage({ className = '', embedded = false }: ExpensesPageProps) {
  const {
    perspective,
    overview,
    activeMember,
    members: ctxMembers,
    refreshData: refreshHousehold,
  } = useHousehold();

  const members = ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;

  // Filter State
  const [filter, setFilter] = useState<ExpenseFilter>({
    month: getCurrentMonth(),
    search: '',
    categoryId: undefined,
    payerId: undefined,
    isShared: undefined,
  });

  // Synchronize perspective filter if active member changes
  useEffect(() => {
    if (activeMember) {
      setFilter((prev) => ({ ...prev, payerId: activeMember.id }));
    } else {
      setFilter((prev) => ({ ...prev, payerId: undefined }));
    }
  }, [activeMember]);

  // TanStack Query Cached Data Hooks
  const { data: expensesData, isLoading: expensesLoading } = useExpensesQuery(filter);
  const { data: allExpensesData } = useAllExpensesQuery();
  const { data: policiesData } = usePoliciesQuery();
  const { data: categoriesData } = useCategoriesQuery();
  const { data: goalsData } = useGoalsQuery();
  const { data: baseProfilesData } = useBaseProfilesQuery();
  const { data: baseAllocationsData } = useBaseAllocationsQuery();

  const expenses = useMemo(() => expensesData || [], [expensesData]);
  const allExpenses = useMemo(() => allExpensesData || expensesData || [], [allExpensesData, expensesData]);
  const policies = useMemo(() => policiesData || [], [policiesData]);
  const categories = useMemo(
    () => (categoriesData && categoriesData.length > 0 ? categoriesData : mockCategories),
    [categoriesData],
  );
  const goals = useMemo(() => goalsData || [], [goalsData]);
  const baseProfiles = useMemo(
    () => (baseProfilesData && baseProfilesData.length > 0 ? baseProfilesData : mockBaseProfiles),
    [baseProfilesData],
  );
  const baseAllocations = useMemo(
    () => (baseAllocationsData && baseAllocationsData.length > 0 ? baseAllocationsData : mockBaseAllocations),
    [baseAllocationsData],
  );
  const isLoading = expensesLoading && !expensesData;

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState<boolean>(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Month-end Sweep Modal State
  const [isSweepModalOpen, setIsSweepModalOpen] = useState<boolean>(false);
  const [sweepMonth, setSweepMonth] = useState<string>('');
  const [sweepAmount, setSweepAmount] = useState<number>(0);
  const [isBankSurplusModalOpen, setIsBankSurplusModalOpen] = useState<boolean>(false);
  const [dismissedSweepMonth, setDismissedSweepMonth] = useState<string | null>(() => {
    try {
      return localStorage.getItem('budget_bubby_dismissed_sweep');
    } catch {
      return null;
    }
  });

  const handleOpenSweep = (month: string, amount: number) => {
    setSweepMonth(month);
    setSweepAmount(amount);
    setIsSweepModalOpen(true);
  };

  const handleOpenBankSurplus = (month: string, amount: number) => {
    setSweepMonth(month);
    setSweepAmount(amount);
    setIsBankSurplusModalOpen(true);
  };

  const handleDismissSweep = (month: string) => {
    setDismissedSweepMonth(month);
    try {
      localStorage.setItem('budget_bubby_dismissed_sweep', month);
    } catch {}
  };

  const handleConfirmBankSurplus = () => {
    if (sweepMonth) {
      handleDismissSweep(sweepMonth);
    }
  };

  const handleSweepComplete = async (allocations: SurplusSweepAllocation[]) => {
    for (const alloc of allocations) {
      const goal = goals.find((g) => g.id === alloc.goalId);
      if (goal) {
        await financeService.updateGoal(goal.id, {
          saved_so_far: Math.round((goal.saved_so_far + alloc.amount) * 100) / 100,
        });
      }
    }
    await refreshHousehold();
    if (sweepMonth) {
      handleDismissSweep(sweepMonth);
    }
  };

  // Handle adding an expense
  const handleExpenseAdded = async () => {
    await refreshHousehold();
  };

  // Handle deleting an expense
  const handleDeleteExpense = async (id: string) => {
    try {
      await financeService.deleteExpense(id);
      await refreshHousehold();
    } catch (err) {
      console.error('Failed to delete expense:', err);
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setFilter({
      month: getCurrentMonth(),
      search: '',
      categoryId: undefined,
      payerId: activeMember ? activeMember.id : undefined,
      isShared: undefined,
      tag: undefined,
    });
  };

  // Metrics Calculations
  const totalSpent = useMemo(() => {
    const sum = expenses.reduce((acc, exp) => acc + exp.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [expenses]);

  const totalShared = useMemo(() => {
    const sum = expenses
      .filter((exp) => exp.is_shared)
      .reduce((acc, exp) => acc + exp.amount, 0);
    return Math.round(sum * 100) / 100;
  }, [expenses]);

  // Unsettled Settlement Calculation
  const settlement = useMemo(() => {
    if (overview?.settlementSummary) {
      return overview.settlementSummary;
    }

    const m1 = members[0];
    const m2 = members[1];
    if (!m1 || !m2) {
      return {
        netBalance: 0,
        debtorId: null,
        creditorId: null,
        settlementText: 'All settled up',
        member1OwesMember2: 0,
        member2OwesMember1: 0,
      };
    }

    return calculateSharedExpenseSettlement(
      expenses,
      m1.id,
      m2.id,
      m1.display_name,
      m2.display_name
    );
  }, [overview, expenses, members]);

  // Historical Expense Trends Calculation (6-month rolling averages & category benchmarks)
  const trendsSummary = useMemo(() => {
    const trendsSource = allExpenses && allExpenses.length > 0 ? allExpenses : expenses;
    return calculateExpenseTrendsSummary(
      trendsSource,
      categories,
      policies,
      perspective,
      activeMember?.id,
      filter.month || getCurrentMonth(),
      6
    );
  }, [allExpenses, expenses, categories, policies, perspective, activeMember, filter.month]);

  // Spendable Budget Pacing Calculation (Dynamically adjusts daily pace & tracks monthly limits)
  const spendablePacing = useMemo(() => {
    return calculateSpendablePacing({
      month: filter.month || getCurrentMonth(),
      memberId: activeMember?.id,
      perspective,
      expenses: allExpenses && allExpenses.length > 0 ? allExpenses : expenses,
      categories,
      baseProfiles,
      baseAllocations,
    });
  }, [filter.month, activeMember, perspective, allExpenses, expenses, categories, baseProfiles, baseAllocations]);

  // Check unspent surplus from the prior month
  const unspentSurplusInfo = useMemo(() => {
    return detectUnspentMonthEndSurplus({
      currentMonth: getCurrentMonth(),
      memberId: activeMember?.id,
      perspective,
      expenses: allExpenses && allExpenses.length > 0 ? allExpenses : expenses,
      categories,
      baseProfiles,
      baseAllocations,
    });
  }, [activeMember, perspective, allExpenses, expenses, categories, baseProfiles, baseAllocations]);

  const showSweepBanner =
    unspentSurplusInfo.hasUnspentSurplus &&
    dismissedSweepMonth !== unspentSurplusInfo.lastMonth &&
    (!filter.month || filter.month === getCurrentMonth());

  // Active filter count for mobile indicator
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filter.search) count++;
    if (filter.categoryId) count++;
    if (filter.payerId && perspective === 'household') count++;
    if (filter.isShared !== undefined) count++;
    if (filter.month !== getCurrentMonth()) count++;
    if (filter.tag) count++;
    return count;
  }, [filter, perspective]);

  return (
    <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
      {/* Header Section */}
      {!embedded ? (
        <PageHeader
          title="Expenses"
          actions={
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                aria-label="+ Bulk Log"
                className="w-full sm:w-auto"
                leftIcon={<FileSpreadsheet className="h-4 w-4 stroke-[2.2] text-emerald-600" />}
                onClick={() => setIsBulkAddOpen(true)}
              >
                Bulk Log
              </Button>
              <Button
                variant="primary"
                aria-label="+ Add Expense"
                className="hidden md:inline-flex"
                leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
                onClick={() => setIsModalOpen(true)}
              >
                Add Expense
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="secondary"
            size="sm"
            aria-label="+ Bulk Log"
            className="w-full sm:w-auto"
            leftIcon={<FileSpreadsheet className="h-3.5 w-3.5 stroke-[2.2] text-emerald-600" />}
            onClick={() => setIsBulkAddOpen(true)}
          >
            Bulk Log
          </Button>
          <Button
            variant="primary"
            size="sm"
            aria-label="+ Add Expense"
            className="hidden md:inline-flex"
            leftIcon={<Plus className="h-3.5 w-3.5 stroke-[2.5]" />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Expense
          </Button>
        </div>
      )}

      {/* Celebratory Month-End Sweep Notification Banner */}
      {showSweepBanner && (
        <MonthEndSweepBanner
          month={unspentSurplusInfo.lastMonth}
          surplusAmount={unspentSurplusInfo.surplusAmount}
          onSweepClick={() =>
            handleOpenSweep(
              unspentSurplusInfo.lastMonth,
              unspentSurplusInfo.surplusAmount
            )
          }
          onBankSurplusClick={() =>
            handleOpenBankSurplus(
              unspentSurplusInfo.lastMonth,
              unspentSurplusInfo.surplusAmount
            )
          }
        />
      )}

      {/* 4-Metric Summary Strip: Spendable Remaining, Total Spent, Shared Spending, and Unsettled */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Spendable Remaining (Primary Card) */}
        <StatCard
          title="Spendable Remaining"
          value={formatSGD(spendablePacing.spendableRemaining)}
          subtitle={
            spendablePacing.isCurrentMonth
              ? `${formatSGD(spendablePacing.dynamicDailyPace)}/day (${spendablePacing.daysRemaining} days left)`
              : spendablePacing.spendableRemaining >= 0
              ? `Ended with +${formatSGD(spendablePacing.spendableRemaining)} surplus`
              : `Ended with -${formatSGD(Math.abs(spendablePacing.spendableRemaining))} deficit`
          }
          tooltip="Remaining allowance for day-to-day spendable categories (Food, Lifestyle, Transport, Buffer). Excludes goal-funded purchases. In personal view, shared expenses count at your 50% share."
          icon={<PiggyBank className="h-4 w-4" />}
          iconBg={
            spendablePacing.pacingStatus === 'safe'
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              : spendablePacing.pacingStatus === 'warning'
              ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              : 'bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400'
          }
          footer={
            <div className="space-y-1.5 mt-1">
              <div className="flex items-center justify-between text-[11px] text-(--text-muted) font-medium">
                <span>Spent {formatSGD(spendablePacing.spendableSpent)}</span>
                <span>Limit {formatSGD(spendablePacing.spendableAllocated)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800 border border-(--border-subtle)">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    spendablePacing.pacingStatus === 'exceeded'
                      ? 'bg-rose-500'
                      : spendablePacing.pacingStatus === 'warning'
                      ? 'bg-amber-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, spendablePacing.progressPercent)}%` }}
                />
              </div>
              {!spendablePacing.isCurrentMonth && spendablePacing.spendableRemaining > 0 && (
                <button
                  type="button"
                  onClick={() =>
                    handleOpenSweep(
                      filter.month || unspentSurplusInfo.lastMonth,
                      spendablePacing.spendableRemaining
                    )
                  }
                  className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 cursor-pointer pt-0.5"
                >
                  <span>Sweep {formatSGD(spendablePacing.spendableRemaining)} to Goals →</span>
                </button>
              )}
            </div>
          }
        />

        {/* Card 2: Total Spent */}
        <StatCard
          title="Total Spent"
          value={formatSGD(totalSpent)}
          subtitle={`${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`}
          icon={<Receipt className="h-4 w-4" />}
          iconBg="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        />

        {/* Card 3: Shared Spending */}
        <StatCard
          title="Shared Spending"
          value={formatSGD(totalShared)}
          tooltip="Shared couple expenses split 50/50 by default unless a custom ratio is set."
          icon={<ArrowRightLeft className="h-4 w-4" />}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        {/* Card 4: Unsettled Balance (Who Owes Whom) */}
        <StatCard
          title="Unsettled Balance"
          value={formatSGD(settlement.netBalance)}
          subtitle={settlement.settlementText}
          icon={settlement.netBalance === 0 ? <CheckCircle2 className="h-4 w-4" /> : <Scale className="h-4 w-4" />}
          iconBg={
            settlement.netBalance === 0
              ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
              : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
          }
        />
      </div>

      {/* Mobile Filter Toggle Button */}
      <div className="sm:hidden flex items-center justify-between">
        <button
          type="button"
          onClick={() => setIsMobileFilterOpen((prev) => !prev)}
          className="inline-flex items-center gap-2 rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) px-3.5 py-2 text-xs font-bold text-(--text-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
        >
          <Filter className="h-3.5 w-3.5 text-purple-700 dark:text-purple-300" />
          <span>Filter &amp; Search</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--pastel-lilac) border border-(--border-ink) text-[10px] font-black text-(--text-ink)">
              {activeFilterCount}
            </span>
          )}
          {isMobileFilterOpen ? (
            <ChevronUp className="h-4 w-4 text-(--text-muted) ml-1.5" strokeWidth={2.5} />
          ) : (
            <ChevronDown className="h-4 w-4 text-(--text-muted) ml-1.5" strokeWidth={2.5} />
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Filter Bar (Collapsible on mobile, always visible on tablet/desktop) */}
      <div className={`${isMobileFilterOpen ? 'block' : 'hidden sm:block'}`}>
        <ExpenseFilterBar
          filter={filter}
          onFilterChange={setFilter}
          onReset={handleResetFilters}
          categories={categories}
          members={members}
        />
      </div>

      {/* Expense List Table (Ledger-First!) */}
      <ExpenseListTable
        expenses={expenses}
        categories={categories}
        members={members}
        goals={goals}
        onDeleteExpense={handleDeleteExpense}
        onExpenseSaved={handleExpenseAdded}
        isLoading={isLoading}
      />

      {/* Collapsible Secondary Drawers: Spend Trends & Tags */}
      <div className="space-y-3 pt-2">
        <CollapsibleSection
          title="Monthly Spend Trends & Averages"
          summaryRight={`3-mo avg: ${formatSGD(trendsSummary.rolling3MonthAvg)}`}
          icon={<BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />}
          defaultOpen={false}
        >
          <ExpenseTrendsCard
            trends={trendsSummary}
            perspectiveLabel={
              perspective === 'household'
                ? 'Household'
                : activeMember?.display_name || 'Personal'
            }
          />
        </CollapsibleSection>

        <CollapsibleSection
          title="Spend Tags & Trip Breakdown"
          badge={
            filter.tag ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                #{filter.tag}
              </span>
            ) : undefined
          }
          icon={<Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
          defaultOpen={Boolean(filter.tag)}
        >
          <SpendTagsOverviewCard
            expenses={allExpenses && allExpenses.length > 0 ? allExpenses : expenses}
            categories={categories}
            activeTag={filter.tag}
            onSelectTag={(tag) => setFilter((prev) => ({ ...prev, tag: prev.tag === tag ? undefined : tag }))}
            onClearTag={() => setFilter((prev) => ({ ...prev, tag: undefined }))}
          />
        </CollapsibleSection>
      </div>

      {/* Bulk Add Expense Modal */}
      <BulkAddExpenseModal
        isOpen={isBulkAddOpen}
        onClose={() => setIsBulkAddOpen(false)}
        onExpensesAdded={handleExpenseAdded}
        categories={categories}
        members={members}
        goals={goals}
        defaultPayerId={filter.payerId}
      />

      {/* Quick Add Expense Modal */}
      <QuickAddExpenseModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onExpenseAdded={handleExpenseAdded}
        defaultPayerId={filter.payerId}
        categories={categories}
        members={members}
        goals={goals}
      />

      {/* Month-End Surplus Sweep to Goals Modal */}
      <SurplusSweepModal
        isOpen={isSweepModalOpen}
        onClose={() => setIsSweepModalOpen(false)}
        surplusAmount={sweepAmount}
        month={sweepMonth}
        goals={goals}
        onSweepComplete={handleSweepComplete}
      />

      {/* Bank as Surplus Confirmation Modal */}
      <BankSurplusModal
        isOpen={isBankSurplusModalOpen}
        onClose={() => setIsBankSurplusModalOpen(false)}
        surplusAmount={sweepAmount}
        month={sweepMonth}
        onConfirm={handleConfirmBankSurplus}
      />
    </div>
  );
}

export default ExpensesPage;
