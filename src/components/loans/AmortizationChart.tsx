/**
 * AmortizationChart Component
 * Responsive Recharts chart visualizing loan balance trajectories and payment breakdown:
 * - Tab 1: Balance Trajectory (Baseline vs With Prepayment over time)
 * - Tab 2: Principal vs Interest Breakdown (Cumulative Principal Paid vs Cumulative Interest Paid)
 */

import { useState, useMemo } from "react";
import {
    ResponsiveContainer,
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
} from "recharts";
import { TrendingDown, PieChart } from "lucide-react";
import { formatSGD, formatSGDCompact } from "../../lib/currency";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { SegmentedTabs, type TabItem } from "../ui/SegmentedTabs";
import type { AmortizationScheduleRow } from "../../types/finance";

export interface AmortizationChartProps {
    baselineSchedule: AmortizationScheduleRow[];
    simulatedSchedule?: AmortizationScheduleRow[];
    hasPrepayment?: boolean;
    className?: string;
}

type ChartViewMode = "trajectory" | "breakdown";

interface ChartDataPoint {
    month: number;
    date: string;
    displayDate: string;
    baselineBalance: number;
    simulatedBalance?: number;
    cumulativePrincipal: number;
    cumulativeInterest: number;
}

interface TooltipEntry {
    dataKey: string;
    name: string;
    value: number;
    color?: string;
    stroke?: string;
}

interface CustomTooltipProps {
    active?: boolean;
    payload?: TooltipEntry[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-(--shadow-cute) text-xs space-y-1.5 min-w-48">
            <div className="font-bold text-(--text-ink) pb-1 border-b border-(--border-subtle) font-display">
                {label}
            </div>
            {payload.map((entry) => {
                let colorClass = "text-(--text-ink)";
                if (entry.dataKey === "baselineBalance") colorClass = "text-(--text-muted) font-semibold";
                if (entry.dataKey === "simulatedBalance") colorClass = "text-emerald-700 dark:text-emerald-400 font-bold";
                if (entry.dataKey === "cumulativePrincipal") colorClass = "text-teal-700 dark:text-teal-400 font-semibold";
                if (entry.dataKey === "cumulativeInterest") colorClass = "text-amber-700 dark:text-amber-400 font-semibold";

                return (
                    <div key={entry.dataKey} className="flex items-center justify-between gap-3">
                        <span className="text-(--text-muted) flex items-center gap-1.5">
                            <span
                                className="w-2.5 h-2.5 rounded-xs shrink-0 border border-(--border-ink)/40"
                                style={{ backgroundColor: entry.color || entry.stroke }}
                            />
                            {entry.name}:
                        </span>
                        <span className={`font-mono-num font-bold ${colorClass}`}>
                            {formatSGD(entry.value)}
                        </span>
                    </div>
                );
            })}
        </div>
    );
}

const VIEW_MODE_TABS: TabItem<ChartViewMode>[] = [
    {
        id: "trajectory",
        label: "Balance Trajectory",
        icon: <TrendingDown className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" strokeWidth={2.5} />,
    },
    {
        id: "breakdown",
        label: "Principal vs Interest",
        icon: <PieChart className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" strokeWidth={2.5} />,
    },
];

