/**
 * RenewalCalendar Component
 * One year of recurring outlay at a glance:
 * - Year stepper (any year); tapping the year jumps back to this year.
 * - 12 compact month cards. Each fills with lilac from the bottom in
 *   proportion to its total versus the year's biggest month.
 * - The current month's label is highlighted; the tapped month is pressed in.
 * - Panel below lists the selected month's annual items, then monthly items.
 * - Items only count in months where they are active (start/end dates).
 */

import { useMemo, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
    formatDueInDays,
    getDaysUntilDue,
    getNextDueDate,
    getSingaporeDate,
    MONTH_NAMES_SHORT,
    MONTH_NAMES_FULL,
} from "../../lib/dateUtils";
import { formatSGD, formatSGDCompact } from "../../lib/currency";
import {
    buildYearOutlay,
    RECURRING_TYPE_ICONS,
} from "../../lib/recurringItems";
import { TruncatedText } from "../ui/TruncatedText";
import { CurrencyText } from "../ui/CurrencyText";
import { Button } from "../ui/Button";
import type { RecurringItem, RecurringItemType } from "../../types/finance";

const TYPE_ICON_COLORS: Record<RecurringItemType, string> = {
    insurance: "text-blue-500",
    tax: "text-purple-500",
    subscription: "text-amber-500",
    bill: "text-emerald-600",
    other: "text-(--text-faint)",
};

export interface RenewalCalendarProps {
    recurringItems: RecurringItem[];
    className?: string;
    /** Overrides "today" (Singapore time) for the current month and due labels. */
    referenceDate?: Date;
}

