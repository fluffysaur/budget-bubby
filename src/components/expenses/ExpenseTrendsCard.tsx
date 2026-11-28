/**
 * Expense Trend Card
 * Always-open card: 6-month spend bars with a 3-month average line, plus the
 * categories running over their monthly average (or the top categories).
 */

import { useMemo, useState } from "react";
import {
    Bar,
    BarChart,
    Cell,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
} from "recharts";
import { formatSGDEstimate } from "../../lib/currency";
import { MONTH_NAMES_SHORT } from "../../lib/dateUtils";
import { Card } from "../ui/Card";
import { CurrencyText } from "../ui/CurrencyText";
import { MeterBar } from "../ui/MeterBar";
import { TooltipPopover } from "../ui/TooltipPopover";
import { TruncatedText } from "../ui/TruncatedText";
import type {
    CategoryAverageMetric,
    ExpenseTrendsSummary,
} from "../../types/finance";

export interface ExpenseTrendsCardProps {
    trends: ExpenseTrendsSummary;
    className?: string;
}

const COLLAPSED_ROWS = 3;

interface TrendBarPoint {
    month: string;
    label: string;
    total: number;
}

interface TrendTooltipProps {
    active?: boolean;
    payload?: { payload: TrendBarPoint }[];
}

function TrendTooltip({ active, payload }: TrendTooltipProps) {
    if (!active || !payload?.length) return null;
    const point = payload[0].payload;
    return (
        <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) px-3 py-2 shadow-cute text-xs">
            <div className="font-bold text-(--text-ink) font-display">
                {point.label}
            </div>
            <div className="text-(--text-muted) font-mono-num">
                <CurrencyText amount={point.total} />
            </div>
        </div>
    );
}

function monthShortName(month: string): string {
    const idx = parseInt(month.slice(5, 7), 10) - 1;
    return MONTH_NAMES_SHORT[idx] ?? month;
}

function overage(cat: CategoryAverageMetric): number {
    return cat.averageMonthly > 0 ? cat.currentMonth - cat.averageMonthly : 0;
}

function CategoryRow({ cat }: { cat: CategoryAverageMetric }) {
    const isOver =
        cat.averageMonthly > 0 && cat.currentMonth > cat.averageMonthly;
    return (
        <li className="space-y-1" data-testid={`trend-cat-${cat.categoryId}`}>
            <div className="flex items-center gap-2 text-xs">
                <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-(--border-ink)"
                    style={{ backgroundColor: cat.color }}
                    aria-hidden="true"
                />
                <span className="min-w-0 flex-1 font-bold text-(--text-ink)">
                    <TruncatedText text={cat.categoryName} />
                </span>
                <span className="shrink-0 font-mono-num font-bold text-(--text-ink)">
                    <CurrencyText amount={cat.currentMonth} />
                    <span className="font-normal text-(--text-muted)">
                        {" / "}
                        <CurrencyText
                            formatted={formatSGDEstimate(cat.averageMonthly)}
                        />{" "}
                        avg
                    </span>
                </span>
            </div>
            <MeterBar
                value={cat.currentMonth}
                max={
                    cat.averageMonthly > 0
                        ? Math.max(cat.averageMonthly, cat.currentMonth)
                        : cat.currentMonth
                }
                marker={cat.averageMonthly}
                size="sm"
                tone={isOver ? "near" : "ok"}
                aria-label={`${cat.categoryName} vs average`}
            />
        </li>
    );
}

