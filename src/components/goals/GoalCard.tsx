/**
 * GoalCard Component
 * Milestone savings goal card displaying:
 * - Emoji icon badge & goal title
 * - Target Amount, Total Saved, Goal-Funded Spend, and Remaining Balance
 * - Visual progress bar with accessible role="progressbar"
 * - Pacing indicator badge (Achieved, On Track, Behind)
 * - Monthly current contribution vs needed pace
 * - Target date and remaining months countdown
 * - '+ Spend from Goal' button to trigger quick spend logger
 * - List of linked expenses funded by this goal
 * - Quick Deposit and Edit actions
 */

import { useState } from 'react';
import {
  CheckCircle2,
  TrendingUp,
  AlertCircle,
  Calendar,
  Pencil,
  Coins,
  Clock,
  ShoppingBag,
  Receipt,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { calculateGoalPacing } from '../../lib/financialFormulas';
import { formatDisplayMonth, formatDisplayDate } from '../../lib/dateUtils';
import type { SavingsGoal, Expense } from '../../types/finance';

export interface GoalCardProps {
  goal: SavingsGoal;
  linkedExpenses?: Expense[];
  onEdit?: (goal: SavingsGoal) => void;
  onQuickDeposit?: (goal: SavingsGoal) => void;
  onSpendFromGoal?: (goal: SavingsGoal) => void;
  className?: string;
}

export function GoalCard({
  goal,
  linkedExpenses = [],
  onEdit,
  onQuickDeposit,
  onSpendFromGoal,
  className = '',
}: GoalCardProps) {
  const [showExpenses, setShowExpenses] = useState<boolean>(true);

  // Big-Ticket Goal Financial Highlights
  const targetAmount = Math.max(0, goal.target_amount);
  const savedSoFar = Math.max(0, goal.saved_so_far);
  const goalFundedSpend = Math.round(
    linkedExpenses.reduce((sum, e) => sum + e.amount, 0) * 100
  ) / 100;
  const remainingBalance = Math.max(0, targetAmount - savedSoFar);
  const totalSaved = Math.round((savedSoFar + (goalFundedSpend > 0 && savedSoFar < targetAmount ? 0 : 0)) * 100) / 100;

  const progressPercent = targetAmount > 0
    ? Math.min(100, Math.round((savedSoFar / targetAmount) * 100))
    : 0;

  const pacing = calculateGoalPacing(
    targetAmount,
    savedSoFar,
    goal.target_date,
    goal.monthly_contribution
  );

  const isAchieved = pacing.status === 'achieved';
  const isBehind = pacing.status === 'behind';

  // Status configuration
  const statusConfig = {
    achieved: {
      label: 'Achieved',
      badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/60',
      icon: CheckCircle2,
      barClass: 'bg-emerald-500',
    },
    on_track: {
      label: 'On Track',
      badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800/60',
      icon: TrendingUp,
      barClass: 'bg-blue-600',
    },
    behind: {
      label: 'Behind',
      badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/60',
      icon: AlertCircle,
      barClass: 'bg-amber-500',
    },
  }[pacing.status];

  const StatusIcon = statusConfig.icon;

  // Shortfall per month if behind
  const monthlyShortfall = isBehind
    ? Math.max(0, pacing.neededPerMonth - goal.monthly_contribution)
    : 0;

  return (
    <div
      data-testid={`goal-card-${goal.id}`}
      className={`relative flex flex-col justify-between rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-5 shadow-cute transition-all ${className}`}
    >
      <div>
        {/* Header: Emoji, Title, Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-(--border-ink) bg-(--pastel-butter-light) text-2xl shadow-cute-sm">
              <span role="img" aria-label={goal.title}>{goal.emoji || '🎯'}</span>
            </div>
            <div>
              <h3 className="font-display font-black text-slate-900 line-clamp-1 dark:text-white" title={goal.title}>
                {goal.title}
              </h3>
              <div className="flex items-center gap-1.5 text-xs font-mono-num text-(--text-muted) mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDisplayMonth(goal.target_date)}</span>
                <span className="text-(--text-muted)">•</span>
                <Clock className="h-3.5 w-3.5" />
                <span>
                  {isAchieved
                    ? 'Target reached'
                    : pacing.monthsRemaining === 1
                    ? '1 month left'
                    : `${pacing.monthsRemaining} months left`}
                </span>
              </div>
            </div>
          </div>

          <div
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold border border-(--border-ink) shadow-cute-sm ${statusConfig.badgeClass}`}
          >
            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Big-Ticket Financial Highlights (Target Amount, Total Saved, Goal-Funded Spend, Remaining Balance) */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2 rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) p-3 text-center shadow-cute-sm">
          <div>
            <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
              Target Amount
            </span>
            <span className="text-xs font-mono-num font-black text-(--text-ink) mt-0.5 block truncate" title={formatSGD(targetAmount)}>
              {formatSGD(targetAmount)}
            </span>
          </div>
          <div className="border-l sm:border-x border-(--border-subtle)">
            <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
              Total Saved
            </span>
            <span className="text-xs font-mono-num font-black text-emerald-700 dark:text-emerald-400 mt-0.5 block truncate" title={formatSGD(totalSaved)}>
              {formatSGD(totalSaved)}
            </span>
          </div>
          <div className="border-t sm:border-t-0 sm:border-r border-(--border-subtle) pt-2 sm:pt-0">
            <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
              Goal-Funded Spend
            </span>
            <span className="text-xs font-mono-num font-black text-purple-700 dark:text-purple-300 mt-0.5 block truncate" title={formatSGD(goalFundedSpend)}>
              {formatSGD(goalFundedSpend)}
            </span>
          </div>
          <div className="border-t sm:border-t-0 border-(--border-subtle) pt-2 sm:pt-0">
            <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
              Remaining Balance
            </span>
            <span className="text-xs font-mono-num font-black text-(--text-muted) mt-0.5 block truncate" title={formatSGD(remainingBalance)}>
              {formatSGD(remainingBalance)}
            </span>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-bold mb-1.5">
            <span className="text-(--text-muted)">Milestone Progress</span>
            <span className={`font-mono-num font-black ${isAchieved ? 'text-emerald-700 dark:text-emerald-400' : 'text-(--text-ink)'}`}>
              {progressPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${goal.title} progress: ${progressPercent}%`}
            className="h-3 w-full overflow-hidden rounded-full border border-(--border-ink) bg-(--bg-canvas)"
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${statusConfig.barClass}`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Monthly Pacing Details */}
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Current Monthly:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {formatSGD(goal.monthly_contribution)}/mo
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Required Pace:</span>
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {isAchieved ? 'Target Met' : `${formatSGD(pacing.neededPerMonth)}/mo needed`}
            </span>
          </div>

          {/* Shortfall Alert Note if behind */}
          {isBehind && monthlyShortfall > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 rounded-lg bg-amber-50/80 px-2.5 py-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>+ {formatSGD(monthlyShortfall)}/mo to stay on track</span>
            </div>
          )}
        </div>

        {/* List of Linked Expenses Funded by This Goal */}
        {linkedExpenses.length > 0 && (
          <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
            <button
              type="button"
              onClick={() => setShowExpenses((prev) => !prev)}
              className="flex items-center justify-between w-full text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 cursor-pointer hover:text-purple-600 transition-colors"
            >
              <span className="flex items-center gap-1.5">
                <Receipt className="h-3.5 w-3.5 text-purple-500" />
                <span>Linked Goal Expenses ({linkedExpenses.length})</span>
              </span>
              <span className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                <span>{formatSGD(goalFundedSpend)}</span>
                {showExpenses ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </span>
            </button>

            {showExpenses && (
              <div
                className="space-y-1.5 max-h-36 overflow-y-auto pr-1"
                data-testid={`linked-expenses-${goal.id}`}
              >
                {linkedExpenses.map((exp) => (
                  <div
                    key={exp.id}
                    data-testid={`linked-expense-item-${exp.id}`}
                    className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {exp.item}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {formatDisplayDate(exp.date)}
                      </span>
                    </div>
                    <span className="font-bold text-purple-700 dark:text-purple-300 shrink-0">
                      {formatSGD(exp.amount)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="mt-5 flex items-center justify-between gap-2 border-t border-(--border-subtle) pt-4">
        {/* + Spend from Goal Button */}
        <button
          type="button"
          onClick={() => onSpendFromGoal?.(goal)}
          aria-label={`+ Spend from ${goal.title}`}
          className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) px-3 py-1.5 text-xs font-black shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
        >
          <ShoppingBag className="h-3.5 w-3.5" />
          <span>+ Spend from Goal</span>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onQuickDeposit?.(goal)}
            aria-label={`Deposit to ${goal.title}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--border-ink) bg-(--pastel-mint-light) text-(--text-ink) px-2.5 py-1.5 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-mint) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            <Coins className="h-3.5 w-3.5 text-emerald-800" />
            <span>Deposit</span>
          </button>

          <button
            type="button"
            onClick={() => onEdit?.(goal)}
            aria-label={`Edit ${goal.title}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) px-2.5 py-1.5 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Edit</span>
          </button>
        </div>
      </div>
    </div>
  );
}
