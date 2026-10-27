/**
 * Expenses Page
 * Minimal, Ledger-First Spend Hub:
 * - PageHeader with '+ Bulk Log' and 'Add Expense'
 * - Compact 3-metric summary strip: Total Spent, Shared Spending, and Unsettled / Who Owes Whom
 * - Mobile-friendly collapsible filter bar & responsive transaction ledger table right at the top
 * - Collapsible Spend Trends & Tags drawers below the ledger
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
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
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, StatCard, CollapsibleSection } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getCurrentMonth } from '../lib/dateUtils';
import {
  calculateSharedExpenseSettlement,
  calculateExpenseTrendsSummary,
} from '../lib/financialFormulas';
import { mockCategories, mockMembers } from '../data/mockSeedData';
import { QuickAddExpenseModal } from '../components/expenses/QuickAddExpenseModal';
import { BulkAddExpenseModal } from '../components/expenses/BulkAddExpenseModal';
import { ExpenseFilterBar } from '../components/expenses/ExpenseFilterBar';
import { ExpenseListTable } from '../components/expenses/ExpenseListTable';
import { ExpenseTrendsCard } from '../components/expenses/ExpenseTrendsCard';
import { SpendTagsOverviewCard } from '../components/expenses/SpendTagsOverviewCard';
import type { Expense, ExpenseFilter, RecurringPolicy, Category } from '../types/finance';

export interface ExpensesPageProps {
  className?: string;
}

export function ExpensesPage({ className = '' }: ExpensesPageProps) {
  const {
    perspective,
    overview,
    activeMember,
    members: ctxMembers,
    refreshData: refreshHousehold,
  } = useHousehold();

  const members = ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;
  const [categories, setCategories] = useState<Category[]>(mockCategories);

  // Filter State
  const [filter, setFilter] = useState<ExpenseFilter>({
    month: getCurrentMonth(),
    search: '',
    categoryId: undefined,
    payerId: undefined,
    isShared: undefined,
  });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [allExpenses, setAllExpenses] = useState<Expense[]>([]);
  const [policies, setPolicies] = useState<RecurringPolicy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isBulkAddOpen, setIsBulkAddOpen] = useState<boolean>(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState<boolean>(false);

  // Synchronize perspective filter if active member changes
  useEffect(() => {
    if (activeMember) {
      setFilter((prev) => ({ ...prev, payerId: activeMember.id }));
    } else {
      setFilter((prev) => ({ ...prev, payerId: undefined }));
    }
  }, [activeMember]);

  // Load expenses matching current filter and policies for trends
  const loadExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const [data, fullData, policiesData, categoriesData] = await Promise.all([
        financeService.getExpenses(filter),
        financeService.getExpenses(),
        financeService.getPolicies(),
        financeService.getCategories(),
      ]);
      setExpenses(data || []);
      setAllExpenses(fullData || data || []);
      setPolicies(policiesData || []);
      if (categoriesData && categoriesData.length > 0) {
        setCategories(categoriesData);
      }
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadExpenses();
  }, [loadExpenses]);

  useEffect(() => {
    const handleExpenseAddedEvent = () => {
      loadExpenses();
    };
    window.addEventListener('expenseAdded', handleExpenseAddedEvent);
    return () => window.removeEventListener('expenseAdded', handleExpenseAddedEvent);
  }, [loadExpenses]);

  // Handle adding an expense
  const handleExpenseAdded = async () => {
    await loadExpenses();
    await refreshHousehold();
  };

  // Handle deleting an expense
  const handleDeleteExpense = async (id: string) => {
    try {
      await financeService.deleteExpense(id);
      await loadExpenses();
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
      <PageHeader
        title="Expenses"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              aria-label="+ Bulk Log"
              leftIcon={<FileSpreadsheet className="h-4 w-4 stroke-[2.2] text-emerald-600" />}
              onClick={() => setIsBulkAddOpen(true)}
            >
              Bulk Log
            </Button>
            <Button
              variant="primary"
              aria-label="+ Add Expense"
              leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
              onClick={() => setIsModalOpen(true)}
            >
              Add Expense
            </Button>
          </div>
        }
      />

      {/* Compact 3-Metric Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        {/* Card 1: Total Spent */}
        <StatCard
          title="Total Spent"
          value={formatSGD(totalSpent)}
          subtitle={`${expenses.length} transaction${expenses.length === 1 ? '' : 's'}`}
          icon={<Receipt className="h-4 w-4" />}
          iconBg="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        />

        {/* Card 2: Shared Spending */}
        <StatCard
          title="Shared Spending"
          value={formatSGD(totalShared)}
          tooltip="Shared couple expenses split 50/50 by default unless a custom ratio is set."
          icon={<ArrowRightLeft className="h-4 w-4" />}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        {/* Card 3: Unsettled Balance (Who Owes Whom) */}
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
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs active:bg-slate-50 cursor-pointer"
        >
          <Filter className="h-3.5 w-3.5 text-emerald-600" />
          <span>Filter &amp; Search</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
          {isMobileFilterOpen ? (
            <ChevronUp className="h-3.5 w-3.5 text-slate-400 ml-1" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-slate-400 ml-1" />
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-semibold text-rose-600 dark:text-rose-400 hover:underline cursor-pointer"
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
      />
    </div>
  );
}

export default ExpensesPage;
