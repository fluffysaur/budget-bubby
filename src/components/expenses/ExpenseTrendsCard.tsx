/**
 * Expense Trends & Monthly Averages Card
 * Displays:
 * - 3-Month & 6-Month Average Monthly Spend KPIs
 * - Current Month Spend vs Average delta badge
 * - Monthly Spend Bar Chart with Average Reference Line
 * - Category-level Monthly Averages vs Current Month (Food, Lifestyle, Transport, Buffer)
 */

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TrendingDown, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import { TooltipPopover } from '../ui/TooltipPopover';
import type { ExpenseTrendsSummary, MonthlyExpenseTrendPoint, CategoryAverageMetric } from '../../types/finance';

export interface ExpenseTrendsCardProps {
  trends: ExpenseTrendsSummary;
  perspectiveLabel?: string;
  className?: string;
}

export function ExpenseTrendsCard({
  trends,
  perspectiveLabel = 'Household',
  className = '',
}: ExpenseTrendsCardProps) {
  const {
    monthlySeries = [],
    rolling3MonthAvg = 0,
    rolling6MonthAvg = 0,
    currentMonthTotal = 0,
    vsAverageDelta = 0,
    categoryAverages = [],
  } = trends || {};

  const isBelowAvg = vsAverageDelta <= 0;
  const vsThreeMonthPct =
    rolling3MonthAvg > 0
      ? (vsAverageDelta / rolling3MonthAvg) * 100
      : 0;
  const pctString = Math.abs(vsThreeMonthPct).toFixed(1);

  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
            <BarChart3 className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Monthly Expense Trends &amp; Averages
              </h3>
              <TooltipPopover
                ariaLabel="Expense Trends Methodology"
                title="How Averages Are Calculated"
              >
                Tracks monthly spendable expenses (Food, Lifestyle, Transport, Buffer) including active monthly subscriptions in Lifestyle. In Personal view, shared 50/50 expenses count at your 50% share.
              </TooltipPopover>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {perspectiveLabel} • 6-month history &amp; category benchmarks
            </p>
          </div>
        </div>

        {/* Delta vs 3-Month Avg Badge */}
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
            isBelowAvg
              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300'
              : 'bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300'
          }`}
        >
          {isBelowAvg ? (
            <TrendingDown className="h-3.5 w-3.5" />
          ) : (
            <TrendingUp className="h-3.5 w-3.5" />
          )}
          <span>
            {vsAverageDelta <= 0 ? '' : '+'}
            {pctString}% vs 3-mo avg
          </span>
        </div>
      </div>

      {/* Top KPI Strip */}
      <div className="grid grid-cols-3 gap-2.5 sm:gap-4 my-4">
        <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800">
          <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            This Month
          </span>
          <span className="mt-1 block text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white">
            {formatSGD(currentMonthTotal)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Spendable + subs
          </span>
        </div>

        <div className="rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 p-3 border border-emerald-100/80 dark:border-emerald-900/40">
          <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            3-Month Avg
          </span>
          <span className="mt-1 block text-sm sm:text-lg font-extrabold text-emerald-800 dark:text-emerald-200">
            {formatSGD(rolling3MonthAvg)}
          </span>
          <span className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
            Rolling benchmark
          </span>
        </div>

        <div className="rounded-xl bg-slate-50/80 dark:bg-slate-800/50 p-3 border border-slate-100 dark:border-slate-800">
          <span className="block text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            6-Month Avg
          </span>
          <span className="mt-1 block text-sm sm:text-lg font-extrabold text-slate-900 dark:text-white">
            {formatSGD(rolling6MonthAvg)}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            Longer baseline
          </span>
        </div>
      </div>

      {/* Monthly Bar Chart */}
      <div className="h-48 sm:h-56 w-full mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={monthlySeries} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(val: number) => `S$${Math.round(val)}`}
              tick={{ fontSize: 11, fill: '#64748b' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              formatter={(value: any) => [formatSGD(Number(value) || 0), 'Monthly Spend']}
              contentStyle={{
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                fontSize: '12px',
              }}
            />
            {rolling3MonthAvg > 0 && (
              <ReferenceLine
                y={rolling3MonthAvg}
                stroke="#059669"
                strokeDasharray="4 4"
                label={{
                  value: `Avg ${formatSGD(rolling3MonthAvg)}`,
                  position: 'insideTopRight',
                  fill: '#059669',
                  fontSize: 10,
                }}
              />
            )}
            <Bar dataKey="totalSpent" radius={[8, 8, 0, 0]} maxBarSize={42}>
              {monthlySeries.map((pt: MonthlyExpenseTrendPoint, index: number) => {
                const isLatest = index === monthlySeries.length - 1;
                return (
                  <Cell
                    key={pt.month}
                    fill={isLatest ? '#10b981' : '#94a3b8'}
                    fillOpacity={isLatest ? 0.95 : 0.65}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Per-Category Monthly Averages vs Current Month */}
      {categoryAverages.length > 0 && (
        <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
              Category Monthly Averages vs This Month
            </span>
            <span className="text-[11px] text-slate-400">Current / Avg</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {categoryAverages.map((cat: CategoryAverageMetric) => {
              const ratio =
                cat.averageMonthly > 0
                  ? Math.min(100, (cat.currentMonth / cat.averageMonthly) * 100)
                  : 0;
              const isOverAvg = cat.currentMonth > cat.averageMonthly && cat.averageMonthly > 0;
              return (
                <div
                  key={cat.categoryId}
                  className="rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: cat.color }}
                      />
                      {cat.categoryName}
                    </span>
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      <strong className={isOverAvg ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'}>
                        {formatSGD(cat.currentMonth)}
                      </strong>{' '}
                      <span className="text-slate-400">/ avg {formatSGD(cat.averageMonthly)}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 w-full rounded-full bg-slate-200/80 dark:bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${ratio}%`,
                        backgroundColor: isOverAvg ? '#f59e0b' : cat.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ExpenseTrendsCard;
