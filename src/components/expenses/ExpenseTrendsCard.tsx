/**
 * Expense Trends & Monthly Averages Card
 * Streamlined with PR #9 visual meters:
 * - Current month hero total paired with DeltaBadge vs 3-mo avg
 * - Lightweight Sparkline showing 6-month spend history without heavy Recharts
 * - Category averages with MeterBar markers behind an expandable "More" toggle
 */

import { useState } from "react";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { TooltipPopover } from "../ui/TooltipPopover";
import { Card } from "../ui/Card";
import { Sparkline } from "../ui/Sparkline";
import { DeltaBadge } from "../ui/DeltaBadge";
import { MeterBar } from "../ui/MeterBar";
import type {
    ExpenseTrendsSummary,
    CategoryAverageMetric,
} from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface ExpenseTrendsCardProps {
    trends: ExpenseTrendsSummary;
    perspectiveLabel?: string;
    className?: string;
}

export function ExpenseTrendsCard({
    trends,
    perspectiveLabel = "Household",
    className = "",
}: ExpenseTrendsCardProps) {
    const [showCategoryDetails, setShowCategoryDetails] = useState(false);

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
        rolling3MonthAvg > 0 ? (vsAverageDelta / rolling3MonthAvg) * 100 : 0;

    const sparklineData = monthlySeries.map((pt) => pt.totalSpent);

    return (
        <Card variant="white" padding="md" className={className}>
            {/* Header: Hero amount, DeltaBadge, and Tooltip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-(--border-subtle)">
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            This Month
                        </span>
                        <TooltipPopover
                            ariaLabel="Expense Trends Methodology"
                            title="How Averages Are Calculated"
                        >
                            Spendable categories plus subscriptions. Personal view
                            uses your share.
                        </TooltipPopover>
                    </div>
                    <div className="font-display font-black text-xl sm:text-2xl text-(--text-ink) font-mono-num mt-0.5">
                        <CurrencyText amount={currentMonthTotal} />
                    </div>
                    <span className="text-[11px] text-(--text-muted)">
                        {perspectiveLabel} • 6 months
                    </span>
                </div>

                <div className="flex flex-col items-end gap-1.5">
                    <DeltaBadge
                        value={vsThreeMonthPct}
                        goodWhen="down"
                        label="vs 3-mo avg"
                    />
                    <span className="text-[11px] text-(--text-muted) font-mono-num">
                        3-mo avg: <CurrencyText formatted={formatSGD(rolling3MonthAvg, { showCents: false })} />
                    </span>
                </div>
            </div>

            {/* Sparkline History Visual */}
            <div className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-(--border-subtle)">
                <div>
                    <span className="text-xs font-bold text-(--text-ink)">
                        6-Month Trend
                    </span>
                    <span className="block text-[11px] text-(--text-muted)">
                        Baseline avg: <CurrencyText formatted={formatSGD(rolling6MonthAvg, { showCents: false })} />
                    </span>
                </div>
                <div className="w-full sm:w-auto flex justify-end">
                    <Sparkline
                        data={sparklineData}
                        width={180}
                        height={32}
                        tone={isBelowAvg ? "ok" : "over"}
                        aria-label="6-month spend trend line"
                    />
                </div>
            </div>

            {/* Expandable Per-Category Averages vs Current Month */}
            {categoryAverages.length > 0 && (
                <div className="pt-2">
                    <button
                        type="button"
                        onClick={() => setShowCategoryDetails((prev) => !prev)}
                        className="flex items-center justify-between w-full text-xs font-bold text-(--text-muted) hover:text-(--text-ink) py-1.5 cursor-pointer transition-colors"
                        aria-expanded={showCategoryDetails}
                    >
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5 text-emerald-500" />
                            <span>Vs Average ({categoryAverages.length})</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono-num text-[11px]">
                            {showCategoryDetails ? (
                                <ChevronUp className="h-4 w-4" strokeWidth={2.5} />
                            ) : (
                                <ChevronDown className="h-4 w-4" strokeWidth={2.5} />
                            )}
                        </span>
                    </button>

                    {showCategoryDetails && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                            {categoryAverages.map((cat: CategoryAverageMetric) => {
                                const isOver =
                                    cat.averageMonthly > 0 &&
                                    cat.currentMonth > cat.averageMonthly;
                                return (
                                    <div
                                        key={cat.categoryId}
                                        className="rounded-xl border border-(--border-subtle) bg-(--bg-cream) p-2 text-xs shadow-cute-sm"
                                    >
                                        <div className="flex items-center justify-between gap-1 mb-1.5">
                                            <span className="font-bold text-(--text-ink) flex items-center gap-1.5 min-w-0 truncate">
                                                <span
                                                    className="h-2 w-2 rounded-full border border-(--border-ink) shrink-0"
                                                    style={{ backgroundColor: cat.color }}
                                                />
                                                <span className="truncate">{cat.categoryName}</span>
                                            </span>
                                            <span className="font-mono-num font-bold shrink-0 text-[11px]">
                                                <CurrencyText amount={cat.currentMonth} />
                                                <span className="text-(--text-muted) font-normal">
                                                    {" "}
                                                    / <CurrencyText formatted={formatSGD(cat.averageMonthly, { showCents: false })} />
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
                                            tone={isOver ? "over" : "ok"}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
}

export default ExpenseTrendsCard;
