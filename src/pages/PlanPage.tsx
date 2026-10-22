/**
 * PlanPage Component
 * Consolidated hub for Long-Term Planning:
 * - Savings Goals & Milestones
 * - Loans & HDB Mortgage Payoff
 * - Recurring Policies, Subscriptions & Annual Taxes
 * - Bonus Allocation Calculator
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Target,
  CreditCard,
  CalendarClock,
  ArrowRight,
  Loader2,
  Users,
  User,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Badge } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { BonusAllocationCollapsible } from '../components/budget/BonusAllocationCollapsible';
import type { SavingsGoal, Loan, RecurringPolicy } from '../types/finance';

export interface PlanPageProps {
  onNavigateTab?: (tab: string) => void;
  className?: string;
}

export function PlanPage({ onNavigateTab, className = '' }: PlanPageProps) {
  const { perspective, activeMember } = useHousehold();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [policies, setPolicies] = useState<RecurringPolicy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [goalsData, loansData, policiesData] = await Promise.all([
        financeService.getGoals(),
        financeService.getLoans(),
        financeService.getPolicies(),
      ]);
      setGoals(goalsData || []);
      setLoans(loansData || []);
      setPolicies(policiesData || []);
    } catch (err) {
      console.error('Failed to load plan hub data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Goal metrics
  const totalSavedGoals = useMemo(
    () => goals.reduce((s, g) => s + g.saved_so_far, 0),
    [goals]
  );
  const totalTargetGoals = useMemo(
    () => goals.reduce((s, g) => s + g.target_amount, 0),
    [goals]
  );

  // Loan metrics
  const activeLoan = useMemo(
    () => loans.find((l) => l.status === 'active') || loans[0] || null,
    [loans]
  );

  // Recurring metrics
  const subscriptions = useMemo(
    () => policies.filter((p) => p.type === 'subscription'),
    [policies]
  );
  const annualPolicies = useMemo(
    () => policies.filter((p) => p.frequency === 'annually'),
    [policies]
  );
  const monthlySubTotal = useMemo(
    () => subscriptions.reduce((s, p) => s + (p.monthly_amortized_amount || p.amount), 0),
    [subscriptions]
  );

  const perspectiveDisplayName =
    perspective === 'household' ? 'Combined Household' : activeMember?.display_name || perspective;

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      <PageHeader
        title="Long-Term Plan"
        badge={
          <Badge
            variant={perspective === 'household' ? 'emerald' : 'blue'}
            icon={perspective === 'household' ? <Users className="h-3 w-3" /> : <User className="h-3 w-3" />}
          >
            {perspectiveDisplayName}
          </Badge>
        }
        subtitle="Goals, mortgage payoff trajectory, and recurring commitments"
      />

      {isLoading ? (
        <div className="flex items-center justify-center p-16 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
          <div className="flex flex-col items-center gap-3 text-slate-500">
            <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
            <span className="text-sm font-medium">Loading planning data...</span>
          </div>
        </div>
      ) : (
        <>
          {/* 3 Main Pillar Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Pillar 1: Savings Goals */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                      <Target className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Savings Goals
                    </h3>
                  </div>
                  <span className="rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    {goals.length} Goals
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {formatSGD(totalSavedGoals)}
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    of {formatSGD(totalTargetGoals)} target
                  </span>
                </div>

                {/* Top 2 goals preview */}
                <div className="mt-4 space-y-2">
                  {goals.slice(0, 2).map((goal) => {
                    const pct = Math.min(
                      100,
                      Math.round((goal.saved_so_far / goal.target_amount) * 100)
                    );
                    return (
                      <div
                        key={goal.id}
                        className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2 text-xs"
                      >
                        <div className="flex items-center justify-between font-semibold">
                          <span className="truncate flex items-center gap-1.5">
                            <span>{goal.emoji || '🎯'}</span>
                            <span className="truncate">{goal.title}</span>
                          </span>
                          <span>{pct}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-emerald-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('goals')}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span>Manage Goals</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Pillar 2: Loans & Mortgage */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Mortgage &amp; Debt
                    </h3>
                  </div>
                  {activeLoan && (
                    <span className="rounded-full bg-blue-100 dark:bg-blue-950/50 px-2 py-0.5 text-[11px] font-bold text-blue-800 dark:text-blue-300">
                      {(activeLoan.interest_rate * 100).toFixed(1)}% p.a.
                    </span>
                  )}
                </div>

                {activeLoan ? (
                  <div className="mt-3">
                    <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                      {formatSGD(activeLoan.principal - activeLoan.amount_paid)}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      remaining on {activeLoan.name}
                    </span>

                    <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Monthly Payment:</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatSGD(activeLoan.monthly_payment)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Remaining Term:</span>
                        <span className="font-semibold text-slate-700 dark:text-slate-300">
                          {Math.floor(activeLoan.term_months / 12)}y {activeLoan.term_months % 12}m
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 text-xs text-slate-400">No active loans.</p>
                )}
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('loans')}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span>Prepayment Simulator</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Pillar 3: Recurring Obligations */}
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                      <CalendarClock className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                      Recurring &amp; Policies
                    </h3>
                  </div>
                  <span className="rounded-full bg-purple-100 dark:bg-purple-950/50 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:text-purple-300">
                    {policies.length} Policies
                  </span>
                </div>

                <div className="mt-3">
                  <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                    {formatSGD(monthlySubTotal)}/mo
                  </span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">
                    active subscriptions auto-deducted
                  </span>
                </div>

                <div className="mt-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 p-2.5 text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Annual Policies:</span>
                    <span className="font-bold text-slate-900 dark:text-white">
                      {annualPolicies.length} items
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Monthly Subs:</span>
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {subscriptions.length} items
                    </span>
                  </div>
                </div>
              </div>

              {onNavigateTab && (
                <button
                  type="button"
                  onClick={() => onNavigateTab('recurring')}
                  className="mt-4 w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 py-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <span>Policy &amp; Renewal Hub</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Bonus Allocation Helper */}
          <BonusAllocationCollapsible
            initialGrossBonus={2000}
            cpfRate={0.2}
            defaultOpen={true}
          />
        </>
      )}
    </div>
  );
}

export default PlanPage;

