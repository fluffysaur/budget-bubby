/**
 * AmortizationChart Component
 * Responsive Recharts chart visualizing loan balance trajectories and payment breakdown:
 * - Tab 1: Balance Trajectory (Baseline vs With Prepayment over time)
 * - Tab 2: Principal vs Interest Breakdown (Cumulative Principal Paid vs Cumulative Interest Paid)
 */

import { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { TrendingDown, PieChart } from 'lucide-react';
import { formatSGD, formatSGDCompact } from '../../lib/currency';
import { formatDisplayMonth } from '../../lib/dateUtils';
import type { AmortizationScheduleRow } from '../../types/finance';

export interface AmortizationChartProps {
  baselineSchedule: AmortizationScheduleRow[];
  simulatedSchedule?: AmortizationScheduleRow[];
  hasPrepayment?: boolean;
  className?: string;
}

type ChartViewMode = 'trajectory' | 'breakdown';

interface ChartDataPoint {
  month: number;
  date: string;
  displayDate: string;
  baselineBalance: number;
  simulatedBalance?: number;
  cumulativePrincipal: number;
  cumulativeInterest: number;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs p-3 shadow-lg text-xs space-y-1.5 min-w-[190px]">
      <div className="font-bold text-slate-800 dark:text-slate-200 pb-1 border-b border-slate-100 dark:border-slate-800">
        {label}
      </div>
      {payload.map((entry: any) => {
        let colorClass = 'text-slate-700 dark:text-slate-300';
        if (entry.dataKey === 'baselineBalance') colorClass = 'text-slate-600 dark:text-slate-400 font-semibold';
        if (entry.dataKey === 'simulatedBalance') colorClass = 'text-emerald-600 dark:text-emerald-400 font-bold';
        if (entry.dataKey === 'cumulativePrincipal') colorClass = 'text-teal-600 dark:text-teal-400 font-semibold';
        if (entry.dataKey === 'cumulativeInterest') colorClass = 'text-amber-600 dark:text-amber-400 font-semibold';

        return (
          <div key={entry.dataKey} className="flex items-center justify-between gap-3">
            <span className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-xs shrink-0"
                style={{ backgroundColor: entry.color || entry.stroke }}
              />
              {entry.name}:
            </span>
            <span className={`font-semibold ${colorClass}`}>
              {formatSGD(entry.value)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function AmortizationChart({
  baselineSchedule,
  simulatedSchedule,
  hasPrepayment = false,
  className = '',
}: AmortizationChartProps) {
  const [viewMode, setViewMode] = useState<ChartViewMode>('trajectory');

  // Build unified sampled data points
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!baselineSchedule || baselineSchedule.length === 0) return [];

    const totalLength = Math.max(
      baselineSchedule.length,
      simulatedSchedule ? simulatedSchedule.length : 0
    );

    // Determine sampling stride so chart is lightweight and snappy
    // E.g., for 240 months, sample every 6 or 12 months, plus the start and end
    const stride = totalLength > 120 ? 6 : totalLength > 60 ? 3 : 1;

    const points: ChartDataPoint[] = [];

    // Initial point (Month 0 / starting balance)
    const initialBaseBalance =
      baselineSchedule[0].remainingBalance + baselineSchedule[0].principalPayment;
    const initialSimBalance = simulatedSchedule && simulatedSchedule.length > 0
      ? simulatedSchedule[0].remainingBalance + simulatedSchedule[0].principalPayment
      : initialBaseBalance;

    points.push({
      month: 0,
      date: baselineSchedule[0].paymentDate,
      displayDate: 'Start',
      baselineBalance: Math.round(initialBaseBalance),
      simulatedBalance: Math.round(initialSimBalance),
      cumulativePrincipal: 0,
      cumulativeInterest: 0,
    });

    let runningPrincipal = 0;

    for (let i = 0; i < totalLength; i++) {
      const isSampled = (i + 1) % stride === 0 || i === totalLength - 1;
      const baseRow = baselineSchedule[i];
      const simRow = simulatedSchedule ? simulatedSchedule[i] : undefined;

      if (baseRow) {
        runningPrincipal += baseRow.principalPayment;
      }

      if (isSampled) {
        const monthNum = i + 1;
        const dateStr = baseRow ? baseRow.paymentDate : simRow ? simRow.paymentDate : `Month ${monthNum}`;
        let displayDate = dateStr;
        try {
          displayDate = formatDisplayMonth(dateStr);
        } catch {
          displayDate = dateStr;
        }

        points.push({
          month: monthNum,
          date: dateStr,
          displayDate,
          baselineBalance: baseRow ? Math.max(0, Math.round(baseRow.remainingBalance)) : 0,
          simulatedBalance: simRow
            ? Math.max(0, Math.round(simRow.remainingBalance))
            : (simulatedSchedule && i >= simulatedSchedule.length ? 0 : undefined),
          cumulativePrincipal: Math.round(runningPrincipal),
          cumulativeInterest: baseRow ? Math.round(baseRow.totalInterestPaid) : 0,
        });
      }
    }

    return points;
  }, [baselineSchedule, simulatedSchedule]);

  const showSimulated = hasPrepayment || (simulatedSchedule && simulatedSchedule.length > 0 && simulatedSchedule.length !== baselineSchedule.length);

  return (
    <div
      data-testid="amortization-chart"
      className={`bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 shadow-sm ${className}`}
    >
      {/* Header & View Mode Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Loan Amortization Trajectory
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {viewMode === 'trajectory'
              ? 'Outstanding balance decline over loan lifetime (Baseline vs Prepayment).'
              : 'Cumulative breakdown between principal repayment and interest paid.'}
          </p>
        </div>

        {/* Mode Toggle Buttons */}
        <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-800 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('trajectory')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'trajectory'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5 text-emerald-500" />
            <span>Balance Trajectory</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('breakdown')}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              viewMode === 'breakdown'
                ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5 text-teal-500" />
            <span>Principal vs Interest</span>
          </button>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'trajectory' ? (
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="baselineGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#94a3b8" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="simulatedGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
                className="dark:stroke-slate-800"
              />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                minTickGap={30}
              />
              <YAxis
                tickFormatter={(val) => formatSGDCompact(val)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="baselineBalance"
                name="Baseline Balance"
                stroke="#64748b"
                strokeWidth={2}
                strokeDasharray={showSimulated ? '4 4' : undefined}
                fillOpacity={1}
                fill="url(#baselineGradient)"
              />
              {showSimulated && (
                <Area
                  type="monotone"
                  dataKey="simulatedBalance"
                  name="With Prepayment"
                  stroke="#10b981"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#simulatedGradient)"
                />
              )}
            </AreaChart>
          ) : (
            <AreaChart
              data={chartData}
              margin={{ top: 10, right: 15, left: 10, bottom: 5 }}
            >
              <defs>
                <linearGradient id="principalGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0d9488" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#0d9488" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e2e8f0"
                className="dark:stroke-slate-800"
              />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                minTickGap={30}
              />
              <YAxis
                tickFormatter={(val) => formatSGDCompact(val)}
                tick={{ fontSize: 11, fill: '#64748b' }}
                tickLine={false}
                axisLine={false}
                width={70}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                verticalAlign="top"
                align="right"
                wrapperStyle={{ paddingBottom: '12px', fontSize: '12px' }}
              />
              <Area
                type="monotone"
                dataKey="cumulativePrincipal"
                name="Principal Paid"
                stroke="#0d9488"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#principalGradient)"
              />
              <Area
                type="monotone"
                dataKey="cumulativeInterest"
                name="Interest Paid"
                stroke="#f59e0b"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#interestGradient)"
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default AmortizationChart;
