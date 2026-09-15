/**
 * Expenses Page
 * Top-level page combining:
 * - Summary metric cards: Total Spent, Shared Spending, and Unsettled / Who Owes Whom
 * - Quick Add Expense modal trigger
 * - Filter bar (search, category, payer, split, month)
 * - Responsive transaction ledger table & mobile cards
 * - Reactive to Household Context perspective
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Receipt,
  Plus,
  ArrowRightLeft,
  Scale,
  CheckCircle2,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getCurrentMonth } from '../lib/dateUtils';
import { calculateSharedExpenseSettlement } from '../lib/financialFormulas';
import { mockCategories, mockMembers } from '../data/mockSeedData';
import { QuickAddExpenseModal } from '../components/expenses/QuickAddExpenseModal';
import { ExpenseFilterBar } from '../components/expenses/ExpenseFilterBar';
import { ExpenseListTable } from '../components/expenses/ExpenseListTable';
import type { Expense, ExpenseFilter } from '../types/finance';

export interface ExpensesPageProps {
  className?: string;
}

export function ExpensesPage({ className = '' }: ExpensesPageProps) {
  const { activeMember, members: ctxMembers, refreshData: refreshHousehold } = useHousehold();

  const members = ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;
  const categories = mockCategories;

  // Filter State
  const [filter, setFilter] = useState<ExpenseFilter>({
    month: getCurrentMonth(),
    search: '',
    categoryId: undefined,
    payerId: undefined,
    isShared: undefined,
  });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Synchronize perspective filter if active member changes
  useEffect(() => {
    if (activeMember) {
      setFilter((prev) => ({ ...prev, payerId: activeMember.id }));
    } else {
      setFilter((prev) => ({ ...prev, payerId: undefined }));
    }
  }, [activeMember]);

  // Load expenses matching current filter
  const loadExpenses = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await financeService.getExpenses(filter);
      setExpenses(data);
    } catch (err) {
      console.error('Failed to load expenses:', err);
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadExpenses();
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
  }, [expenses, members]);

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
            Expenses
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Daily expense ledger and couple splits
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-4 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-600 active:scale-95 transition-all cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[2.5]" />
          <span>+ Add Expense</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Spent */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Total Spent
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              <Receipt className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(totalSpent)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            {expenses.length} transaction{expenses.length === 1 ? '' : 's'} in view
          </p>
        </div>

        {/* Card 2: Shared Spending */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Shared Spending
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400">
              <ArrowRightLeft className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(totalShared)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-400 dark:text-slate-500">
            Default 50/50 couple split
          </p>
        </div>

        {/* Card 3: Unsettled Balance (Who Owes Whom) */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Unsettled / Who Owes Whom
            </span>
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${
                settlement.netBalance === 0
                  ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400'
                  : 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400'
              }`}
            >
              {settlement.netBalance === 0 ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Scale className="h-4 w-4" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              {formatSGD(settlement.netBalance)}
            </span>
          </div>
          <p className="mt-1 text-[11px] font-medium text-slate-600 dark:text-slate-300 truncate">
            {settlement.settlementText}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <ExpenseFilterBar
        filter={filter}
        onFilterChange={setFilter}
        onReset={handleResetFilters}
        categories={categories}
        members={members}
      />

      {/* Expense List Table */}
      <ExpenseListTable
        expenses={expenses}
        categories={categories}
        members={members}
        onDeleteExpense={handleDeleteExpense}
        isLoading={isLoading}
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
