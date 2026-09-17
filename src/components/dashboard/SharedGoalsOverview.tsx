/**
 * SharedGoalsOverview Component
 * Displays top milestone savings goals with emojis, progress bars,
 * pacing status badges (On Track, Behind, Achieved), and target dates.
 */

import { Target, ChevronRight, Calendar } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatDisplayDate } from '../../lib/dateUtils';
import type { SavingsGoal } from '../../types/finance';

export interface SharedGoalsOverviewProps {
  goals?: SavingsGoal[];
  onViewAll?: () => void;
  className?: string;
}

export function SharedGoalsOverview({
  goals = [],
  onViewAll,
  className = '',
}: SharedGoalsOverviewProps) {
  // Sort or slice top 3-4 goals
  const displayGoals = goals.slice(0, 3);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'achieved':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/50 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/60">
            Achieved
          </span>
        );
      case 'behind':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/50 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/60">
            Behind
          </span>
        );
      case 'on_track':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60">
            On Track
          </span>
        );
    }
  };

  return (
    <div
      role="region"
      aria-label="Shared Goals Milestones"
      className={`rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
            <Target className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Milestone Goals
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Couple aspirations &amp; pacing progress
            </p>
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="flex items-center gap-1 text-xs font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-5">
        {displayGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 py-10 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-xl">
              🎯
            </div>
            <p className="mt-2 text-sm font-bold text-slate-700 dark:text-slate-300">
              No milestone goals yet
            </p>
            <p className="mt-1 text-xs text-slate-400 max-w-xs">
              Add goals like wedding, HDB down payment, or renovation to track pacing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayGoals.map((goal) => {
              const progress = Math.min(
                100,
                goal.target_amount > 0
                  ? Math.round((goal.saved_so_far / goal.target_amount) * 100)
                  : 0
              );

              return (
                <div
                  key={goal.id}
                  className="rounded-2xl border border-slate-100 dark:border-slate-800/80 bg-slate-50/70 dark:bg-slate-800/40 p-4 transition-all hover:bg-slate-50 dark:hover:bg-slate-800/70"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 text-lg shadow-2xs">
                        {goal.emoji || '🎯'}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                            {goal.title}
                          </h4>
                          {getStatusBadge(goal.status)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>Target: {formatDisplayDate(goal.target_date)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                        {formatSGD(goal.saved_so_far)}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        <span>of </span>
                        <span>{formatSGD(goal.target_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-semibold text-slate-500 dark:text-slate-400">
                        {progress}% Saved
                      </span>
                      <span className="text-slate-400">
                        +{formatSGD(goal.monthly_contribution)}/mo
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          goal.status === 'achieved'
                            ? 'bg-blue-600'
                            : goal.status === 'behind'
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SharedGoalsOverview;
