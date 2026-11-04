/**
 * RenewalCalendar Component
 * Visual 12-Month Renewal Calendar & Outlay Map:
 * - Jan - Dec timeline displaying total cash outlay required for each calendar month.
 * - Highlights heavy renewal months (e.g., September Manulife $3,200, October IncomeShield $1,600).
 * - Visual indicator badge and ring for current calendar month.
 * - Displays recurring item cards/chips in their designated renewal month.
 */

import { useMemo } from "react";
import { Calendar, Flame } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import {
    formatDueInDays,
    getDaysUntilDue,
    getNextDueDate,
    getSingaporeDate,
    MONTH_NAMES_SHORT,
    MONTH_NAMES_FULL,
} from "../../lib/dateUtils";
import { TruncatedText } from "../ui/TruncatedText";
import { RECURRING_TYPE_ICONS } from "../../lib/recurringItems";
import type { RecurringItem, RecurringItemType } from "../../types/finance";

const TYPE_ICON_COLORS: Record<RecurringItemType, string> = {
    insurance: "text-blue-500",
    tax: "text-purple-500",
    subscription: "text-amber-500",
    bill: "text-emerald-600",
    other: "text-slate-400",
};

export interface RenewalCalendarProps {
    recurringItems: RecurringItem[];
    currentMonth?: number; // 1 - 12
    className?: string;
    /** Overrides "today" (Singapore time) for "Due in X days" labels. */
    referenceDate?: Date;
}

interface MonthData {
    monthNumber: number; // 1 - 12
    monthShort: string;
    monthFull: string;
    totalOutlay: number;
    isCurrent: boolean;
    isHeavy: boolean;
    isMaxMonth: boolean;
    recurringItems: RecurringItem[];
}