export function ExpenseTrendsCard({
    trends,
    className = "",
}: ExpenseTrendsCardProps) {
    const [expanded, setExpanded] = useState(false);

    const monthlySeries = trends?.monthlySeries;
    const categoryAverages = trends?.categoryAverages;
    const rolling3MonthAvg = trends?.rolling3MonthAvg ?? 0;
    const vsAverageDelta = trends?.vsAverageDelta ?? 0;

    const chartData = useMemo<TrendBarPoint[]>(
        () =>
            (monthlySeries ?? []).map((pt) => ({
                month: pt.month,
                label: pt.label,
                total: pt.totalSpent,
            })),
        [monthlySeries],
    );

    const { rows, heading } = useMemo(() => {
        const cats = categoryAverages ?? [];
        const over = cats
            .filter(
                (c) =>
                    c.averageMonthly > 0 && c.currentMonth > c.averageMonthly,
            )
            .sort((a, b) => overage(b) - overage(a));
        if (over.length > 0) {
            const rest = cats
                .filter((c) => !over.includes(c))
                .sort((a, b) => b.currentMonth - a.currentMonth);
            return { rows: [...over, ...rest], heading: "Over average" };
        }
        return {
            rows: [...cats].sort((a, b) => b.currentMonth - a.currentMonth),
            heading: "Top categories",
        };
    }, [categoryAverages]);

    const hasHistory = chartData.some((pt) => pt.total > 0);
    const vsThreeMonthPct =
        rolling3MonthAvg > 0 ? (vsAverageDelta / rolling3MonthAvg) * 100 : 0;
    const deltaPct = Math.round(vsThreeMonthPct);
    const visibleRows = expanded ? rows : rows.slice(0, COLLAPSED_ROWS);
    const lastIdx = chartData.length - 1;

    return (
        <Card
            variant="white"
            padding="md"
            data-testid="expense-trends-card"
            className={className}
        >
            <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1.5">
                    <h3 className="text-sm font-black font-display text-(--text-ink)">
                        Trend
                    </h3>
                    <TooltipPopover
                        ariaLabel="How to read the trend"
                        title="Reading the Trend"
                    >
                        <ul className="space-y-1.5">
                            <li>
                                Bars are monthly spend; the highlighted bar is
                                this month.
                            </li>
                            <li>
                                The dashed line is your average for the 3 months
                                before this one.
                            </li>
                            <li>
                                Category rows: the bar is this month&rsquo;s
                                spend, the tick is that category&rsquo;s average
                                over the past months shown. Yellow means over
                                average, green means under.
                            </li>
                            <li>
                                Counts spendable categories plus subscriptions.
                                Personal view uses your share.
                            </li>
                        </ul>
                    </TooltipPopover>
                </div>
                {hasHistory && rolling3MonthAvg > 0 && (
                    <span
                        data-testid="trend-delta"
                        className={`shrink-0 font-mono-num text-xs font-bold ${
                            deltaPct > 0
                                ? "text-(--tone-over-text) dark:text-rose-200"
                                : deltaPct < 0
                                  ? "text-(--tone-ok-text) dark:text-(--pastel-mint)"
                                  : "text-(--text-muted)"
                        }`}
                    >
                        {deltaPct > 0 ? "+" : deltaPct < 0 ? "−" : ""}
                        {Math.abs(deltaPct)}% vs avg{" "}
                        <CurrencyText
                            formatted={formatSGDEstimate(rolling3MonthAvg)}
                        />
                    </span>
                )}
            </div>

            <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-6">
                {!hasHistory ? (
                    <div className="py-4 text-center">
                        <p className="text-sm font-bold font-display text-(--text-ink)">
                            No History
                        </p>
                        <p className="text-xs text-(--text-muted)">
                            Log expenses to see your trend.
                        </p>
                    </div>
                ) : (
                    <div
                        role="img"
                        aria-label="Spend over 6 months"
                        className="mt-3 h-35 w-full"
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={chartData}
                                margin={{
                                    top: 8,
                                    right: 4,
                                    left: 4,
                                    bottom: 0,
                                }}
                            >
                                <XAxis
                                    dataKey="month"
                                    tickFormatter={monthShortName}
                                    tickLine={false}
                                    axisLine={false}
                                    tick={{
                                        fontSize: 11,
                                        fill: "var(--text-faint)",
                                    }}
                                />
                                <Tooltip
                                    content={<TrendTooltip />}
                                    cursor={{ fill: "var(--bg-cream)" }}
                                />
                                <Bar
                                    dataKey="total"
                                    radius={[6, 6, 0, 0]}
                                    maxBarSize={36}
                                    isAnimationActive={false}
                                >
                                    {chartData.map((pt, idx) => (
                                        <Cell
                                            key={pt.month}
                                            fill={
                                                idx === lastIdx
                                                    ? "var(--pastel-lilac)"
                                                    : "var(--meter-track)"
                                            }
                                            stroke="var(--border-ink)"
                                            strokeWidth={
                                                idx === lastIdx ? 2 : 1
                                            }
                                        />
                                    ))}
                                </Bar>
                                {rolling3MonthAvg > 0 && (
                                    <ReferenceLine
                                        y={rolling3MonthAvg}
                                        stroke="var(--text-muted)"
                                        strokeDasharray="4 4"
                                    />
                                )}
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                )}

                {rows.length > 0 && (
                    <div className="mt-3 border-t border-(--border-subtle) pt-3 lg:mt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6">
                        <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                {heading}
                            </span>
                            {rows.length > COLLAPSED_ROWS && (
                                <button
                                    type="button"
                                    onClick={() => setExpanded((prev) => !prev)}
                                    aria-expanded={expanded}
                                    className="min-h-11 cursor-pointer px-2 text-xs font-bold text-(--text-muted) transition-colors hover:text-(--text-ink)"
                                >
                                    {expanded ? "Show less" : "See all"}
                                </button>
                            )}
                        </div>
                        <ul className="space-y-2.5">
                            {visibleRows.map((cat) => (
                                <CategoryRow key={cat.categoryId} cat={cat} />
                            ))}
                        </ul>
                    </div>
                )}
            </div>
        </Card>
    );
}

export default ExpenseTrendsCard;
