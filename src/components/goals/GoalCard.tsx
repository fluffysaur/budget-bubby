/**
 * GoalCard Component
 * One goal on the household Roadmap:
 * - Emoji, title, date and months left
 * - Status from the Roadmap (Covered, On track, Short, Paid for?, Done)
 * - ProgressRing of how much the pool covers today, paired with what's left
 * - Collapsible breakdown (target, goal spend, covered today, pace)
 * - Linked goal-tagged spends
 * - Spend, Mark done / Reopen and Edit actions
 */

import { useState } from "react";
import {
    Calendar,
    Pencil,
    Clock,
    Plus,
    Receipt,
    ChevronDown,
    ChevronUp,
    CheckCircle2,
    RotateCcw,
    TrendingUp,
} from "lucide-react";
import {
    ceilToDollar,
    formatSGD,
    formatSGDEstimate,
    formatSGDTarget,
} from "../../lib/currency";
import {
    formatDisplayMonth,
    formatDisplayDate,
    formatShortMonth,
} from "../../lib/dateUtils";
import type { RoadmapGoalResult } from "../../lib/roadmap";
import { TruncatedText } from "../ui/TruncatedText";
import { ProgressRing } from "../ui/ProgressRing";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import type { SavingsGoal, Expense } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";
import { useMoneyMask } from "../../hooks/useMoneyMask";

export interface GoalCardProps {
    goal: SavingsGoal;
    /** This goal on the Roadmap; absent once the goal is Done. */
    plan?: RoadmapGoalResult;
    linkedExpenses?: Expense[];
    onEdit?: (goal: SavingsGoal) => void;
    onSpendFromGoal?: (goal: SavingsGoal) => void;
    onMarkDone?: (goal: SavingsGoal) => void;
    onReopen?: (goal: SavingsGoal) => void;
    isHighlighted?: boolean;
    className?: string;
}

type CardStatus = RoadmapGoalResult["status"] | "done";

const STATUS_CONFIG: Record<
    CardStatus,
    { label: string; variant: BadgeVariant }
> = {
    done: { label: "Done", variant: "paid" },
    funded: { label: "Covered", variant: "ok" },
    on_track: { label: "On Track", variant: "ok" },
    short: { label: "Short", variant: "over" },
    overdue: { label: "Paid for?", variant: "due" },
};

const round2 = (n: number) => Math.round(n * 100) / 100;

