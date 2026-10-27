/**
 * UpcomingBillsWidget Component
 * Displays upcoming renewal alerts / recurring bills due in the current
 * and upcoming month (e.g. Manulife, IncomeShield, IRAS tax, subscriptions).
 */

import { useMemo } from "react";
import {
    CalendarClock,
    ChevronRight,
    Shield,
    Receipt,
    RotateCw,
    Bell,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { getSingaporeDate } from "../../lib/dateUtils";
import { TruncatedText } from "../ui/TruncatedText";
import type { RecurringPolicy, RecurringPolicyType } from "../../types/finance";

const MONTH_NAMES = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
];

export interface UpcomingBillsWidgetProps {
    policies?: RecurringPolicy[];
    onViewAll?: () => void;
    className?: string;
}

export function UpcomingBillsWidget({
    policies = [],
    onViewAll,
    className = "",
}: UpcomingBillsWidgetProps) {
    const sgNow = getSingaporeDate();
    const currentMonthNum = sgNow.getMonth() + 1; // 1 - 12
    const nextMonthNum = (currentMonthNum % 12) + 1;

    // Filter and sort policies by due urgency
    const sortedPolicies = useMemo(() => {
        return [...policies].sort((a, b) => {
            // Prioritize current month, then next month, then other months
            const getPriority = (p: RecurringPolicy) => {
                if (p.frequency === "monthly") return 3;
                if (p.payment_month === currentMonthNum) return 1;
                if (p.payment_month === nextMonthNum) return 2;
                return 4;
            };
            return getPriority(a) - getPriority(b);
        });
    }, [policies, currentMonthNum, nextMonthNum]);

    const displayPolicies = sortedPolicies.slice(0, 3);

    const getTypeBadge = (type: RecurringPolicyType) => {
        switch (type) {
            case "insurance":
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#dfc2ff] px-2 py-0.5 text-[10px] font-black text-[#1a1a1a] border-[1.5px] border-(--border-ink) shrink-0">
                        <Shield className="h-2.5 w-2.5 stroke-[2.5]" />
                        <span>Insurance</span>
                    </span>
                );
            case "tax":
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#f76b57] px-2 py-0.5 text-[10px] font-black text-white border-[1.5px] border-(--border-ink) shrink-0">
                        <Receipt className="h-2.5 w-2.5 stroke-[2.5]" />
                        <span>Tax</span>
                    </span>
                );
            case "subscription":
            default:
                return (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#bbf7d0] px-2 py-0.5 text-[10px] font-black text-[#1a1a1a] border-[1.5px] border-(--border-ink) shrink-0">
                        <RotateCw className="h-2.5 w-2.5 stroke-[2.5]" />
                        <span>Subscription</span>
                    </span>
                );
        }
    };

    const getDueStatus = (p: RecurringPolicy) => {
        if (p.frequency === "monthly") {
            return { text: "Monthly active", urgent: false };
        }
        if (p.payment_month === currentMonthNum) {
            return { text: "Due this month", urgent: true };
        }
        if (p.payment_month === nextMonthNum) {
            return { text: "Due next month", urgent: false };
        }
        const monthName = p.payment_month ? MONTH_NAMES[p.payment_month - 1] : "Annual";
        return { text: `Due in ${monthName}`, urgent: false };
    };

    return (
        <div
            role="region"
            aria-label="Upcoming Bills and Renewals"
            className={`rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-5 sm:p-6 shadow-(--shadow-cute) transition-colors ${className}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between gap-3 pb-4 border-b-[1.5px] border-(--border-subtle)">
                <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#ffe999] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)">
                        <CalendarClock className="h-5 w-5 stroke-[2.5]" />
                    </div>
                    <div>
                        <h3 className="text-sm sm:text-base font-black text-(--text-ink) font-display">
                            Upcoming Renewals
                        </h3>
                        <p className="text-xs font-semibold text-(--text-muted)">
                            Insurance, tax &amp; policy alerts
                        </p>
                    </div>
                </div>

                {onViewAll && (
                    <button
                        type="button"
                        onClick={onViewAll}
                        className="flex items-center gap-1 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                    >
                        <span>View All</span>
                        <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                    </button>
                )}
            </div>

            {/* Content */}
            <div className="mt-4">
                {displayPolicies.length === 0 ? (
                    <div className="flex flex-col items-center justify-center rounded-xl border-[1.5px] border-dashed border-(--border-subtle) py-8 text-center bg-(--bg-cream)">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) text-lg mb-2">
                            📋
                        </div>
                        <p className="text-sm font-bold text-(--text-ink) font-display">
                            No upcoming renewals
                        </p>
                        <p className="mt-1 text-xs text-(--text-muted) max-w-xs font-medium">
                            Add recurring insurance policies or annual IRAS taxes to track renewal dates.
                        </p>
                    </div>
                ) : (
                    <div className="space-y-2.5">
                        {displayPolicies.map((policy) => {
                            const due = getDueStatus(policy);

                            return (
                                <div
                                    key={policy.id}
                                    className="flex items-center justify-between gap-3 rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) p-3 sm:p-3.5 shadow-(--shadow-cute-sm) transition-all hover:bg-(--bg-card)"
                                >
                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white dark:bg-slate-800 border-[1.5px] border-(--border-ink) text-(--text-ink) shadow-(--shadow-cute-sm) shrink-0">
                                            <Bell className="h-4 w-4 stroke-[2.5]" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <TruncatedText
                                                    text={policy.name}
                                                    className="text-sm font-bold text-(--text-ink) font-display"
                                                />
                                                {getTypeBadge(policy.type)}
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
                                                    • {policy.frequency}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <div className="text-sm font-black text-(--text-ink) font-mono-num">
                                            {formatSGD(policy.amount)}
                                        </div>
                                        {policy.frequency === "annually" && (
                                            <div className="text-[10px] font-mono-num text-(--text-muted)">
                                                ~{formatSGD(policy.monthly_amortized_amount)}/mo
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
