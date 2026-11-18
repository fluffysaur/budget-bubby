/**
 * RoadmapCard: "Are we on track?" at the top of Plan -> Goals.
 * Verdict, Pool Jar, a date-ordered timeline (also the jar's band list for
 * screen readers) and trade-offs. Always the household plan.
 */

import { useState } from "react";
import { Plus, Route } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import {
    daysBetweenISO,
    formatShortMonth,
    getTodayDateString,
} from "../../lib/dateUtils";
import { useMoneyMask } from "../../hooks/useMoneyMask";
import type { RoadmapState } from "../../hooks/useRoadmap";
import type { RoadmapGoalResult, TradeOff } from "../../lib/roadmap";
import {
    Badge,
    Button,
    CurrencyText,
    EmptyStateCard,
    TooltipPopover,
    TruncatedText,
    type BadgeVariant,
} from "../ui";
import { PoolJar } from "./PoolJar";

export interface RoadmapCardProps {
    roadmap: RoadmapState;
    onAddGoal?: () => void;
    /** Moves a goal's date by `months`; resolves once saved. */
    onApplyDelay?: (goalId: string, months: number) => Promise<void>;
    className?: string;
}

const STATUS_BADGE: Record<
    RoadmapGoalResult["status"],
    { label: string; variant: BadgeVariant }
> = {
    funded: { label: "Covered", variant: "ok" },
    on_track: { label: "On track", variant: "ok" },
    short: { label: "Short", variant: "over" },
    overdue: { label: "Paid for?", variant: "due" },
};

function updatedLabel(asOf: string): string {
    const days = Math.max(0, daysBetweenISO(asOf, getTodayDateString()));
    if (days === 0) return "Updated today";
    if (days === 1) return "Updated yesterday";
    return `Updated ${days} days ago`;
}

function previewText(g: RoadmapGoalResult, mask: (t: string) => string) {
    if (g.status === "short") {
        return mask(
            `Short ${formatSGD(Math.ceil(g.gap), { showCents: false })} by ${formatShortMonth(g.goal.targetDate)}`,
        );
    }
    return g.fillMonth
        ? `Fills by ${formatShortMonth(g.fillMonth)} ✓`
        : "Covered ✓";
}

