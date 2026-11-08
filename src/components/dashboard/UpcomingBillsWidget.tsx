/**
 * UpcomingBillsWidget Component
 * Shows the next recurring items due (insurance, tax, subscriptions,
 * bills and other), sorted by due date.
 */

import { useMemo } from "react";
import { CalendarClock, ChevronRight, Bell, Plus } from "lucide-react";
import {
    formatDueInDays,
    formatISODate,
    getDaysUntilDue,
    getSingaporeDate,
    MONTH_NAMES_FULL as MONTH_NAMES,
} from "../../lib/dateUtils";
import { TruncatedText } from "../ui/TruncatedText";
import { RecurringTypeBadge } from "../recurring/RecurringTypeBadge";
import type { RecurringItem } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";
import { Button } from "../ui/Button";

export interface UpcomingBillsWidgetProps {
    recurringItems?: RecurringItem[];
    onViewAll?: () => void;
    onAdd?: () => void;
    className?: string;
    /** Overrides "today" (Singapore time) for due-date calculations. */
    referenceDate?: Date;
}

export function UpcomingBillsWidget({
    recurringItems = [],
    onViewAll,
    onAdd,
    className = "",
    referenceDate,
}: UpcomingBillsWidgetProps) {
    // Sort active items by next due date (due day clamped to short months)
    const sortedItems = useMemo(() => {
        const today = referenceDate ?? getSingaporeDate();
        const todayStr = formatISODate(today);
        return recurringItems
            .filter((p) => !p.end_date || p.end_date >= todayStr)
            .map((p) => ({ item: p, days: getDaysUntilDue(p, today) }))
            .sort(
                (a, b) =>
                    (a.days ?? Number.POSITIVE_INFINITY) -
                    (b.days ?? Number.POSITIVE_INFINITY),
            );
    }, [recurringItems, referenceDate]);

    const displayItems = sortedItems.slice(0, 3);

    const getDueStatus = (p: RecurringItem, days: number | null) => {
        if (days !== null && days <= 31) {
            return { text: formatDueInDays(days), urgent: days <= 7 };
        }
        const monthName = p.payment_month
            ? MONTH_NAMES[p.payment_month - 1]
            : "Annual";
        return { text: `Due in ${monthName}`, urgent: false };
    };

    return (
        <div
            role="region"
            aria-label="Upcoming Bills"
            className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-5 sm:p-6 shadow-cute transition-colors ${className}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b-2 border-(--border-ink)">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm">
                        <CalendarClock className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-sm sm:text-base font-black text-(--text-ink) font-display">
                            Upcoming Bills
                        </h3>
                    </div>
                </div>

                {onViewAll && (
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--bg-card) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                    >
                        <span>View All</span>
                        <ChevronRight
                            className="h-3.5 w-3.5"
                            strokeWidth={2.5}
                        />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="mt-4">
                {displayItems.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-(--border-ink) py-8 text-center bg-(--bg-cream)">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--bg-card) border-2 border-(--border-ink) shadow-cute-sm text-lg mb-2">
                            📋
                        </div>
                        <p className="text-sm font-bold text-(--text-ink) font-display">
                            Nothing Due
                        </p>
                        <p className="mt-1 text-xs text-(--text-muted) max-w-xs font-medium mb-3">
                            Add a recurring item to track due dates.
                        </p>
                        <Button
                            variant="primary"
                            size="sm"
                            type="button"
                            onClick={() => {
                                if (onAdd) {
                                    onAdd();
                                } else if (onViewAll) {
                                    onViewAll();
                                } else if (typeof window !== "undefined") {
                                    window.location.hash = "#/recurring";
                                }
                            }}
                            leftIcon={<Plus className="h-3.5 w-3.5 stroke-3" />}
                        >
                            Add Recurring
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {displayItems.map(({ item: recurringItem, days }) => {
                            const due = getDueStatus(recurringItem, days);

                            return (
                                <div
                                    key={recurringItem.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3 sm:p-3.5 shadow-cute-sm transition-colors hover:bg-(--bg-card)"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-(--bg-card) border-2 border-(--border-ink) text-(--text-ink) shadow-cute-sm shrink-0">
                                            <Bell
                                                className="h-4 w-4"
                                                strokeWidth={2.5}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="min-w-0 flex-1">
                                                    <TruncatedText
                                                        text={
                                                            recurringItem.name
                                                        }
                                                        className="text-sm font-bold text-(--text-ink) font-display"
                                                    />
                                                </div>
                                                <RecurringTypeBadge
                                                    type={recurringItem.type}
                                                    compactOnMobile
                                                />
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <span
                                                    className={`text-xs font-bold ${
                                                        due.urgent
                                                            ? "text-amber-700 dark:text-amber-400"
                                                            : "text-(--text-muted)"
                                                    }`}
                                                >
                                                    {due.text}
                                                </span>
                                                <span className="text-[11px] font-medium text-(--text-muted) capitalize">
                                                    • {recurringItem.frequency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="text-(--text-ink)">
                                            <CurrencyText
                                                amount={recurringItem.amount}
                                                size="md"
                                            />
                                        </div>
                                        {recurringItem.frequency ===
                                            "annually" && (
                                            <div className="text-[10px] font-mono-num text-(--text-muted)">
                                                ~
                                                <CurrencyText
                                                    amount={
                                                        recurringItem.monthly_amortized_amount
                                                    }
                                                />
                                                /mo
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export default UpcomingBillsWidget;
