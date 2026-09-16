/**
 * GoalCard Component
 * Milestone savings goal card displaying:
 * - Emoji icon badge & goal title
 * - Target amount, saved so far, and remaining amount
 * - Visual progress bar with accessible role="progressbar"
 * - Pacing indicator badge (Achieved, On Track, Behind)
 * - Monthly current contribution vs needed pace
 * - Target date and remaining months countdown
 * - Quick Deposit and Edit actions
 */

import { CheckCircle2, TrendingUp, AlertCircle, Calendar, Pencil, Coins, Clock } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { calculateGoalPacing } from '../../lib/financialFormulas';
import { formatDisplayMonth } from '../../lib/dateUtils';
import type { SavingsGoal } from '../../types/finance';

export interface GoalCardProps {
  goal: SavingsGoal;
  onEdit?: (goal: SavingsGoal) => void;
  onQuickDeposit?: (goal: SavingsGoal) => void;
  className?: string;
}

export function GoalCard({ goal, onEdit, onQuickDeposit, className = '' }: GoalCardProps) {
  const targetAmount = Math.max(0, goal.target_amount);
  const savedSoFar = Math.max(0, goal.saved_so_far);
  const remainingAmount = Math.max(0, targetAmount - savedSoFar);

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
      className={`relative flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:shadow-md dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div>
        {/* Header: Emoji, Title, Status Badge */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-2xl shadow-inner dark:bg-slate-800">
              <span role="img" aria-label={goal.title}>{goal.emoji || '🎯'}</span>
            </div>
            <div>
              <h3 className="font-bold text-slate-900 line-clamp-1 dark:text-white" title={goal.title}>
                {goal.title}
              </h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                <span>{formatDisplayMonth(goal.target_date)}</span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
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
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold border ${statusConfig.badgeClass}`}
          >
            <StatusIcon className="h-3.5 w-3.5 shrink-0" />
            <span>{statusConfig.label}</span>
          </div>
        </div>

        {/* Financial Highlights */}
        <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800/50">
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Target
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-0.5 block truncate" title={formatSGD(targetAmount)}>
              {formatSGD(targetAmount)}
            </span>
          </div>
          <div className="border-x border-slate-200/60 dark:border-slate-700/60">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Saved
            </span>
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5 block truncate" title={formatSGD(savedSoFar)}>
              {formatSGD(savedSoFar)}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 block">
              Remaining
            </span>
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-0.5 block truncate" title={formatSGD(remainingAmount)}>
              {formatSGD(remainingAmount)}
            </span>
          </div>
        </div>

        {/* Progress Bar & Percentage */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
            <span className="text-slate-600 dark:text-slate-400">Progress</span>
            <span className={isAchieved ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}>
              {progressPercent}%
            </span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${goal.title} progress: ${progressPercent}%`}
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"
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
      </div>

      {/* Action Footer */}
      <div className="mt-5 flex items-center justify-end gap-2 border-t border-slate-100 pt-4 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onQuickDeposit?.(goal)}
          aria-label={`Deposit to ${goal.title}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-emerald-600 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-emerald-400 transition-colors"
        >
          <Coins className="h-3.5 w-3.5 text-emerald-500" />
          <span>Deposit</span>
        </button>

        <button
          type="button"
          onClick={() => onEdit?.(goal)}
          aria-label={`Edit ${goal.title}`}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50 hover:text-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-blue-400 transition-colors"
        >
          <Pencil className="h-3.5 w-3.5 text-blue-500" />
          <span>Edit</span>
        </button>
      </div>
    </div>
  );
}