export function RoadmapCard({
    roadmap,
    onAddGoal,
    onApplyDelay,
    className = "",
}: RoadmapCardProps) {
    const mask = useMoneyMask();
    const { result, baseline, tradeOffs } = roadmap;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [applying, setApplying] = useState<string | null>(null);

    if (result.verdict === "none") {
        return (
            <EmptyStateCard
                className={className}
                icon={<Route className="h-5 w-5" />}
                title="No Goals"
                description="Add a goal to see if your plan fits."
                action={
                    onAddGoal && (
                        <Button
                            variant="primary"
                            onClick={onAddGoal}
                            leftIcon={<Plus className="h-4 w-4 stroke-3" />}
                        >
                            Add Goal
                        </Button>
                    )
                }
            />
        );
    }

    const selected = result.goals.find((g) => g.goal.id === selectedId) ?? null;
    const isShort = result.verdict === "short";
    const goalTitle = (id?: string) =>
        result.goals.find((g) => g.goal.id === id)?.goal.title ?? "goal";

    const handleApply = async (t: TradeOff) => {
        if (t.edit.type !== "delay" || !onApplyDelay) return;
        setApplying(t.edit.goalId);
        try {
            await onApplyDelay(t.edit.goalId, t.edit.months);
        } finally {
            setApplying(null);
        }
    };

    return (
        <section
            aria-label="Roadmap"
            data-testid="roadmap-card"
            className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-cute space-y-4 ${className}`}
        >
            {/* Header and verdict */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            Roadmap
                        </span>
                        <Badge variant="lilac" size="sm">
                            Household plan
                        </Badge>
                    </div>
                    <p
                        data-testid="roadmap-verdict"
                        className={`mt-1 font-display text-2xl font-black tracking-tight ${
                            isShort
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-(--text-ink)"
                        }`}
                    >
                        {isShort ? (
                            <>
                                Short{" "}
                                <CurrencyText
                                    formatted={formatSGD(
                                        Math.ceil(result.shortfallPerMonth),
                                        { showCents: false },
                                    )}
                                />
                                /mo
                            </>
                        ) : (
                            "On track"
                        )}
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-(--text-muted)">
                        <span className="font-mono-num">
                            Saving{" "}
                            <CurrencyText
                                formatted={formatSGD(result.monthlySavings, {
                                    showCents: false,
                                })}
                            />
                            /mo
                        </span>
                        {baseline.source !== "actual" && (
                            <Badge variant="butter" size="sm">
                                Estimate
                            </Badge>
                        )}
                        <span className="basis-full">
                            {updatedLabel(result.asOf)}
                        </span>
                    </div>
                </div>
                <TooltipPopover
                    title="How it works"
                    ariaLabel="How the roadmap works"
                    align="right"
                    className="shrink-0"
                >
                    {mask(
                        `Pool today: ${formatSGD(result.poolToday)} of non-CPF balances, minus card bills.`,
                    )}{" "}
                    {result.haircutApplied &&
                        "Investments count at 80% for goals within 2 years. "}
                    {baseline.source === "actual"
                        ? `Savings: your average over ${baseline.months.length} months, bonuses excluded.`
                        : "Savings: your budgeted savings until 3 months of history."}{" "}
                    Goals fill in date order.
                </TooltipPopover>
            </div>

            {/* Jar and timeline */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <PoolJar
                        result={result}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                    <p
                        aria-live="polite"
                        className="min-h-5 text-xs font-bold text-(--text-ink)"
                    >
                        {selected ? (
                            <>
                                {selected.goal.emoji}{" "}
                                {previewText(selected, mask)}
                            </>
                        ) : (
                            <span className="font-medium text-(--text-muted)">
                                Tap a goal to preview
                            </span>
                        )}
                    </p>
                </div>

                <ol aria-label="Goals by date" className="space-y-1.5">
                    {result.goals.map((g) => {
                        const badge = STATUS_BADGE[g.status];
                        const isSelected = g.goal.id === selectedId;
                        return (
                            <li key={g.goal.id}>
                                <button
                                    type="button"
                                    aria-pressed={isSelected}
                                    onClick={() =>
                                        setSelectedId(
                                            isSelected ? null : g.goal.id,
                                        )
                                    }
                                    className={`flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-xl border-2 px-2.5 py-1.5 text-left transition-colors ${
                                        isSelected
                                            ? "border-(--border-ink) bg-(--pastel-butter-light)"
                                            : "border-(--border-subtle) bg-(--bg-canvas) hover:border-(--border-ink)"
                                    }`}
                                >
                                    <span className="w-16 shrink-0 font-mono-num text-[11px] font-bold text-(--text-muted)">
                                        {formatShortMonth(g.goal.targetDate)}
                                    </span>
                                    <span
                                        aria-hidden="true"
                                        className="shrink-0"
                                    >
                                        {g.goal.emoji}
                                    </span>
                                    <TruncatedText
                                        text={g.goal.title}
                                        className="min-w-0 flex-1 text-xs font-bold text-(--text-ink)"
                                    />
                                    <Badge
                                        variant={badge.variant}
                                        size="sm"
                                        className="shrink-0"
                                    >
                                        {badge.label}
                                    </Badge>
                                </button>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Trade-offs */}
            {isShort && tradeOffs.length > 0 && (
                <div className="space-y-2 border-t-2 border-(--border-subtle) pt-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                        Trade-offs
                    </span>
                    <ul className="space-y-1.5">
                        {tradeOffs.map((t) => {
                            const onTrack = t.verdict !== "short";
                            const key =
                                t.edit.type === "delay"
                                    ? `delay-${t.edit.goalId}`
                                    : "bonus";
                            return (
                                <li
                                    key={key}
                                    className="flex min-h-11 items-center gap-2 rounded-xl bg-(--bg-cream) px-3 py-1.5"
                                >
                                    <span className="min-w-0 flex-1 wrap-break-word text-xs font-bold text-(--text-ink)">
                                        {t.edit.type === "delay"
                                            ? `Delay ${goalTitle(t.goalId)} ${t.edit.months} mo`
                                            : "Count typical bonus"}
                                    </span>
                                    <Badge
                                        variant={onTrack ? "ok" : "near"}
                                        size="sm"
                                        className="shrink-0"
                                    >
                                        {onTrack
                                            ? "On track"
                                            : mask(
                                                  `Short ${formatSGD(Math.ceil(t.shortfallPerMonth), { showCents: false })}/mo`,
                                              )}
                                    </Badge>
                                    {t.edit.type === "delay" &&
                                        onApplyDelay && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                className="shrink-0"
                                                disabled={applying !== null}
                                                onClick={() => handleApply(t)}
                                            >
                                                Apply
                                            </Button>
                                        )}
                                </li>
                            );
                        })}
                    </ul>
                </div>
            )}
        </section>
    );
}

export default RoadmapCard;
