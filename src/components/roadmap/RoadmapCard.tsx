/**
 * RoadmapCard: "Are we on track?" at the top of Plan -> Goals.
 * Verdict, pool bar, a date-ordered timeline (also the bar's legend) and
 * trade-offs. Always the household plan.
 */

import { useState } from "react";
import { Plus, Route, TrendingUp } from "lucide-react";
import { formatSGD, formatSGDCompact } from "../../lib/currency";
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
import { PoolBar, SPARE_ID } from "./PoolBar";

export interface RoadmapCardProps {
    roadmap: RoadmapState;
    onAddGoal?: () => void;
    /** Moves a goal's date by `months`; resolves once saved. */
    onApplyDelay?: (goalId: string, months: number) => Promise<void>;
    className?: string;
}

const STATUS_BADGE: Record<
    RoadmapGoalResult["status"],
    { label: string; variant: BadgeVariant; icon?: React.ReactNode }
> = {
    funded: { label: "Covered", variant: "ok" },
    on_track: {
        label: "On track",
        variant: "ok",
        icon: <TrendingUp className="h-3 w-3 shrink-0" strokeWidth={2.5} />,
    },
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
    const totalClaims = result.goals.at(-1)?.claimEnd ?? 0;
    const spareToday = Math.max(0, result.poolToday - totalClaims);
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
                            {baseline.source === "actual"
                                ? "Saving"
                                : "Estimated saving"}{" "}
                            <CurrencyText
                                formatted={formatSGD(result.monthlySavings, {
                                    showCents: false,
                                })}
                            />
                            /mo
                        </span>
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
                    <dl className="space-y-1.5 text-xs">
                        <div>
                            <dt className="font-bold text-(--text-ink)">
                                Pool
                            </dt>
                            <dd>
                                {mask(
                                    formatSGD(result.poolToday, {
                                        showCents: false,
                                    }),
                                )}{" "}
                                in non-CPF accounts, minus card bills.
                                {result.haircutApplied &&
                                    " Investments count at 80% for goals within 2 years."}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-bold text-(--text-ink)">
                                Saving
                            </dt>
                            <dd>
                                {baseline.source === "actual"
                                    ? `Your average over ${baseline.months.length} months, without bonuses.`
                                    : "Your budgeted savings, until you have 3 months of history."}
                            </dd>
                        </div>
                        <div>
                            <dt className="font-bold text-(--text-ink)">
                                Order
                            </dt>
                            <dd>Goals fill by date, earliest first.</dd>
                        </div>
                    </dl>
                </TooltipPopover>
            </div>

            {/* Pool bar and timeline */}
            <div className="space-y-3">
                <div className="space-y-1">
                    <PoolBar
                        result={result}
                        selectedId={selectedId}
                        onSelect={setSelectedId}
                    />
                    <p
                        aria-live="polite"
                        className="min-h-5 text-xs font-bold text-(--text-ink)"
                    >
                        {selectedId === SPARE_ID ? (
                            mask(`${formatSGDCompact(spareToday)} spare today`)
                        ) : selected ? (
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
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <TruncatedText
                                            text={g.goal.title}
                                            className="text-xs font-bold text-(--text-ink)"
                                        />
                                        <span className="font-mono-num text-[11px] text-(--text-muted)">
                                            <CurrencyText
                                                formatted={formatSGDCompact(
                                                    g.goal.targetAmount,
                                                )}
                                            />
                                        </span>
                                    </span>
                                    <Badge
                                        variant={badge.variant}
                                        size="sm"
                                        icon={badge.icon}
                                        className="ml-auto shrink-0"
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