export function RenewalCalendar({
    recurringItems,
    currentMonth,
    className = "",
    referenceDate,
}: RenewalCalendarProps) {
    // Resolve current active month (1-12)
    const resolvedCurrentMonth = useMemo(() => {
        if (currentMonth && currentMonth >= 1 && currentMonth <= 12) {
            return currentMonth;
        }
        const sgNow = getSingaporeDate();
        return sgNow.getMonth() + 1; // 1-12
    }, [currentMonth]);

    // Compute 12-month data breakdown
    const { monthBreakdown } = useMemo(() => {
        const monthlyTotals = Array(12).fill(0);
        const monthItemsMap: RecurringItem[][] = Array.from(
            { length: 12 },
            () => [],
        );

        for (const recurringItem of recurringItems) {
            if (recurringItem.frequency === "monthly") {
                for (let m = 0; m < 12; m++) {
                    monthlyTotals[m] += recurringItem.amount;
                    monthItemsMap[m].push(recurringItem);
                }
            } else if (
                recurringItem.payment_month &&
                recurringItem.payment_month >= 1 &&
                recurringItem.payment_month <= 12
            ) {
                const idx = recurringItem.payment_month - 1;
                monthlyTotals[idx] += recurringItem.amount;
                monthItemsMap[idx].push(recurringItem);
            }
        }

        const max = Math.max(...monthlyTotals, 0);
        const total = monthlyTotals.reduce((sum, val) => sum + val, 0);
        const avg = total / 12;

        const breakdown: MonthData[] = monthlyTotals.map((outlay, idx) => {
            const monthNum = idx + 1;
            const isMax = max > 0 && outlay === max;
            // Flag as heavy if outlay is substantial (>= $500) and represents peak demand
            const isHeavy =
                outlay >= 500 &&
                ((isMax && max > Math.min(...monthlyTotals)) ||
                    (avg > 0 && outlay > avg * 1.3));

            return {
                monthNumber: monthNum,
                monthShort: MONTH_NAMES_SHORT[idx],
                monthFull: MONTH_NAMES_FULL[idx],
                totalOutlay: Math.round(outlay * 100) / 100,
                isCurrent: monthNum === resolvedCurrentMonth,
                isHeavy,
                isMaxMonth: isMax,
                recurringItems: monthItemsMap[idx],
            };
        });

        return {
            monthBreakdown: breakdown,
            maxOutlay: max,
            totalAnnualOutlay: total,
            averageMonthlyOutlay: avg,
        };
    }, [recurringItems, resolvedCurrentMonth]);

    // "Due in X days" for items whose next due date falls in the current month
    const getCurrentMonthDueLabel = (
        item: RecurringItem,
        monthNumber: number,
    ): string | null => {
        const today = referenceDate ?? getSingaporeDate();
        const next = getNextDueDate(item, today);
        if (!next || next.getMonth() + 1 !== monthNumber) return null;
        const days = getDaysUntilDue(item, today);
        return days === null ? null : formatDueInDays(days);
    };

    // Type icon helper
    const renderItemIcon = (type: RecurringItemType) => {
        const Icon = RECURRING_TYPE_ICONS[type] ?? Calendar;
        return (
            <Icon
                className={`w-3 h-3 shrink-0 ${TYPE_ICON_COLORS[type] ?? "text-slate-400"}`}
            />
        );
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Calendar Header / Overview */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-(--text-ink) font-display">
                            Annual Renewal Timeline &amp; Cash Outlay Map
                        </h3>
                        <p className="text-xs text-(--text-muted)">
                            12-Month distribution of annual lump sums and
                            monthly recurring commitments
                        </p>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center gap-3 text-xs font-bold text-(--text-ink)">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-(--pastel-mint) border-2 border-(--border-ink)" />
                        <span>Today / Active</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-(--pastel-coral) border-2 border-(--border-ink)" />
                        <span>Heavy Outlay</span>
                    </div>
                </div>
            </div>

            {/* 12-Month Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                {monthBreakdown.map((m) => {
                    return (
                        <div
                            key={m.monthNumber}
                            className={`relative flex flex-col rounded-2xl p-4 transition-all border-2 border-(--border-ink) ${
                                m.isCurrent
                                    ? "bg-(--pastel-mint) shadow-(--shadow-cute)"
                                    : m.isHeavy
                                      ? "bg-[#fff1ee] dark:bg-[#3b1c19] shadow-(--shadow-cute-sm)"
                                      : "bg-(--bg-card) shadow-(--shadow-cute-sm)"
                            }`}
                        >
                            {/* Header: Month Name + Badges */}
                            <div className="flex items-start justify-between gap-1 mb-2">
                                <div>
                                    <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                        {m.monthShort}
                                    </span>
                                    <p className="text-sm font-bold text-(--text-ink) font-display">
                                        {m.monthFull}
                                    </p>
                                </div>

                                <div className="flex flex-col items-end gap-1">
                                    {m.isCurrent && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-white text-(--text-ink) border-2 border-(--border-ink)">
                                            Current
                                        </span>
                                    )}
                                    {m.isHeavy && (
                                        <span
                                            title="Heavy Outlay Month"
                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-(--pastel-coral) text-white border-2 border-(--border-ink)"
                                        >
                                            <Flame className="w-2.5 h-2.5 fill-white text-white" />
                                            Heavy
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Total Monthly Outlay */}
                            <div className="mb-3">
                                <span className="text-[11px] font-medium text-(--text-muted)">
                                    Total Outlay
                                </span>
                                <p
                                    className={`text-base font-extrabold font-mono-num tracking-tight ${
                                        m.isHeavy
                                            ? "text-rose-600 dark:text-rose-400"
                                            : m.totalOutlay > 0
                                              ? "text-(--text-ink)"
                                              : "text-(--text-muted) opacity-60"
                                    }`}
                                >
                                    {formatSGD(m.totalOutlay)}
                                </p>
                            </div>

                            {/* Policy Chips in this Month */}
                            <div className="flex-1 flex flex-col gap-2 min-h-[68px]">
                                {m.recurringItems.length === 0 ? (
                                    <div className="flex-1 flex items-center justify-center text-[11px] text-(--text-muted) italic">
                                        No renewals
                                    </div>
                                ) : (
                                    m.recurringItems.map((p) => {
                                        const dueLabel = m.isCurrent
                                            ? getCurrentMonthDueLabel(
                                                  p,
                                                  m.monthNumber,
                                              )
                                            : null;
                                        return (
                                            <div
                                                key={`${m.monthNumber}-${p.id}`}
                                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink) text-xs shadow-(--shadow-cute-sm)"
                                            >
                                                <div className="flex items-center gap-1 min-w-0 flex-1">
                                                    {renderItemIcon(p.type)}
                                                    <div className="font-bold text-(--text-ink) min-w-0 flex-1">
                                                        <TruncatedText
                                                            text={p.name}
                                                        />
                                                        {dueLabel && (
                                                            <span className="block text-[10px] font-semibold text-(--text-muted)">
                                                                {dueLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="font-bold font-mono-num text-(--text-ink) shrink-0 text-[11px]">
                                                    {formatSGD(p.amount)}
                                                </span>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default RenewalCalendar;
