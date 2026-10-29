/**
 * CategoryProgressList Component
 * Visual category meters with:
 * - Progress bar indicator
 * - Budgeted vs actual spent vs remaining
 * - Auto-deducted monthly subscription breakdown tooltip (for Lifestyle)
 * - Color-coded status:
 *   - Green: <= 80% (On Track)
 *   - Amber: 81-100% (Near Limit)
 *   - Red: > 100% (Over Budget)
 * - Over-budget alert banners and badges
 */

import {
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  HelpCircle,
  Utensils,
  Sparkles,
  Car,
  PiggyBank,
  Heart,
  Shield,
  Layers,
  Repeat,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { formatAllocationPercent } from '../../lib/financialFormulas';
import { TooltipPopover } from '../ui/TooltipPopover';
import { TruncatedText } from '../ui/TruncatedText';
import { EmptyStateCard } from '../ui/EmptyStateCard';
import type { MonthlyBudgetCategoryDetail } from '../../types/finance';

export interface CategoryProgressListProps {
  categories: MonthlyBudgetCategoryDetail[];
  onCategoryClick?: (categoryId: string) => void;
  compact?: boolean;
  className?: string;
}

function getCategoryIcon(name?: string) {
  const clean = (name || '').toLowerCase();
  if (clean.includes('food') || clean.includes('grocer') || clean.includes('dining')) return Utensils;
  if (clean.includes('lifestyle') || clean.includes('entertain')) return Sparkles;
  if (clean.includes('transport') || clean.includes('car')) return Car;
  if (clean.includes('invest')) return TrendingUp;
  if (clean.includes('saving')) return PiggyBank;
  if (clean.includes('tithe') || clean.includes('charity')) return Heart;
  if (clean.includes('buffer') || clean.includes('emerg')) return Shield;
  return Layers;
}

export function CategoryProgressList({
  categories = [],
  onCategoryClick,
  compact = false,
  className = '',
}: CategoryProgressListProps) {
  if (categories.length === 0) {
    return (
      <EmptyStateCard
        icon={<HelpCircle className="h-6 w-6" />}
        title="No Budget Categories"
        description="No budget categories found for this month."
        className={className}
      />
    );
  }

  // Identify over-budget categories
  const overBudgetCategories = categories.filter((c) => {
    const actual = c.actualSpent || 0;
    return actual > c.allocated_amount;
  });

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Over Budget Alert Banner */}
      {overBudgetCategories.length > 0 && (
        <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl border-2 border-(--border-ink) bg-[#fff1ee] dark:bg-[#3b1c19] text-[#9a1b1b] dark:text-[#fca5a5] shadow-(--shadow-cute-sm)">
          <div className="p-1.5 rounded-xl bg-[#f76b57] text-white border-2 border-(--border-ink) shrink-0 shadow-(--shadow-cute-sm)">
            <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
          </div>
          <div className="text-xs sm:text-sm min-w-0 flex-1">
            <span className="font-bold font-display">
              {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category has' : 'categories have'} exceeded budget:
            </span>{' '}
            <span className="font-medium opacity-90">
              {overBudgetCategories.map((c) => c.category?.name || 'Category').join(', ')}
            </span>
          </div>
        </div>
      )}

      {/* Category Progress Meters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
        {categories.map((catDetail) => {
          const categoryName = catDetail.category?.name || 'Category';
          const categoryColor = catDetail.category?.color || '#3B82F6';
          const Icon = getCategoryIcon(categoryName);

          const allocated = catDetail.allocated_amount || 0;
          const actual = catDetail.actualSpent || 0;
          const remaining =
            catDetail.remaining !== undefined ? catDetail.remaining : allocated - actual;
          const subSpent = catDetail.subscriptionSpent || 0;
          const subItems = catDetail.subscriptionItems || [];

          const spentPercentage =
            allocated > 0 ? (actual / allocated) * 100 : actual > 0 ? 100 : 0;
          const roundedPercentage = Math.round(spentPercentage);
          const isOverBudget = spentPercentage >= 100 || actual > allocated;
          const isNearLimit = !isOverBudget && spentPercentage >= 80;

          // Status Badge details
          let statusLabel = 'On Track';
          let progressBarColor = 'bg-emerald-500';
          let StatusIcon = CheckCircle2;

          if (isOverBudget) {
            statusLabel = 'Over Budget';
            progressBarColor = 'bg-rose-500';
            StatusIcon = AlertCircle;
          } else if (isNearLimit) {
            statusLabel = 'Near Limit';
            progressBarColor = 'bg-amber-500';
            StatusIcon = AlertTriangle;
          }

          const fillWidth = Math.max(0, Math.min(spentPercentage, 100));

          return (
            <div
              key={catDetail.id || catDetail.category_id}
              onClick={() => onCategoryClick?.(catDetail.category_id)}
              className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) ${
                compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
              } shadow-(--shadow-cute-sm) transition-all ${
                isOverBudget
                  ? 'bg-[#fff1ee]/50 dark:bg-[#3b1c19]/40'
                  : 'hover:bg-(--pastel-butter-light)/20'
              } ${onCategoryClick ? 'cursor-pointer' : ''}`}
            >
              {/* Card Header: Icon, Name, Target % & Status Badge */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-cute-sm border border-(--border-ink)"
                    style={{ backgroundColor: categoryColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                      <TruncatedText
                        text={categoryName}
                        className="font-display font-black text-sm text-(--text-ink)"
                      />
                      <span className="text-[10px] font-mono-num font-bold text-(--text-muted) shrink-0">
                        ({formatAllocationPercent(catDetail.percentage * 100)}%)
                      </span>
                      {subSpent > 0 && (
                        <TooltipPopover
                          label={`${categoryName} Subscriptions Breakdown`}
                          title="Auto-Deducted Monthly Subscriptions"
                        >
                          <div className="space-y-1">
                            <p>
                              Includes <strong>{formatSGD(subSpent)}/mo</strong> from active subscriptions:
                            </p>
                            {subItems.length > 0 && (
                              <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                                {subItems.map((s) => (
                                  <li key={s.name}>
                                    {s.name}: {formatSGD(s.amount)}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </TooltipPopover>
                      )}
                    </div>
                    {subSpent > 0 && (
                      <div className="flex items-center gap-1 text-[10px] font-medium text-(--text-muted)">
                        <Repeat className="h-2.5 w-2.5 text-purple-600 dark:text-purple-400" />
                        <span>Includes {formatSGD(subSpent)} recurring subs</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Indicator Badge */}
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-(--border-ink) shrink-0 shadow-cute-sm ${
                    isOverBudget
                      ? 'bg-(--pastel-coral-light) text-(--text-ink)'
                      : isNearLimit
                      ? 'bg-(--pastel-butter) text-(--text-ink)'
                      : 'bg-(--pastel-mint) text-(--text-ink)'
                  }`}
                >
                  <StatusIcon className="h-3 w-3" />
                  <span>{statusLabel} ({roundedPercentage}%)</span>
                </div>
              </div>

              {/* Amounts Grid: Spent vs Budgeted vs Remaining */}
              <div className="grid grid-cols-3 gap-2 my-2.5 text-left">
                <div>
                  <span className="block text-[10px] uppercase font-bold text-(--text-muted)">
                    Spent
                  </span>
                  <span className="text-sm font-mono-num font-black text-(--text-ink)">
                    {formatSGD(actual)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-(--text-muted)">
                    Budgeted
                  </span>
                  <span className="text-sm font-mono-num font-black text-(--text-ink)">
                    {formatSGD(allocated)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-bold text-(--text-muted)">
                    Remaining
                  </span>
                  <span
                    className={`text-sm font-mono-num font-black ${
                      remaining < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatSGD(remaining)}
                  </span>
                </div>
              </div>

              {/* Progress Bar Meter */}
              <div className="space-y-1.5 mt-2.5">
                <div className="h-3 w-full rounded-full bg-(--bg-canvas) border border-(--border-ink) overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${progressBarColor}`}
                    style={{ width: `${fillWidth}%` }}
                    role="progressbar"
                    aria-valuenow={roundedPercentage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  />
                </div>

                {/* Warning Badges (Amber for >= 80%, Rose for >= 100%) */}
                {isOverBudget ? (
                  <div className="flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-bold pt-0.5">
                    <span className="flex items-center gap-1 font-mono-num">
                      <AlertCircle className="h-3 w-3" />
                      Over by {formatSGD(Math.abs(remaining))}
                    </span>
                    <span
                      data-testid={`badge-rose-${catDetail.category_id}`}
                      className="px-2 py-0.5 rounded-full bg-(--pastel-coral-light) text-rose-800 font-bold text-[10px] border border-(--border-ink) shadow-cute-sm"
                    >
                      Rose Cap Exceeded
                    </span>
                  </div>
                ) : isNearLimit ? (
                  <div className="flex items-center justify-between text-[11px] text-amber-700 dark:text-amber-400 font-bold pt-0.5">
                    <span className="flex items-center gap-1 font-mono-num">
                      <AlertTriangle className="h-3 w-3" />
                      {formatSGD(remaining)} remaining
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default CategoryProgressList;