export function GoalCard({
    goal,
    plan,
    linkedExpenses = [],
    onEdit,
    onSpendFromGoal,
    onMarkDone,
    onReopen,
    isHighlighted = false,
    className = "",
}: GoalCardProps) {
    const mask = useMoneyMask();
    const [showBreakdown, setShowBreakdown] = useState<boolean>(false);
    const [showExpenses, setShowExpenses] = useState<boolean>(true);

    const isDone = goal.status === "achieved" || !plan;
    const status: CardStatus = isDone ? "done" : plan.status;
    const statusConfig = STATUS_CONFIG[status];

    const targetAmount = Math.max(0, goal.target_amount);
    const goalSpend = round2(
        linkedExpenses.reduce((sum, e) => sum + e.amount, 0),
    );
    const coveredToday = plan?.fundedToday ?? 0;
    const leftToFill = plan
        ? round2(Math.max(0, plan.stillNeeded - coveredToday))
        : 0;
    const progressPercent = isDone
        ? 100
        : Math.round((plan?.progress ?? 0) * 100);
    const isShort = status === "short";
    const monthsLeft = plan?.monthsLeft ?? 0;

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
                                    {isDone
                                        ? "Done"
                                        : status === "overdue"
                                          ? "Date passed"
                                          : monthsLeft === 1
                                            ? "1 mo left"
                                            : `${monthsLeft} mos left`}
                                </span>
                            </div>
                            {(goal.goal_type === "buffer" ||
                                (goal.tags?.length ?? 0) > 0) && (
                                <div
                                    className="mt-1.5 flex flex-wrap gap-1 min-w-0"
                                    aria-label="Goal tags"
                                >
                                    {goal.goal_type === "buffer" && (
                                        <Badge variant="mint" size="sm">
                                            {goal.buffer_months
                                                ? `Buffer · ${goal.buffer_months} mo`
                                                : "Buffer"}
                                        </Badge>
                                    )}
                                    {goal.tags?.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="lilac"
                                            size="sm"
                                            className="max-w-32"
                                        >
                                            <TruncatedText text={tag} />
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <Badge
                        variant={statusConfig.variant}
                        size="sm"
                        icon={
                            status === "on_track" ? (
                                <TrendingUp
                                    className="h-3 w-3 shrink-0"
                                    strokeWidth={2.5}
                                />
                            ) : undefined
                        }
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
                        tone={isShort ? "over" : "ok"}
                        centerContent={
                            <span className="text-xs font-black font-mono-num text-(--text-ink)">
                                {progressPercent}%
                            </span>
                        }
                    />
                    <div className="min-w-0 flex-1">
                        <span className="block text-2xs sm:text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            {isDone ? "Target" : "Left to Fill"}
                        </span>
                        <div className="flex flex-wrap items-baseline gap-x-1.5 font-display font-black text-lg sm:text-xl text-(--text-ink) font-mono-num">
                            <span
                                title={mask(
                                    isDone
                                        ? formatSGDTarget(targetAmount)
                                        : formatSGD(leftToFill),
                                )}
                            >
                                <CurrencyText
                                    formatted={
                                        isDone
                                            ? formatSGDTarget(targetAmount)
                                            : formatSGD(leftToFill)
                                    }
                                />
                            </span>
                            {!isDone && (
                                <span className="text-xs font-bold text-(--text-muted)">
                                    of{" "}
                                    <CurrencyText
                                        formatted={formatSGDTarget(
                                            targetAmount,
                                        )}
                                    />
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {status === "overdue" && onMarkDone && (
                    <Alert
                        variant="warning"
                        className="mt-3"
                        action={
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => onMarkDone(goal)}
                            >
                                Mark Done
                            </Button>
                        }
                    >
                        Paid for? Mark it done.
                    </Alert>
                )}

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
                                    <span className="text-2xs font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Target Amount
                                    </span>
                                    <span
                                        className="text-(--text-ink) font-bold mt-0.5 block truncate"
                                        title={mask(
                                            formatSGDTarget(targetAmount),
                                        )}
                                    >
                                        <CurrencyText
                                            formatted={formatSGDTarget(
                                                targetAmount,
                                            )}
                                            size="md"
                                        />
                                    </span>
                                </div>

                                <div>
                                    <span className="text-2xs font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Covered Today
                                    </span>
                                    <span
                                        className="text-emerald-700 dark:text-emerald-400 font-bold mt-0.5 block truncate"
                                        title={mask(formatSGD(coveredToday))}
                                    >
                                        <CurrencyText
                                            amount={coveredToday}
                                            size="md"
                                        />
                                    </span>
                                </div>

                                <div>
                                    <span className="text-2xs font-bold text-(--text-muted) uppercase tracking-wider block">
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
                                    <span className="text-2xs font-bold text-(--text-muted) uppercase tracking-wider block">
                                        Pace
                                    </span>
                                    <span
                                        className={`font-bold mt-0.5 block truncate ${
                                            isShort
                                                ? "text-rose-600 dark:text-rose-400"
                                                : "text-(--text-ink)"
                                        }`}
                                    >
                                        {isDone
                                            ? "Done"
                                            : isShort
                                              ? mask(
                                                    `Short ${formatSGDEstimate(ceilToDollar(plan?.shortPerMonth ?? 0))}/mo`,
                                                )
                                              : plan?.fillMonth
                                                ? `Fills ${formatShortMonth(plan.fillMonth)}`
                                                : "Covered"}
                                    </span>
                                </div>
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
                                            <span className="text-2xs text-(--text-faint)">
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
                    className="min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) text-(--text-on-pastel) px-3 py-2 text-xs font-black shadow-cute-sm hover:bg-(--text-ink) hover:text-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer whitespace-nowrap"
                >
                    <Plus className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} />
                    <span>Spend</span>
                </button>

                {/* Done / Reopen Button */}
                {isDone ? (
                    <button
                        type="button"
                        onClick={() => onReopen?.(goal)}
                        aria-label={`Reopen ${goal.title}`}
                        className="min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) px-3 py-2 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer whitespace-nowrap"
                    >
                        <RotateCcw
                            className="h-3.5 w-3.5 shrink-0"
                            strokeWidth={2.5}
                        />
                        <span>Reopen</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={() => onMarkDone?.(goal)}
                        aria-label={`Mark ${goal.title} done`}
                        className="min-w-0 flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint-light) text-(--text-ink) px-3 py-2 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-mint) hover:text-(--text-on-pastel) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer whitespace-nowrap"
                    >
                        <CheckCircle2
                            className="h-3.5 w-3.5 text-emerald-800 dark:text-current shrink-0"
                            strokeWidth={2.5}
                        />
                        <span>Done</span>
                    </button>
                )}

                {/* Edit Button (Icon-only) */}
                <button
                    type="button"
                    onClick={() => onEdit?.(goal)}
                    aria-label={`Edit ${goal.title}`}
                    title={`Edit ${goal.title}`}
                    className="relative inline-flex items-center justify-center rounded-xl after:absolute after:-inset-1.5 after:content-[''] border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) p-2 text-xs font-bold shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer shrink-0"
                >
                    <Pencil className="h-4 w-4 shrink-0" strokeWidth={2.5} />
                </button>
            </div>
        </div>
    );
}

export default GoalCard;
