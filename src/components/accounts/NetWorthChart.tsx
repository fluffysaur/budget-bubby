/**
 * NetWorthChart Component
 * Responsive Recharts Area Chart displaying:
 * - Net Worth history built only from real balance snapshots
 *   (see calculateMonthlyBalanceTrends: accounts count from their first update)
 * - "No History" empty state until there are at least 2 months of data
 */

import { useMemo } from "react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { CalendarCheck, TrendingUp } from "lucide-react";
import type { Account, AccountSnapshot } from "../../types/finance";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { calculateMonthlyBalanceTrends } from "../../lib/financialFormulas";
import { useCurrentMonth } from "../../hooks/useCurrentMonth";
import { TooltipPopover } from "../ui/TooltipPopover";
import { Card } from "../ui/Card";
import { CurrencyText } from "../ui/CurrencyText";
import { Button } from "../ui/Button";

export interface NetWorthDataPoint {
    date: string;
    netWorth: number;
}

export interface NetWorthChartProps {
    data?: NetWorthDataPoint[];
    accounts?: Account[];
    snapshots?: AccountSnapshot[];
    onUpdateBalances?: () => void;
    className?: string;
}

interface NetWorthTooltipEntry {
    dataKey: string;
    name: string;
    value: number;
    color?: string;
}

interface NetWorthCustomTooltipProps {
    active?: boolean;
    payload?: NetWorthTooltipEntry[];
    label?: string;
}

function CustomTooltip({ active, payload, label }: NetWorthCustomTooltipProps) {
    if (!active || !payload || !payload.length) return null;

    return (
        <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-(--shadow-cute) text-xs space-y-2 min-w-42.5">
            <div className="font-bold text-(--text-ink) font-display pb-1 border-b-2 border-(--border-ink)">
                {label}
            </div>
            {payload.map((entry) => (
                <div
                    key={entry.dataKey}
                    className="flex items-center justify-between gap-3"
                >
                    <span className="text-(--text-muted)">{entry.name}:</span>
                    <span className="text-indigo-600 dark:text-indigo-400">
                        <CurrencyText amount={entry.value} />
                    </span>
                </div>
            ))}
        </div>
    );
}

export function NetWorthChart({
    data,
    accounts,
    snapshots,
    onUpdateBalances,
    className = "",
}: NetWorthChartProps) {
    const currentM = useCurrentMonth();
    const chartData = useMemo<NetWorthDataPoint[]>(() => {
        if (data && data.length > 0) {
            return data;
        }
        return calculateMonthlyBalanceTrends(accounts || [], snapshots || [], 6, currentM).map(
            (point) => ({
                date: formatDisplayMonth(point.month),
                netWorth: point.netWorth,
            }),
        );
    }, [data, accounts, snapshots, currentM]);

    const hasHistory = chartData.length >= 2;
    const latestPoint = chartData[chartData.length - 1];

    return (
        <Card
            variant="white"
            padding="lg"
            className={className}
        >
            {/* Header & Chart Legends */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 mb-4 border-b-2 border-(--border-ink) gap-3">
                <div className="shrink-0">
                    <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        <h2 className="text-base sm:text-lg font-bold text-(--text-ink) font-display tracking-tight whitespace-nowrap">
                            Net Worth
                        </h2>
                        <TooltipPopover
                            title="Net Worth Formula"
                            ariaLabel="Net Worth Formula"
                            align="left"
                            className="shrink-0"
                        >
                            Net Worth = total of all account balances. Accounts are
                            included from their first balance update.
                        </TooltipPopover>
                    </div>
                </div>

                {/* Legend Pills */}
                <div className="flex items-center flex-wrap gap-2 text-xs font-semibold">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800/60">
                        <span className="h-2 w-2 rounded-full bg-indigo-600" />
                        <span>Net Worth</span>
                        {latestPoint && <span className="ml-1"><CurrencyText amount={latestPoint.netWorth} /></span>}
                    </div>

                </div>
            </div>

            {!hasHistory ? (
                <div
                    data-testid="net-worth-no-history"
                    className="flex flex-col items-center justify-center py-10 text-center"
                >
                    <h3 className="text-base font-bold text-(--text-ink) font-display">
                        No History
                    </h3>
                    <p className="mt-1.5 text-sm text-(--text-muted)">
                        Update balances monthly to see your trend.
                    </p>
                    {onUpdateBalances && (
                        <Button
                            variant="primary"
                            size="sm"
                            className="mt-4"
                            onClick={onUpdateBalances}
                            leftIcon={<CalendarCheck className="h-4 w-4" strokeWidth={2.5} />}
                        >
                            Update Balances
                        </Button>
                    )}
                </div>
            ) : (
            /* Chart Canvas */
            <div className="w-full h-72 sm:h-80">
                <ResponsiveContainer
                    width="100%"
                    height="100%"
                >
                    <AreaChart
                        data={chartData}
                        margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                    >
                        <defs>
                            <linearGradient
                                id="colorNetWorth"
                                x1="0"
                                y1="0"
                                x2="0"
                                y2="1"
                            >
                                <stop
                                    offset="5%"
                                    stopColor="#6366F1"
                                    stopOpacity={0.4}
                                />
                                <stop
                                    offset="95%"
                                    stopColor="#6366F1"
                                    stopOpacity={0.0}
                                />
                            </linearGradient>
                        </defs>
                        <CartesianGrid
                            strokeDasharray="3 3"
                            opacity={0.12}
                            vertical={false}
                        />
                        <XAxis
                            dataKey="date"
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 11, fill: "var(--text-faint)" }}
                        />
                        <YAxis
                            tickLine={false}
                            axisLine={false}
                            tick={{ fontSize: 10, fill: "var(--text-faint)" }}
                            tickFormatter={(v) => {
                                if (Math.abs(v) >= 1000) {
                                    return `S$${(v / 1000).toFixed(0)}k`;
                                }
                                return `S$${v}`;
                            }}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Area
                            type="monotone"
                            dataKey="netWorth"
                            name="Net Worth"
                            stroke="#6366F1"
                            strokeWidth={2.5}
                            fillOpacity={1}
                            fill="url(#colorNetWorth)"
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
            )}
        </Card>
    );
}

export default NetWorthChart;
