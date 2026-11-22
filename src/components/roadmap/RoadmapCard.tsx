/**
 * RoadmapCard: "Are we on track?" at the top of Plan -> Goals.
 * Verdict, pool bar, a date-ordered timeline (also the bar's legend) and
 * trade-offs. Always the household plan.
 */

import { useState } from "react";
import { Info, Plus, Route, TrendingUp, TriangleAlert } from "lucide-react";
import { formatSGD, formatSGDCompact } from "../../lib/currency";
import {
    daysBetweenISO,
    formatShortMonth,
    getTodayDateString,
} from "../../lib/dateUtils";
import { useMoneyMask } from "../../hooks/useMoneyMask";
import type { RoadmapState } from "../../hooks/useRoadmap";
import type {
    RealityCheck,
    RoadmapGoalResult,
    TradeOff,
} from "../../lib/roadmap";
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
import { HaircutSettingsModal } from "./HaircutSettingsModal";
import {
    DEFAULT_HAIRCUT_MONTHS,
    DEFAULT_HAIRCUT_PCT,
} from "../../lib/roadmap/project";

export interface RoadmapCardProps {
    roadmap: RoadmapState;
    onAddGoal?: () => void;
    /** Moves a goal's date by `months`; resolves once saved. */
    onApplyDelay?: (goalId: string, months: number) => Promise<void>;
    /** Lowers a goal's target amount; resolves once saved. */
    onApplyLowerTarget?: (
        goalId: string,
        targetAmount: number,
    ) => Promise<void>;
    /** Trims a spendable category and shifts it to savings; resolves once saved. */
    onApplyTrim?: (categoryId: string, monthlyAmount: number) => Promise<void>;
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

/** "Balances grew S$X/mo", colored + signed % when 20%+ off the plan. */
function RealityLine({ reality }: { reality: RealityCheck }) {
    const fell = reality.grewPerMonth < 0;
    const isBelow = reality.differs && reality.direction === "below";
    const isAbove = reality.differs && reality.direction === "above";
    const deltaLabel =
        reality.differs && reality.deltaPct !== 0
            ? ` (${reality.deltaPct > 0 ? `+${reality.deltaPct}` : reality.deltaPct}%)`
            : "";
    const amount = (
        <CurrencyText
            formatted={formatSGD(Math.abs(Math.round(reality.grewPerMonth)), {
                showCents: false,
            })}
        />
    );
    return (
        <span
            data-testid="roadmap-reality"
            className={`inline-flex basis-full items-center gap-1 font-mono-num ${
                isBelow
                    ? "font-bold text-amber-700 dark:text-amber-400"
                    : isAbove
                      ? "font-bold text-emerald-700 dark:text-emerald-400"
                      : ""
            }`}
        >
            {isBelow && (
                <TriangleAlert
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.5}
                />
            )}
            {isAbove && (
                <Info
                    aria-hidden="true"
                    className="h-3.5 w-3.5 shrink-0"
                    strokeWidth={2.5}
                />
            )}
            <span>
                Balances {fell ? "fell" : "grew"} {amount}/mo{deltaLabel}
            </span>
        </span>
    );
}

const haircutLabel = (share: number) =>
    `${Math.round(Math.max(0, share) * 1000) / 10}%`;

