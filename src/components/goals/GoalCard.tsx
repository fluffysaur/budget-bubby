/**
 * GoalCard Component
 * Milestone savings goal card displaying:
 * - Emoji icon badge & goal title
 * - ProgressRing displaying saved / target percentage and amounts
 * - Status Badge (Achieved, On Track, Behind)
 * - Target date and remaining months countdown
 * - Tap / Collapsible Breakdown for 2x2 grid (Target, Saved, Spend, Balance) and Monthly Pacing
 * - '+ Spend from Goal' button opens Add Expense with this goal picked
 * - List of linked expenses funded by this goal
 * - Quick Deposit and Edit actions
 */

import { useState } from "react";
import {
    Calendar,
    Pencil,
    Coins,
    Clock,
    Plus,
    Receipt,
    ChevronDown,
    ChevronUp,
    AlertCircle,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { calculateGoalPacing } from "../../lib/financialFormulas";
import { formatDisplayMonth, formatDisplayDate } from "../../lib/dateUtils";
import { TruncatedText } from "../ui/TruncatedText";
import { ProgressRing } from "../ui/ProgressRing";
import { Badge, type BadgeVariant } from "../ui/Badge";
import type { SavingsGoal, Expense } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";
import { useMoneyMask } from "../../hooks/useMoneyMask";

export interface GoalCardProps {
    goal: SavingsGoal;
    linkedExpenses?: Expense[];
    onEdit?: (goal: SavingsGoal) => void;
    onQuickDeposit?: (goal: SavingsGoal) => void;
    onSpendFromGoal?: (goal: SavingsGoal) => void;
    /** Ledger deposits into this goal during the current month. */
    depositedThisMonth?: number;
    /** Last month's deposits; null/omitted when the goal is new this month. */
    depositedLastMonth?: number | null;
    isHighlighted?: boolean;
    className?: string;
}

export function GoalCard({
    goal,
    linkedExpenses = [],
    onEdit,
    onQuickDeposit,
    onSpendFromGoal,
    depositedThisMonth = 0,
    depositedLastMonth = null,
    isHighlighted = false,
    className = "",
}: GoalCardProps) {
    const mask = useMoneyMask();
    const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
    const [showExpenses, setShowExpenses] = useState<boolean>(true);

    // Big-Ticket Goal Financial Highlights
    const targetAmount = Math.max(0, goal.target_amount);
    const totalSaved = Math.max(0, goal.saved_so_far);
    const goalSpend =
        Math.round(linkedExpenses.reduce((sum, e) => sum + e.amount, 0) * 100) /
        100;
    const balance = Math.max(
        0,
        Math.round((totalSaved - goalSpend) * 100) / 100,
    );

    const progressPercent =
        targetAmount > 0
            ? Math.min(100, Math.round((totalSaved / targetAmount) * 100))
            : 0;

    const pacing = calculateGoalPacing(
        targetAmount,
        totalSaved,
        goal.target_date,
        depositedThisMonth,
        undefined,
        depositedLastMonth,
    );

    const effectiveStatus = pacing.status;
    const isAchieved = effectiveStatus === "achieved";
    const isBehind = effectiveStatus === "behind";

    // Status configuration
    const statusConfig = {
        achieved: {
            label: "Achieved",
            variant: "ok" as BadgeVariant,
        },
        on_track: {
            label: "On Track",
            variant: "ok" as BadgeVariant,
        },
        behind: {
            label: "Behind",
            variant: "near" as BadgeVariant,
        },
    }[effectiveStatus];

    // Remaining amount to deposit this month (includes any carried shortfall)
    const monthlyShortfall = pacing.shortfallThisMonth;

    return (
        <div
            id={`goal-card-${goal.id}`}
            data-testid={`goal-card-${goal.id}`}
            className={`relative flex flex-col justify-between rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-5 shadow-cute transition-colors ${className}`}
        >
            {isHighlighted && (
                <div
                    data-testid="goal-card-highlight-ring"
                    className="pointer-events-none absolute -inset-1 rounded-2xl ring-4 ring-amber-400 dark:ring-amber-300 animate-pulse transition-opacity duration-500 z-10"
                    aria-hidden="true"
                />
            )}
            <div>
                {/* Header: Emoji, Title, Status Badge */}
                <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border-2 border-(--border-ink) bg-(--pastel-butter-light) text-2xl shadow-cute-sm">
                            <span role="img" aria-label={goal.title}>
                                {goal.emoji || "🎯"}
                            </span>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3
                                className="font-display font-black text-(--text-ink) dark:text-white"
                                title={goal.title}
                            >
                                <TruncatedText
                                    text={goal.title}
                                    className="font-display font-black text-sm sm:text-base text-(--text-ink) dark:text-white"
                                />
                            </h3>
                            <div className="flex items-center gap-1.5 text-xs font-mono-num text-(--text-muted) mt-0.5 min-w-0">
                                <Calendar
                                    className="h-3.5 w-3.5 shrink-0"
                                    strokeWidth={2.5}
                                />
                                <span className="shrink-0">
                                    {formatDisplayMonth(goal.target_date)}
                                </span>
                                <span className="text-(--text-muted) shrink-0">
                                    •
                                </span>
                                <Clock
                                    className="h-3.5 w-3.5 shrink-0"
                                    strokeWidth={2.5}
                                />
                                <span className="truncate">
                                    {isAchieved
                                        ? "Target reached"
                                        : pacing.monthsRemaining === 1
                                          ? "1 mo left"
                                          : `${pacing.monthsRemaining} mos left`}
                                </span>
                            </div>
                        </div>
                    </div>

                    <Badge
                        variant={statusConfig.variant}
                        size="sm"
                        className="shrink-0"
                    >
                        {statusConfig.label}
                    </Badge>
                </div>

                {/* Hero: ProgressRing plus saved / target */}
                <div className="mt-4 flex items-center gap-4 p-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm">
                    <ProgressRing
                        value={progressPercent}
                        size={56}
                        strokeWidth={5}
                        tone={isAchieved ? "ok" : isBehind ? "near" : "ok"}
                        centerContent={
                            <span className="text-xs font-black font-mono-num text-(--text-ink)">
                                {progressPercent}%
                            </span>
                        }
                    />
                    <div className="min-w-0 flex-1">
                        <span className="block text-[10px] sm:text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            Total Saved
                        </span>
                        <div className="flex flex-wrap items-baseline gap-x-1.5 font-display font-black text-lg sm:text-xl text-(--text-ink) font-mono-num">
                            <span title={mask(formatSGD(totalSaved))}>
                                <CurrencyText amount={totalSaved} />
                            </span>
                            <span className="text-xs font-bold text-(--text-muted)">
                                of <CurrencyText amount={targetAmount} />
                            </span>
                        </div>
                    </div>
                </div>

                {/* Collapsible Breakdown: 2x2 grid and pacing */}
                <div className="mt-3 border-t border-(--border-subtle) pt-2">
                    <button
                        type="button"
                        onClick={() => setShowBreakdown((prev) => !prev)}
                        aria-expanded={showBreakdown}
                        className="flex items-center justify-between w-full text-xs font-bold text-(--text-muted) hover:text-(--text-ink) py-1 cursor-pointer transition-colors"
                    >
                        <span>Breakdown</span>
                        <span className="flex items-center gap-1 font-mono-num text-[11px]">
                            {showBreakdown ? (
                                <ChevronUp
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            ) : (
                                <ChevronDown
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            )}
                        </span>
                    </button>

                    {showBreakdown && (
                        <div className="space-y-3 pt-2">
                            {/* 2x2 Grid */}
                            <div className="grid grid-cols-2 gap-3 rounded-xl border border-(--border-subtle) bg-(--bg-card) p-3 text-xs">
                                <div>
                                    <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Target Amount
                                    </span>
                                    <span
                                        className="text-(--text-ink) font-bold mt-0.5 block truncate"
                                        title={mask(formatSGD(targetAmount))}
                                    >
                                        <CurrencyText
                                            amount={targetAmount}
                                            size="md"
                                        />
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Total Saved
                                    </span>
                                    <span
                                        className="text-emerald-700 dark:text-emerald-400 font-bold mt-0.5 block truncate"
                                        title={mask(formatSGD(totalSaved))}
                                    >
                                        <CurrencyText
                                            amount={totalSaved}
                                            size="md"
                                        />
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Goal Spend
                                    </span>
                                    <span
                                        className="text-purple-700 dark:text-purple-300 font-bold mt-0.5 block truncate"
                                        title={mask(formatSGD(goalSpend))}
                                    >
                                        <CurrencyText
                                            amount={goalSpend}
                                            size="md"
                                        />
                                    </span>
                                </div>

                                <div>
                                    <span className="text-[10px] font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Balance
                                    </span>
                                    <span
                                        className="text-(--text-ink) font-bold mt-0.5 block truncate"
                                        title={mask(formatSGD(balance))}
                                    >
                                        <CurrencyText
                                            amount={balance}
                                            size="md"
                                        />
                                    </span>
                                </div>
                            </div>

                            {/* Monthly Pacing Details */}
                            <div className="space-y-1 text-xs border-t border-(--border-subtle) pt-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-(--text-muted)">
                                        Deposited This Month:
                                    </span>
                                    <span className="font-semibold text-(--text-ink)">
                                        <CurrencyText
                                            amount={depositedThisMonth}
                                        />
                                    </span>
                                </div>
                                <div className="flex items-center justify-between">
                                    <span className="text-(--text-muted)">
                                        Required Pace:
                                    </span>
                                    <span className="font-semibold text-(--text-ink)">
                                        {isAchieved
                                            ? "Target Met"
                                            : mask(
                                                  `${formatSGD(pacing.neededPerMonth)}/mo needed`,
                                              )}
                                    </span>
                                </div>

                                {!isAchieved && monthlyShortfall > 0 && (
                                    <div
                                        className={`mt-1.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${
                                            isBehind
                                                ? "bg-amber-50/80 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"
                                                : "bg-(--bg-canvas) text-(--text-muted)"
                                        }`}
                                    >
                                        {isBehind && (
                                            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                                        )}
                                        <span>
                                            +{" "}
                                            <CurrencyText
                                                amount={monthlyShortfall}
                                            />{" "}
                                            more needed this month
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* List of Linked Expenses Funded by This Goal */}
                {linkedExpenses.length > 0 && (
                    <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                        <button
                            type="button"
                            onClick={() => setShowExpenses((prev) => !prev)}
                            className="flex items-center justify-between w-full text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 cursor-pointer hover:text-purple-600 transition-colors"
                        >
                            <span className="flex items-center gap-1.5">
                                <Receipt className="h-3.5 w-3.5 text-purple-500" />
                                <span>Spends ({linkedExpenses.length})</span>
                            </span>
                            <span className="flex items-center gap-1.5 text-[11px] text-purple-600 dark:text-purple-400 font-mono">
                                <span>
                                    <CurrencyText amount={goalSpend} />
                                </span>
                                {showExpenses ? (
                                    <ChevronUp
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                ) : (
                                    <ChevronDown
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                )}
                            </span>
                        </button>

                        {showExpenses && (
                            <div
                                className="space-y-1.5 max-h-36 overflow-y-auto pr-1"
                                data-testid={`linked-expenses-${goal.id}`}
                            >
                                {linkedExpenses.map((exp) => (
                                    <div
                                        key={exp.id}
                                        data-testid={`linked-expense-item-${exp.id}`}
                                        className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60"
                                    >
                                        <div className="flex flex-col min-w-0 pr-2">
                                            <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                                {exp.item}
                                            </span>
                                            <span className="text-[10px] text-(--text-faint)">
                                                {formatDisplayDate(exp.date)}
                                            </span>
                                        </div>
                                        <span className="text-purple-700 dark:text-purple-300 shrink-0">
                                            <CurrencyText amount={exp.amount} />
                                        </span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Action Footer */}
            <div className="mt-5 flex items-center gap-2 border-t border-(--border-subtle) pt-4">
                {/* Spend Button */}
                <button
                    type="button"
                    onClick={() => onSpendFromGoal?.(goal)}
                    aria-label={`+ Spend from ${goal.title}`}
                    className="min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) px-3 py-2 text-xs font-black shadow-cute-sm hover:bg-(--text-ink) hover:text-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer whitespace-nowrap"
                >
                    <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                    <span>Spend</span>
                </button>

                {/* Deposit Button */}
                <button
                    type="button"
                    onClick={() => onQuickDeposit?.(goal)}
                    aria-label={`Deposit to ${goal.title}`}
                    className="min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint-light) text-(--text-ink) px-3 py-2 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-mint) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer whitespace-nowrap"
                >
                    <Coins
                        className="h-3.5 w-3.5 text-emerald-800 shrink-0"
                        strokeWidth={2.5}
                    />
                    <span>Deposit</span>
                </button>

                {/* Edit Button (Icon-only) */}
                <button
                    type="button"
                    onClick={() => onEdit?.(goal)}
                    aria-label={`Edit ${goal.title}`}
                    title={`Edit ${goal.title}`}
                    className="inline-flex items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) p-2 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer shrink-0"
                >
                    <Pencil className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}

export default GoalCard;
