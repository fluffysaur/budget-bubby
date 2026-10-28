/**
 * SharedGoalsOverview Component
 * Displays top milestone savings goals with emojis, progress bars,
 * pacing status badges (On Track, Behind, Achieved), and target dates.
 */

import { Target, ChevronRight, Calendar } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatDisplayDate } from '../../lib/dateUtils';
import { TruncatedText } from '../ui/TruncatedText';
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
          <span className="inline-flex items-center gap-1 rounded-full bg-[#dfc2ff] px-2 py-0.5 text-[10px] font-black text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0">
            Achieved
          </span>
        );
      case 'behind':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#fff1ee] px-2 py-0.5 text-[10px] font-black text-[#9a1b1b] dark:text-[#fca5a5] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0">
            Behind
          </span>
        );
      case 'on_track':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-[#bbf7d0] px-2 py-0.5 text-[10px] font-black text-[#14532d] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) shrink-0">
            On Track
          </span>
        );
    }
  };

  return (
    <div
      role="region"
      aria-label="Shared Goals Milestones"
      className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-5 sm:p-6 shadow-(--shadow-cute) transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-4 border-b-2 border-(--border-ink)">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fcbffa] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
            <Target className="h-5 w-5 stroke-[2.5]" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-black text-(--text-ink) font-display">
              Milestone Goals
            </h3>
            <p className="text-xs font-semibold text-(--text-muted)">
              Couple aspirations &amp; pacing progress
            </p>
          </div>
        </div>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="inline-flex items-center gap-1 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-(--shadow-cute-sm) hover:bg-(--bg-card) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            <span>View All</span>
            <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="mt-4">
        {displayGoals.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-(--border-ink) py-8 text-center bg-(--bg-cream)">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--bg-card) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) text-lg mb-2">
              🎯
            </div>
            <p className="text-sm font-bold text-(--text-ink) font-display">
              No milestone goals yet
            </p>
            <p className="mt-1 text-xs text-(--text-muted) max-w-xs">
              Add goals like wedding, HDB down payment, or renovation to track pacing.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
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
                  className="rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3 sm:p-3.5 shadow-(--shadow-cute-sm) transition-all hover:bg-(--bg-card)"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--bg-card) border-2 border-(--border-ink) text-base text-(--text-ink) shadow-(--shadow-cute-sm) shrink-0">
                        {goal.emoji || '🎯'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-xs sm:text-sm font-bold text-(--text-ink) truncate">
                            <TruncatedText text={goal.title} />
                          </h4>
                          {getStatusBadge(goal.status)}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-(--text-muted)">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 stroke-[2.5]" />
                            <span>Target: {formatDisplayDate(goal.target_date)}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-xs sm:text-sm font-bold font-mono-num text-(--text-ink)">
                        {formatSGD(goal.saved_so_far)}
                      </div>
                      <div className="text-[11px] font-mono-num text-(--text-muted)">
                        <span>of </span>
                        <span>{formatSGD(goal.target_amount)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-2.5">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="font-bold font-mono-num text-(--text-muted)">
                        {progress}% Saved
                      </span>
                      <span className="font-bold font-mono-num text-(--text-muted)">
                        +{formatSGD(goal.monthly_contribution)}/mo
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-(--bg-card) border border-(--border-ink)">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          goal.status === 'achieved'
                            ? 'bg-[#dfc2ff]'
                            : goal.status === 'behind'
                            ? 'bg-[#f76b57]'
                            : 'bg-[#bbf7d0]'
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