export function RoadmapCard({
    roadmap,
    onAddGoal,
    onApplyDelay,
    onApplyLowerTarget,
    onApplyTrim,
    className = "",
}: RoadmapCardProps) {
    const mask = useMoneyMask();
    const { result, baseline, tradeOffs, reality } = roadmap;
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [applying, setApplying] = useState<string | null>(null);
    const [haircutOpen, setHaircutOpen] = useState(false);
    const haircutPct = roadmap.input.haircutPct ?? DEFAULT_HAIRCUT_PCT;
    const haircutMonths = roadmap.input.haircutMonths ?? DEFAULT_HAIRCUT_MONTHS;

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

    const tradeOffKey = (t: TradeOff) => {
        if (t.edit.type === "delay") return `delay-${t.edit.goalId}`;
        if (t.edit.type === "trim") return `trim-${t.edit.categoryId}`;
        if (t.edit.type === "lowerTarget") return `lower-${t.edit.goalId}`;
        return "bonus";
    };

    const tradeOffLabel = (t: TradeOff) => {
        if (t.edit.type === "delay") {
            return `Delay ${goalTitle(t.goalId)} ${t.edit.months} mo`;
        }
        if (t.edit.type === "trim") {
            return `Trim ${t.edit.categoryName} ${mask(formatSGD(t.edit.monthlyAmount, { showCents: false }))}/mo`;
        }
        if (t.edit.type === "lowerTarget") {
            return `Lower ${goalTitle(t.goalId)} to ${mask(formatSGD(t.edit.targetAmount, { showCents: false }))}`;
        }
        return "Count typical bonus";
    };

    const canApplyTradeOff = (t: TradeOff) =>
        (t.edit.type === "delay" && Boolean(onApplyDelay)) ||
        (t.edit.type === "lowerTarget" && Boolean(onApplyLowerTarget)) ||
        (t.edit.type === "trim" && Boolean(onApplyTrim));

    const handleApply = async (t: TradeOff) => {
        if (!canApplyTradeOff(t)) return;
        const key = tradeOffKey(t);
        setApplying(key);
        try {
            if (t.edit.type === "delay" && onApplyDelay) {
                await onApplyDelay(t.edit.goalId, t.edit.months);
            } else if (t.edit.type === "lowerTarget" && onApplyLowerTarget) {
                await onApplyLowerTarget(t.edit.goalId, t.edit.targetAmount);
            } else if (t.edit.type === "trim" && onApplyTrim) {
                await onApplyTrim(t.edit.categoryId, t.edit.monthlyAmount);
            }
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
                        {result.cpfOa && result.cpfOa.used > 0 && (
                            <span className="font-mono-num">
                                CPF OA{" "}
                                <CurrencyText
                                    formatted={formatSGD(result.cpfOa.used, {
                                        showCents: false,
                                    })}
                                />
                            </span>
                        )}
                        {(roadmap.hasBonuses || roadmap.includeBonuses) && (
                            <button
                                type="button"
                                aria-pressed={roadmap.includeBonuses}
                                onClick={roadmap.toggleIncludeBonuses}
                                className={`inline-flex min-h-7 cursor-pointer items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-colors ${
                                    roadmap.includeBonuses
                                        ? "border-(--border-ink) bg-(--pastel-mint-light) text-(--text-ink)"
                                        : "border-(--border-subtle) bg-(--bg-canvas) text-(--text-muted) hover:text-(--text-ink)"
                                }`}
                            >
                                Include bonuses
                            </button>
                        )}
                        {reality.status === "ok" && (
                            <RealityLine reality={reality} />
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
                    {(close) => (
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
                                    in non-CPF accounts, minus card bills.{" "}
                                    {haircutPct > 0 && haircutMonths > 0
                                        ? `Investments count at ${haircutLabel(1 - haircutPct)} for goals within ${haircutMonths} months.`
                                        : "Investments count at full value."}
                                </dd>
                                <button
                                    type="button"
                                    onClick={() => {
                                        close();
                                        setHaircutOpen(true);
                                    }}
                                    className="flex min-h-11 items-center font-bold text-(--text-ink) underline"
                                >
                                    Edit haircut
                                </button>
                            </div>
                            <div>
                                <dt className="font-bold text-(--text-ink)">
                                    Saving
                                </dt>
                                <dd>
                                    {baseline.source === "actual"
                                        ? `Your average over ${baseline.months.length} months${roadmap.includeBonuses ? ", with bonuses" : ", without bonuses"}.`
                                        : `Your budgeted savings${roadmap.includeBonuses ? " plus average bonuses" : ""}, until you have 3 months of history.`}
                                </dd>
                            </div>
                            <div>
                                <dt className="font-bold text-(--text-ink)">
                                    Order
                                </dt>
                                <dd>
                                    {result.goals.some((g) => g.goal.isBuffer)
                                        ? "Your buffer fills first, then goals by date."
                                        : "Goals fill by date, earliest first."}
                                </dd>
                            </div>
                            {result.cpfOa && result.cpfOa.used > 0 && (
                                <div>
                                    <dt className="font-bold text-(--text-ink)">
                                        CPF OA
                                    </dt>
                                    <dd>
                                        Goals with &ldquo;Use CPF OA&rdquo; draw
                                        from your combined OA first, then the
                                        pool.
                                        {result.cpfOa.monthlyGrowth > 0
                                            ? ` OA grows ${mask(formatSGD(result.cpfOa.monthlyGrowth, { showCents: false }))}/mo.`
                                            : " Update OA monthly to count its growth."}
                                    </dd>
                                </div>
                            )}
                            <div>
                                <dt className="font-bold text-(--text-ink)">
                                    Life events
                                </dt>
                                <dd>
                                    Recurring items with a future start or end
                                    date change your saving from that month.
                                </dd>
                            </div>
                            {reality.status === "ok" && (
                                <div>
                                    <dt className="font-bold text-(--text-ink)">
                                        Balances grew
                                    </dt>
                                    <dd>
                                        Your actual growth over{" "}
                                        {reality.monthsUsed.length} months,
                                        leaving out months with goal spending
                                        {roadmap.includeBonuses
                                            ? "."
                                            : " or a bonus."}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    )}
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
                            const key = tradeOffKey(t);
                            return (
                                <li
                                    key={key}
                                    className="flex min-h-11 items-center gap-2 rounded-xl bg-(--bg-cream) px-3 py-1.5"
                                >
                                    <span className="min-w-0 flex-1 wrap-break-word text-xs font-bold text-(--text-ink)">
                                        {tradeOffLabel(t)}
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
                                    {canApplyTradeOff(t) && (
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
            <HaircutSettingsModal
                isOpen={haircutOpen}
                onClose={() => setHaircutOpen(false)}
                haircutPct={haircutPct}
                haircutMonths={haircutMonths}
            />
        </section>
    );
}

export default RoadmapCard;
