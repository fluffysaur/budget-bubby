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
  Users,
  User,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, StatCard, Badge } from '../components/ui';
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
  const {
    perspective,
    overview,
    activeMember,
    members: ctxMembers,
    refreshData: refreshHousehold,
  } = useHousehold();

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
  // Uses global household overview settlementSummary so that filtering by
  // category, payer, search, etc. in the ledger table does not distort the true balance.
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

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Header Section */}
      <PageHeader
        title="Expenses"
        badge={
          <Badge
            variant={perspective === 'household' ? 'emerald' : 'blue'}
            icon={perspective === 'household' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
          >
            {perspective === 'household' ? 'Combined' : activeMember?.display_name || perspective}
          </Badge>
        }
        subtitle="Daily expense ledger and couple splits"
        actions={
          <Button
            variant="primary"
            aria-label="+ Add Expense"
            leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
            onClick={() => setIsModalOpen(true)}
          >
            Add Expense
          </Button>
        }
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Total Spent */}
        <StatCard
          title="Total Spent"
          value={formatSGD(totalSpent)}
          subtitle={`${expenses.length} transaction${expenses.length === 1 ? '' : 's'} in view`}
          icon={<Receipt className="h-4 w-4" />}
          iconBg="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
        />

        {/* Card 2: Shared Spending */}
        <StatCard
          title="Shared Spending"
          value={formatSGD(totalShared)}
          subtitle="Default 50/50 couple split"
          icon={<ArrowRightLeft className="h-4 w-4" />}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
        />

        {/* Card 3: Unsettled Balance (Who Owes Whom) */}
        <StatCard
          title="Unsettled / Who Owes Whom"
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
