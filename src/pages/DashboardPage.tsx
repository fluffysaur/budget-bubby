/**
 * DashboardPage Component
 * Top-level Financial Hub & Settlement Center
 * Adapts dynamically to active perspective:
 * - Combined Household: NetWorthHeroCard, SettlementWidget, SharedGoalsOverview, UpcomingBillsWidget
 * - Personal Perspectives: Personal Net Worth, Monthly Budget progress, Personal Accounts & Recent Transactions
 * - Quick Actions: Quick Add Expense, Update Account Balance
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Users,
  User,
  PieChart,
  Landmark,
  Receipt,
  Loader2,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, Badge } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getCurrentMonth, formatDisplayDate } from '../lib/dateUtils';
import { mockCategories, mockMembers } from '../data/mockSeedData';
import { NetWorthHeroCard } from '../components/dashboard/NetWorthHeroCard';
import { SettlementWidget } from '../components/dashboard/SettlementWidget';
import { SharedGoalsOverview } from '../components/dashboard/SharedGoalsOverview';
import { UpcomingBillsWidget } from '../components/dashboard/UpcomingBillsWidget';
import { QuickAddExpenseModal } from '../components/expenses/QuickAddExpenseModal';
import { UpdateBalanceModal } from '../components/accounts/UpdateBalanceModal';
import type {
  Account,
  Category,
  Expense,
  Loan,
  MonthlyBudgetDetail,
  RecurringPolicy,
  SavingsGoal,
} from '../types/finance';

export interface DashboardPageProps {
  className?: string;
  onNavigateTab?: (tab: string) => void;
}

export function DashboardPage({ className = '', onNavigateTab }: DashboardPageProps) {
  const {
    perspective,
    activeMember,
    members: ctxMembers,
    overview,
    refreshData: refreshHousehold,
  } = useHousehold();

  const members = ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;
  const isHousehold = perspective === 'household';

  // Data States
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [policies, setPolicies] = useState<RecurringPolicy[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [monthlyBudget, setMonthlyBudget] = useState<MonthlyBudgetDetail | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Modal States
  const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
  const [isUpdateBalanceOpen, setIsUpdateBalanceOpen] = useState<boolean>(false);
  const [selectedAccountForUpdate, setSelectedAccountForUpdate] = useState<Account | null>(null);

  // Perspective Display Name
  const perspectiveDisplayName = useMemo(() => {
    if (isHousehold) return 'Combined Household';
    if (activeMember) return activeMember.display_name;
    const clean = perspective.toLowerCase();
    if (clean.includes('yijia')) return 'Yi Jia';
    if (clean.includes('rachel')) return 'Rachel';
    return perspective;
  }, [isHousehold, activeMember, perspective]);

  // Load all dashboard data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const currentMonth = getCurrentMonth();
      const targetMemberId = activeMember ? activeMember.id : members[0]?.id;

      const [
        accountsData,
        loansData,
        goalsData,
        policiesData,
        expensesData,
        budgetData,
        categoriesData,
      ] = await Promise.all([
        financeService.getAccounts(perspective),
        financeService.getLoans(),
        financeService.getGoals(),
        financeService.getPolicies(),
        financeService.getExpenses(),
        financeService.getMonthlyBudget(currentMonth, targetMemberId),
        financeService.getCategories(),
      ]);

      setAccounts(accountsData || []);
      setLoans(loansData || []);
      setGoals(goalsData || []);
      setPolicies(policiesData || []);
      setExpenses(expensesData || []);
      setMonthlyBudget(budgetData || null);
      setCategories(categoriesData || []);
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [perspective, activeMember, members]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Net Worth Calculations
  const totalAssets = useMemo(() => {
    const sum = accounts.reduce((acc, a) => acc + a.balance, 0);
    return Math.round(sum * 100) / 100;
  }, [accounts]);

  const activeLoans = useMemo(() => {
    return loans.filter((l) => {
      if (l.status !== 'active') return false;
      if (isHousehold) return true;
      return !l.borrower_id || l.borrower_id === activeMember?.id;
    });
  }, [loans, isHousehold, activeMember]);

  const totalLiabilities = useMemo(() => {
    const sum = activeLoans.reduce((acc, l) => {
      const remaining = l.principal - l.amount_paid;
      if (!isHousehold && !l.borrower_id) {
        return acc + remaining * 0.5; // 50% split for joint household loan in personal view
      }
      return acc + remaining;
    }, 0);
    return Math.round(sum * 100) / 100;
  }, [activeLoans, isHousehold]);

  const trueNetWorth = useMemo(() => {
    return Math.round((totalAssets - totalLiabilities) * 100) / 100;
  }, [totalAssets, totalLiabilities]);

  // Personal perspective transactions
  const personalExpenses = useMemo(() => {
    if (isHousehold || !activeMember) return [];
    return expenses
      .filter((e) => e.payer_id === activeMember.id)
      .slice(0, 5);
  }, [isHousehold, activeMember, expenses]);

  // Modal Handlers
  const handleOpenUpdateBalance = (account?: Account) => {
    const target = account || accounts[0] || null;
    setSelectedAccountForUpdate(target);
    setIsUpdateBalanceOpen(true);
  };

  const handleExpenseAdded = async () => {
    await loadDashboardData();
    await refreshHousehold();
  };

  const handleBalanceUpdated = async () => {
    await loadDashboardData();
    await refreshHousehold();
  };

  const handleSettled = async () => {
    await loadDashboardData();
    await refreshHousehold();
  };

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Top Header & Quick Actions */}
      <PageHeader
        title="Dashboard"
        badge={
          <Badge
            variant={isHousehold ? 'emerald' : 'blue'}
            icon={isHousehold ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
          >
            {perspectiveDisplayName}
          </Badge>
        }
        subtitle={
          isHousehold
            ? 'Combined household hub, running settlements, and couple milestones'
            : `${perspectiveDisplayName}'s personal take-home, allocations, and individual assets`
        }
        actions={
          <>
            <Button
              variant="primary"
              leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
              onClick={() => setIsQuickAddOpen(true)}
            >
              Add Expense
            </Button>

            <Button
              variant="secondary"
              leftIcon={<Landmark className="h-4 w-4 text-slate-500" />}
              onClick={() => handleOpenUpdateBalance()}
            >
              Update Balance
            </Button>
          </>
        }
      />

      {/* Loading Indicator */}
      {isLoading ? (
        <div className="flex items-center justify-center p-16 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-sm font-medium">Loading household overview...</span>
          </div>
        </div>
      ) : (
        <>
          {/* 1. True Net Worth Hero Card */}
          <NetWorthHeroCard
            netWorth={trueNetWorth}
            totalAssets={totalAssets}
            totalLiabilities={totalLiabilities}
            perspective={perspective}
            perspectiveName={perspectiveDisplayName}
            onUpdateBalance={() => handleOpenUpdateBalance()}
          />

          {/* COMBINED HOUSEHOLD PERSPECTIVE VIEW */}
          {isHousehold ? (
            <>
              {/* 2. Splitwise-style Running Settlement Widget */}
              <SettlementWidget
                summary={overview?.settlementSummary}
                members={members}
                expenses={expenses}
                onSettled={handleSettled}
              />

              {/* 3. Two-Column Grid: Goals Milestones & Upcoming Bills */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SharedGoalsOverview
                  goals={goals}
                  onViewAll={() => onNavigateTab?.('goals')}
                />
                <UpcomingBillsWidget
                  policies={policies}
                  onViewAll={() => onNavigateTab?.('recurring')}
                />
              </div>
            </>
          ) : (
            /* PERSONAL PERSPECTIVE VIEW (Yi Jia / Rachel) */
            <div className="space-y-6">
              {/* Personal Monthly Budget Progress */}
              <div
                role="region"
                aria-label="Personal Budget Progress"
                className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs transition-colors"
              >
                <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                      <PieChart className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white">
                        Personal Monthly Budget
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {monthlyBudget?.budget.month || getCurrentMonth()} Take-Home &amp; Spending Limits
                      </p>
                    </div>
                  </div>

                  {onNavigateTab && (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('budget')}
                      className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                    >
                      View Full Budget
                    </button>
                  )}
                </div>

                {/* 4 Metric Cards for Personal Budget */}
                <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Gross Salary */}
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Gross Salary
                    </span>
                    <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">
                      {formatSGD(monthlyBudget?.budget.gross_salary || 0)}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">Monthly base</p>
                  </div>

                  {/* CPF Deduction */}
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      CPF (20%)
                    </span>
                    <div className="mt-1 text-lg font-extrabold text-rose-600 dark:text-rose-400">
                      -{formatSGD(monthlyBudget?.budget.cpf_deduction || 0)}
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">Employee contribution</p>
                  </div>

                  {/* Disposable / Take-Home */}
                  <div className="rounded-2xl border border-emerald-200/60 dark:border-emerald-800/60 bg-emerald-50/40 dark:bg-emerald-950/20 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                      Take-Home Pay
                    </span>
                    <div className="mt-1 text-lg font-black text-emerald-900 dark:text-emerald-100">
                      {formatSGD(monthlyBudget?.disposablePool || 0)}
                    </div>
                    <p className="mt-0.5 text-[10px] text-emerald-700 dark:text-emerald-400">
                      After CPF &amp; allocations
                    </p>
                  </div>

                  {/* Spent & Remaining */}
                  <div className="rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-4">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      Spent / Remaining
                    </span>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-lg font-extrabold text-slate-900 dark:text-white">
                        {formatSGD(monthlyBudget?.totalSpent || 0)}
                      </span>
                      <span
                        className={`text-xs font-bold ${
                          (monthlyBudget?.totalRemaining || 0) < 0
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }`}
                      >
                        Left {formatSGD(monthlyBudget?.totalRemaining || 0)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[10px] text-slate-400">Current month total</p>
                  </div>
                </div>
              </div>

              {/* Personal Accounts & Recent Personal Transactions */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Personal Accounts List */}
                <div
                  role="region"
                  aria-label="Personal Accounts"
                  className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs transition-colors"
                >
                  <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                        <Landmark className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Personal Accounts
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Cash, CPF &amp; Investment balances
                        </p>
                      </div>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('accounts')}
                        className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        View All
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {accounts.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">
                        No accounts found for this perspective.
                      </p>
                    ) : (
                      accounts.map((acc) => (
                        <div
                          key={acc.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 p-4"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 shadow-2xs text-xs font-bold text-slate-700 dark:text-slate-200">
                              {acc.institution?.slice(0, 3) || acc.type.slice(0, 3)}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-slate-900 dark:text-white">
                                  {acc.name}
                                </span>
                                {acc.is_joint && (
                                  <span className="rounded-full bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                    Joint
                                  </span>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400">
                                {acc.type} • {acc.institution || 'Bank'}
                              </span>
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-sm font-bold text-slate-900 dark:text-white">
                              {formatSGD(acc.balance)}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleOpenUpdateBalance(acc)}
                              className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
                            >
                              Update
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* Recent Personal Transactions */}
                <div
                  role="region"
                  aria-label="Recent Transactions"
                  className="rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs transition-colors"
                >
                  <div className="flex items-center justify-between pb-5 border-b border-slate-100 dark:border-slate-800/80">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                        <Receipt className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-slate-900 dark:text-white">
                          Recent Expenses
                        </h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          Latest expenses paid by {perspectiveDisplayName}
                        </p>
                      </div>
                    </div>
                    {onNavigateTab && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab('expenses')}
                        className="text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
                      >
                        View Ledger
                      </button>
                    )}
                  </div>

                  <div className="mt-5 space-y-3">
                    {personalExpenses.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center">
                        No recent transactions paid by {perspectiveDisplayName}.
                      </p>
                    ) : (
                      personalExpenses.map((exp) => (
                        <div
                          key={exp.id}
                          className="flex items-center justify-between rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 p-4"
                        >
                          <div>
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {exp.item}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              <span>{formatDisplayDate(exp.date)}</span>
                              {exp.is_shared && (
                                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:text-blue-300">
                                  Shared (50%)
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatSGD(exp.amount)}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Quick Add Expense Modal */}
      <QuickAddExpenseModal
        isOpen={isQuickAddOpen}
        onClose={() => setIsQuickAddOpen(false)}
        onExpenseAdded={handleExpenseAdded}
        defaultPayerId={activeMember?.id}
        categories={categories.length > 0 ? categories : mockCategories}
        members={members}
      />

      {/* Update Balance Modal */}
      <UpdateBalanceModal
        isOpen={isUpdateBalanceOpen}
        account={selectedAccountForUpdate}
        onClose={() => {
          setIsUpdateBalanceOpen(false);
          setSelectedAccountForUpdate(null);
        }}
        onBalanceUpdated={handleBalanceUpdated}
      />
    </div>
  );
}

export default DashboardPage;
