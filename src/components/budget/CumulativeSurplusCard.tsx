/**
 * CumulativeSurplusCard Component
 * Calculates and visualizes the Cumulative Spending Surplus / Deficit across months.
 *
 * Key Business Rules:
 * - Spendable Cap minus Spendable Expenses
 * - Excludes Goal-funded expenses (`goal_id !== null`) so pre-saved goals don't cause fake deficits
 * - Displays:
 *   1. Current month surplus/deficit (e.g. "+$180.20 Surplus this month")
 *   2. Cumulative surplus banked across prior months (e.g. "Total Banked Surplus: +$520.40")
 *   3. Visual breakdown / mini rollover bar for recent 3-6 months
 */

import { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Sparkles,
  Calendar,
  Loader2,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { getCurrentMonth, formatShortMonth, getPastMonthsList } from '../../lib/dateUtils';
import { calculateCumulativeSurplus } from '../../lib/financialFormulas';
import { financeService } from '../../services/financeService';
import { TooltipPopover } from '../ui/TooltipPopover';
import type {
  CumulativeSurplusSummary,
  Expense,
  Category,
  Perspective,
} from '../../types/finance';

export interface CumulativeSurplusCardProps {
  selectedMonth?: string;
  memberId?: string;
  perspective?: Perspective;
  summary?: CumulativeSurplusSummary;
  expenses?: Expense[];
  categories?: Category[];
  monthlyCap?: number | Record<string, number>;
  className?: string;
}

export function CumulativeSurplusCard({
  selectedMonth = getCurrentMonth(),
  memberId,
  perspective = 'household',
  summary: propSummary,
  expenses: propExpenses,
  categories: propCategories,
  monthlyCap: propMonthlyCap,
  className = '',
}: CumulativeSurplusCardProps) {
  const [loading, setLoading] = useState<boolean>(!propSummary);
  const [fetchedExpenses, setFetchedExpenses] = useState<Expense[]>([]);
  const [fetchedCategories, setFetchedCategories] = useState<Category[]>([]);
  const [derivedMonthlyCap, setDerivedMonthlyCap] = useState<number>(1500);

  // Generate last 6 months range ending at selectedMonth
  const monthsRange = useMemo(() => {
    return getPastMonthsList(selectedMonth, 6);
  }, [selectedMonth]);

  // Load data if summary wasn't directly provided
  useEffect(() => {
    if (propSummary) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    async function loadData() {
      try {
        setLoading(true);
        const [expList, catList, budgetDetail] = await Promise.all([
          propExpenses ? Promise.resolve(propExpenses) : financeService.getExpenses().catch(() => []),
          propCategories ? Promise.resolve(propCategories) : financeService.getCategories().catch(() => []),
          financeService.getMonthlyBudget(selectedMonth, memberId).catch(() => null),
        ]);

        if (!isMounted) return;
        setFetchedExpenses(expList || []);
        setFetchedCategories(catList || []);

        if (propMonthlyCap !== undefined) {
          if (typeof propMonthlyCap === 'number') {
            setDerivedMonthlyCap(propMonthlyCap);
          }
        } else if (budgetDetail?.spendableAllocated) {
          setDerivedMonthlyCap(budgetDetail.spendableAllocated);
        } else if (budgetDetail?.categories) {
          const spendableSum = budgetDetail.categories
            .filter((c) => {
              const name = (c.category?.name || '').toLowerCase();
              return !name.includes('invest') && !name.includes('saving') && !name.includes('tith');
            })
            .reduce((sum, c) => sum + (c.allocated_amount || 0), 0);
          setDerivedMonthlyCap(spendableSum > 0 ? spendableSum : 1500);
        }
      } catch (err) {
        console.error('Failed to load data for CumulativeSurplusCard:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [selectedMonth, memberId, propSummary, propExpenses, propCategories, propMonthlyCap]);

  // Compute surplus summary if not passed via props
  const summary: CumulativeSurplusSummary = useMemo(() => {
    if (propSummary) return propSummary;

    const allExpenses = propExpenses || fetchedExpenses;
    const allCategories = propCategories || fetchedCategories;
    const cap = propMonthlyCap !== undefined ? propMonthlyCap : derivedMonthlyCap;

    return calculateCumulativeSurplus({
      months: monthsRange,
      monthlyCap: cap,
      expenses: allExpenses,
      categories: allCategories,
      memberId,
      perspective,
    });
  }, [
    propSummary,
    propExpenses,
    fetchedExpenses,
    propCategories,
    fetchedCategories,
    propMonthlyCap,
    derivedMonthlyCap,
    monthsRange,
    memberId,
    perspective,
  ]);

  if (loading) {
    return (
      <div
        data-testid="cumulative-surplus-card"
        className={`rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex items-center justify-center ${className}`}
      >
        <Loader2 className="h-6 w-6 animate-spin text-emerald-600" />
      </div>
    );
  }

  const currentMonthPoint =
    summary.monthlyHistory.find((h) => h.month === selectedMonth) ||
    summary.monthlyHistory[summary.monthlyHistory.length - 1];

  const currentSurplus = currentMonthPoint ? currentMonthPoint.delta : summary.currentMonthSurplus;
  const isCurrentSurplusPositive = currentSurplus >= 0;

  const totalBanked = summary.cumulativeSurplus;
  const isBankedPositive = totalBanked >= 0;

  // Find max absolute delta for visual relative bar scaling
  const maxAbsDelta = Math.max(
    ...summary.monthlyHistory.map((h) => Math.abs(h.delta)),
    500
  );

  return (
    <div
      data-testid="cumulative-surplus-card"
      className={`rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-cute transition-colors space-y-4 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink) shadow-cute-sm">
            <PiggyBank className="h-4 w-4" />
          </div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-display font-black text-sm sm:text-base text-(--text-ink)">
              Cumulative Spending Surplus
            </h3>
            <TooltipPopover
              title="Goal-Funded Protection & Rollover"
              ariaLabel="Goal-Funded Protection info"
              align="left"
            >
              Unspent spendable cap rolls over month-to-month. <strong>Goal-Funded Protection:</strong> Expenses paid out of pre-saved savings goals are excluded from spendable expenses to prevent artificial budget deficits.
            </TooltipPopover>
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) shadow-cute-sm">
          <Calendar className="h-3.5 w-3.5 text-(--text-muted)" />
          <span>{formatShortMonth(selectedMonth)}</span>
        </div>
      </div>

      {/* Top 2 Metric Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {/* Metric 1: Current Month Surplus/Deficit */}
        <div
          data-testid="current-month-surplus-badge"
          className={`p-4 rounded-xl border-[1.5px] border-(--border-ink) shadow-cute-sm flex items-center justify-between ${
            isCurrentSurplusPositive
              ? 'bg-(--pastel-mint-light) text-(--text-ink)'
              : 'bg-(--pastel-coral-light) text-(--text-ink)'
          }`}
        >
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
              {formatShortMonth(selectedMonth)} Result
            </span>
            <div className="font-mono-num text-xl font-black tracking-tight mt-0.5">
              {isCurrentSurplusPositive ? '+' : '-'}
              {formatSGD(Math.abs(currentSurplus))}
            </div>
            <span className="block text-xs font-bold mt-0.5 opacity-90">
              {isCurrentSurplusPositive ? 'Surplus this month' : 'Deficit this month'}
            </span>
          </div>

          <div
            className={`p-2.5 rounded-xl border border-(--border-ink) shadow-cute-sm ${
              isCurrentSurplusPositive
                ? 'bg-(--pastel-mint) text-emerald-900'
                : 'bg-(--pastel-coral) text-white'
            }`}
          >
            {isCurrentSurplusPositive ? (
              <TrendingUp className="h-5 w-5 stroke-[2.5]" />
            ) : (
              <TrendingDown className="h-5 w-5 stroke-[2.5]" />
            )}
          </div>
        </div>

        {/* Metric 2: Total Banked Surplus */}
        <div
          data-testid="total-banked-surplus-badge"
          className="p-4 rounded-xl border-[1.5px] border-(--border-ink) shadow-cute-sm bg-(--pastel-butter-light) text-(--text-ink) flex items-center justify-between"
        >
          <div>
            <span className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
              Historical Rollover
            </span>
            <div className="font-mono-num text-xl font-black tracking-tight mt-0.5">
              {isBankedPositive ? '+' : '-'}
              {formatSGD(Math.abs(totalBanked))}
            </div>
            <span className="block text-xs font-bold mt-0.5 opacity-90">
              Total Banked Surplus: {isBankedPositive ? '+' : '-'}{formatSGD(Math.abs(totalBanked))}
            </span>
          </div>

          <div
            className="p-2.5 rounded-xl border border-(--border-ink) shadow-cute-sm bg-(--pastel-butter) text-(--text-ink)"
          >
            <Sparkles className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Visual Breakdown / Mini Rollover Bar for Recent 3-6 Months */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
            Recent {summary.monthlyHistory.length}-Month Rollover Breakdown
          </span>
          <span className="text-[11px] font-medium text-(--text-muted)">
            Spendable Cap vs Non-Goal Spend
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {summary.monthlyHistory.map((point) => {
            const isPos = point.delta >= 0;
            const isSelected = point.month === selectedMonth;
            const barFill = Math.min(100, Math.round((Math.abs(point.delta) / maxAbsDelta) * 100));

            return (
              <div
                key={point.month}
                className={`p-3 rounded-xl border-[1.5px] flex flex-col justify-between transition-all ${
                  isSelected
                    ? 'border-(--border-ink) bg-(--pastel-butter-light) shadow-cute-sm'
                    : 'border-(--border-subtle) bg-(--bg-canvas)'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs font-bold text-(--text-ink)">
                    <span>{formatShortMonth(point.month)}</span>
                    {point.goalSpent > 0 && (
                      <span
                        title={`Goal-funded spending of ${formatSGD(point.goalSpent)} safely excluded`}
                        className="text-[9px] px-1 py-0.2 rounded bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) font-bold"
                      >
                        Goal
                      </span>
                    )}
                  </div>

                  <div
                    className={`font-mono-num text-sm font-black tracking-tight mt-1 ${
                      isPos
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isPos ? '+' : '-'}
                    {formatSGD(Math.abs(point.delta))}
                  </div>

                  <div className="font-mono-num text-[10px] text-(--text-muted) mt-0.5">
                    {formatSGD(point.spent)} / {formatSGD(point.cap)}
                  </div>
                </div>

                {/* Mini Visual Rollover Bar */}
                <div className="mt-3">
                  <div className="h-2 w-full bg-(--bg-card) border border-(--border-ink) rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        isPos ? 'bg-emerald-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${Math.max(12, barFill)}%` }}
                    />
                  </div>
                  <div className="font-mono-num text-[9px] text-(--text-muted) text-right mt-1 font-semibold">
                    Cum: {point.cumulative >= 0 ? '+' : ''}{formatSGD(point.cumulative)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CumulativeSurplusCard;