export function AmortizationChart({
    baselineSchedule,
    simulatedSchedule,
    hasPrepayment = false,
    className = "",
}: AmortizationChartProps) {
    const [viewMode, setViewMode] = useState<ChartViewMode>("trajectory");

    const chartData = useMemo<ChartDataPoint[]>(() => {
        if (!baselineSchedule || baselineSchedule.length === 0) return [];

        const totalLength = Math.max(
            baselineSchedule.length,
            simulatedSchedule ? simulatedSchedule.length : 0,
        );

        const stride = totalLength > 120 ? 6 : totalLength > 60 ? 3 : 1;
        const points: ChartDataPoint[] = [];

        const initialBaseBalance =
            baselineSchedule[0].remainingBalance + baselineSchedule[0].principalPayment;
        const initialSimBalance =
            simulatedSchedule && simulatedSchedule.length > 0
                ? simulatedSchedule[0].remainingBalance + simulatedSchedule[0].principalPayment
                : initialBaseBalance;

        points.push({
            month: 0,
            date: baselineSchedule[0].paymentDate,
            displayDate: "Start",
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
                let displayDate: string;
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
                        : simulatedSchedule && i >= simulatedSchedule.length
                          ? 0
                          : undefined,
                    cumulativePrincipal: Math.round(runningPrincipal),
                    cumulativeInterest: baseRow ? Math.round(baseRow.totalInterestPaid) : 0,
                });
            }
        }

        return points;
    }, [baselineSchedule, simulatedSchedule]);

    const showSimulated =
        hasPrepayment ||
        (simulatedSchedule &&
            simulatedSchedule.length > 0 &&
            simulatedSchedule.length !== baselineSchedule.length);

    return (
        <div
            data-testid="amortization-chart"
            className={`bg-(--bg-card) rounded-2xl border-2 border-(--border-ink) p-6 shadow-(--shadow-cute) ${className}`}
        >
            {/* Header & View Mode Switcher */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-(--border-subtle)">
                <div>
                    <h3 className="font-display font-black text-lg text-(--text-ink)">
                        Amortization Trajectory
                    </h3>
                    <p className="text-xs text-(--text-muted)">
                        {viewMode === "trajectory"
                            ? "Outstanding balance decline over loan lifetime (Baseline vs Prepayment)."
                            : "Cumulative breakdown between principal repayment and interest paid."}
                    </p>
                </div>

                {/* Mode Toggle Tabs */}
                <SegmentedTabs
                    tabs={VIEW_MODE_TABS}
                    activeTab={viewMode}
                    onChange={(mode) => setViewMode(mode as ChartViewMode)}
                    accent="butter"
                    size="sm"
                />
            </div>

            {/* Chart Canvas */}
            <div className="w-full h-80">
                <ResponsiveContainer width="100%" height="100%">
                    {viewMode === "trajectory" ? (
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
                                    <stop offset="5%" stopColor="#bbf7d0" stopOpacity={0.6} />
                                    <stop offset="95%" stopColor="#bbf7d0" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="var(--border-subtle)"
                                opacity={0.6}
                            />
                            <XAxis
                                dataKey="displayDate"
                                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                                tickLine={false}
                                axisLine={{ stroke: "var(--border-subtle)" }}
                                minTickGap={30}
                            />
                            <YAxis
                                tickFormatter={(val) => formatSGDCompact(val)}
                                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                                tickLine={false}
                                axisLine={{ stroke: "var(--border-subtle)" }}
                                width={55}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="top"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }}
                            />

                            <Area
                                type="monotone"
                                dataKey="baselineBalance"
                                name="Baseline Standard"
                                stroke="#57504b"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#baselineGradient)"
                            />

                            {showSimulated && (
                                <Area
                                    type="monotone"
                                    dataKey="simulatedBalance"
                                    name="With Prepayment"
                                    stroke="#14532d"
                                    strokeWidth={3}
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
                                    <stop offset="5%" stopColor="#dfc2ff" stopOpacity={0.5} />
                                    <stop offset="95%" stopColor="#dfc2ff" stopOpacity={0.0} />
                                </linearGradient>
                                <linearGradient id="interestGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#ffe999" stopOpacity={0.5} />
                                    <stop offset="95%" stopColor="#ffe999" stopOpacity={0.0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid
                                strokeDasharray="3 3"
                                vertical={false}
                                stroke="var(--border-subtle)"
                                opacity={0.6}
                            />
                            <XAxis
                                dataKey="displayDate"
                                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                                tickLine={false}
                                axisLine={{ stroke: "var(--border-subtle)" }}
                                minTickGap={30}
                            />
                            <YAxis
                                tickFormatter={(val) => formatSGDCompact(val)}
                                tick={{ fontSize: 11, fill: "var(--text-muted)" }}
                                tickLine={false}
                                axisLine={{ stroke: "var(--border-subtle)" }}
                                width={55}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                verticalAlign="top"
                                height={36}
                                iconType="circle"
                                wrapperStyle={{ fontSize: "12px", fontWeight: "bold" }}
                            />

                            <Area
                                type="monotone"
                                dataKey="cumulativePrincipal"
                                name="Cumulative Principal"
                                stroke="#7e22ce"
                                strokeWidth={2.5}
                                fillOpacity={1}
                                fill="url(#principalGradient)"
                            />

                            <Area
                                type="monotone"
                                dataKey="cumulativeInterest"
                                name="Cumulative Interest"
                                stroke="#d97706"
                                strokeWidth={2.5}
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