export function RenewalCalendar({
    recurringItems,
    className = "",
    referenceDate,
}: RenewalCalendarProps) {
    const today = useMemo(
        () => referenceDate ?? getSingaporeDate(),
        [referenceDate],
    );
    const thisYear = today.getFullYear();
    const thisMonth = today.getMonth() + 1;

    const [year, setYear] = useState<number>(thisYear);
    const [selectedMonth, setSelectedMonth] = useState<number>(thisMonth);

    const months = useMemo(
        () => buildYearOutlay(recurringItems, year),
        [recurringItems, year],
    );
    const maxTotal = Math.max(...months.map((m) => m.total), 0);
    const selected = months[selectedMonth - 1];
    const isCurrentYear = year === thisYear;

    // "Due in X days" only for this month's items
    const getDueLabel = (item: RecurringItem): string | null => {
        if (!isCurrentYear || selectedMonth !== thisMonth) return null;
        const next = getNextDueDate(item, today);
        if (!next || next.getMonth() + 1 !== thisMonth) return null;
        const days = getDaysUntilDue(item, today);
        return days === null ? null : formatDueInDays(days);
    };

    const renderItem = (item: RecurringItem) => {
        const Icon = RECURRING_TYPE_ICONS[item.type] ?? Calendar;
        const dueLabel = getDueLabel(item);
        return (
            <li
                key={item.id}
                className="flex items-center justify-between gap-2 py-1.5 text-xs"
            >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <Icon
                        className={`w-3.5 h-3.5 shrink-0 ${TYPE_ICON_COLORS[item.type] ?? "text-(--text-faint)"}`}
                    />
                    <div className="font-bold text-(--text-ink) min-w-0 flex-1">
                        <TruncatedText text={item.name} />
                        {dueLabel && (
                            <span className="block text-[10px] font-semibold text-(--text-muted)">
                                {dueLabel}
                            </span>
                        )}
                    </div>
                </div>
                <span className="text-(--text-ink) shrink-0">
                    <CurrencyText amount={item.amount} size="sm" />
                </span>
            </li>
        );
    };

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Header: title + year stepper */}
            <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                        <Calendar className="w-5 h-5" />
                    </div>
                    <h3 className="text-base font-bold text-(--text-ink) font-display">
                        Calendar
                    </h3>
                </div>

                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Previous year"
                        onClick={() => setYear((y) => y - 1)}
                        leftIcon={<ChevronLeft className="w-4 h-4" />}
                    />
                    <button
                        type="button"
                        onClick={() => setYear(thisYear)}
                        disabled={isCurrentYear}
                        aria-label={
                            isCurrentYear
                                ? `${year}`
                                : `${year}, jump to ${thisYear}`
                        }
                        title={
                            isCurrentYear ? undefined : `Back to ${thisYear}`
                        }
                        className={`min-w-14 px-2 py-1 rounded-lg font-mono-num text-sm font-black text-(--text-ink) ${
                            isCurrentYear
                                ? "cursor-default"
                                : "underline decoration-dotted underline-offset-4 hover:bg-(--bg-cream) cursor-pointer"
                        }`}
                    >
                        {year}
                    </button>
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Next year"
                        onClick={() => setYear((y) => y + 1)}
                        leftIcon={<ChevronRight className="w-4 h-4" />}
                    />
                </div>
            </div>

            {/* Month cards */}
            <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2">
                {months.map((m) => {
                    const isSelected = m.month === selectedMonth;
                    const isCurrent = isCurrentYear && m.month === thisMonth;
                    const fillPct =
                        maxTotal > 0 && m.total > 0
                            ? Math.max((m.total / maxTotal) * 100, 6)
                            : 0;
                    return (
                        <button
                            key={m.month}
                            type="button"
                            onClick={() => setSelectedMonth(m.month)}
                            aria-pressed={isSelected}
                            aria-label={`${MONTH_NAMES_FULL[m.month - 1]} ${year}, ${formatSGD(m.total)}`}
                            className={`relative overflow-hidden flex flex-col items-center justify-between gap-1.5 min-h-16 px-1 py-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) transition-all cursor-pointer ${
                                isSelected
                                    ? "ring-2 ring-(--border-ink) translate-x-0.5 translate-y-0.5"
                                    : "shadow-(--shadow-cute-sm) hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5"
                            }`}
                        >
                            <span
                                aria-hidden="true"
                                data-testid="month-fill"
                                className="absolute inset-x-0 bottom-0 bg-(--pastel-lilac) dark:bg-(--pastel-lilac)/40 transition-[height]"
                                style={{ height: `${fillPct}%` }}
                            />
                            <span
                                className={`relative text-[11px] font-bold uppercase tracking-wider ${
                                    isCurrent
                                        ? "px-1.5 rounded-full bg-(--pastel-mint) border-2 border-(--border-ink) text-(--text-ink)"
                                        : "text-(--text-muted)"
                                }`}
                            >
                                {MONTH_NAMES_SHORT[m.month - 1]}
                            </span>
                            <span
                                className={`relative font-mono-num text-xs font-extrabold ${
                                    m.total > 0
                                        ? "text-(--text-ink)"
                                        : "text-(--text-faint)"
                                }`}
                            >
                                {m.total > 0 ? formatSGDCompact(m.total) : "-"}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* Selected month detail */}
            <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3">
                <div className="flex items-baseline justify-between gap-2 pb-2 border-b-2 border-(--border-ink)/15">
                    <p className="text-sm font-bold text-(--text-ink) font-display">
                        {MONTH_NAMES_FULL[selectedMonth - 1]} {year}
                    </p>
                    <span className="text-(--text-ink) shrink-0">
                        <CurrencyText amount={selected.total} size="md" />
                    </span>
                </div>

                {selected.annualItems.length === 0 &&
                selected.monthlyItems.length === 0 ? (
                    <p className="pt-3 pb-1 text-center text-xs italic text-(--text-muted)">
                        Nothing due
                    </p>
                ) : (
                    <>
                        {selected.annualItems.length > 0 && (
                            <ul className="pt-1">
                                {selected.annualItems.map(renderItem)}
                            </ul>
                        )}
                        {selected.monthlyItems.length > 0 && (
                            <div className="pt-2">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-(--text-muted)">
                                    Monthly
                                </p>
                                <ul>{selected.monthlyItems.map(renderItem)}</ul>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

export default RenewalCalendar;
