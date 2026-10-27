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
import { TooltipPopover } from '../ui/TooltipPopover';
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
      <div
        className={`rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-8 text-center ${className}`}
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-400">
          <HelpCircle className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-slate-800 dark:text-slate-200">
          No Budget Categories
        </h3>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          No budget categories found for this month.
        </p>
      </div>
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
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200">
          <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400 shrink-0" />
          <div className="text-xs sm:text-sm">
            <span className="font-bold">
              {overBudgetCategories.length} {overBudgetCategories.length === 1 ? 'category has' : 'categories have'} exceeded budget:
            </span>{' '}
            <span>
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
          let statusBadgeClass =
            'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800';
          let progressBarColor = 'bg-emerald-500';
          let StatusIcon = CheckCircle2;

          if (isOverBudget) {
            statusLabel = 'Over Budget';
            statusBadgeClass =
              'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800';
            progressBarColor = 'bg-rose-500';
            StatusIcon = AlertCircle;
          } else if (isNearLimit) {
            statusLabel = 'Near Limit';
            statusBadgeClass =
              'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800';
            progressBarColor = 'bg-amber-500';
            StatusIcon = AlertTriangle;
          }

          const fillWidth = Math.max(0, Math.min(spentPercentage, 100));

          return (
            <div
              key={catDetail.id || catDetail.category_id}
              onClick={() => onCategoryClick?.(catDetail.category_id)}
              className={`rounded-2xl border bg-white dark:bg-slate-900 ${
                compact ? 'p-3.5 sm:p-4' : 'p-4 sm:p-5'
              } shadow-xs transition-all ${
                isOverBudget
                  ? 'border-rose-200 dark:border-rose-900/60'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              } ${onCategoryClick ? 'cursor-pointer' : ''}`}
            >
              {/* Card Header: Icon, Name, Target % & Status Badge */}
              <div className="flex items-center justify-between gap-2 mb-2.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-xs"
                    style={{ backgroundColor: categoryColor }}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-sm text-slate-900 dark:text-white truncate">
                        {categoryName}
                      </span>
                      <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500">
                        ({Math.round(catDetail.percentage * 100)}%)
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
                      <div className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                        <Repeat className="h-2.5 w-2.5 text-emerald-500" />
                        <span>Includes {formatSGD(subSpent)} recurring subs</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Status Indicator Badge */}
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border shrink-0 ${statusBadgeClass}`}
                >
                  <StatusIcon className="h-3 w-3" />
                  <span>{statusLabel} ({roundedPercentage}%)</span>
                </div>
              </div>

              {/* Amounts Grid: Spent vs Budgeted vs Remaining */}
              <div className="grid grid-cols-3 gap-2 my-2.5 text-left">
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                    Spent
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {formatSGD(actual)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                    Budgeted
                  </span>
                  <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                    {formatSGD(allocated)}
                  </span>
                </div>
                <div>
                  <span className="block text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">
                    Remaining
                  </span>
                  <span
                    className={`text-sm font-bold ${
                      remaining < 0
                        ? 'text-rose-600 dark:text-rose-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                    }`}
                  >
                    {formatSGD(remaining)}
                  </span>
                </div>
              </div>

              {/* Progress Bar Meter */}
              <div className="space-y-1.5 mt-2.5">
                <div className="h-2 w-full rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
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
                  <div className="flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400 font-semibold pt-0.5">
                    <span className="flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      Over by {formatSGD(Math.abs(remaining))}
                    </span>
                    <span
                      data-testid={`badge-rose-${catDetail.category_id}`}
                      className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px] border border-rose-300 dark:border-rose-800"
                    >
                      Rose Cap Exceeded
                    </span>
                  </div>
                ) : isNearLimit ? (
                  <div className="flex items-center justify-between text-[11px] text-amber-600 dark:text-amber-400 font-semibold pt-0.5">
                    <span className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {formatSGD(remaining)} remaining
                    </span>
                    <span
                      data-testid={`badge-amber-${catDetail.category_id}`}
                      className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[10px] border border-amber-300 dark:border-amber-800"
                    >
                      Amber Guardrail
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
