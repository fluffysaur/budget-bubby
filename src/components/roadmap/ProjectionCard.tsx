/**
 * ProjectionCard: the household pool (non-CPF net worth) as solid history
 * continuing into a dashed projection. It dips at each goal's date and goal
 * costs change its slope. No investment returns. Unlocks at 3+ months of
 * balance updates; goal costs are listed either way, since they feed the
 * verdict. Always the household plan.
 */

import { useMemo } from "react";
import {
    CartesianGrid,
    ComposedChart,
    Line,
    ReferenceDot,
    ReferenceLine,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import { useReducedMotion } from "motion/react";
import { Link } from "react-router-dom";
import { CalendarClock, ChartLine, ChevronRight, Lock } from "lucide-react";
import {
    formatSGD,
    formatSGDCompact,
    formatSGDEstimate,
    formatSGDTarget,
} from "../../lib/currency";
import { formatShortMonth } from "../../lib/dateUtils";
import {
    netSign,
    otherChangesLabel,
    summarizeGoalCosts,
} from "../../lib/roadmap/goalCosts";
import {
    REALITY_MIN_INTERVALS,
    type CashFlowChange,
    type ProjectionMilestone,
} from "../../lib/roadmap";
import { useMoneyMask } from "../../hooks/useMoneyMask";
import type { RoadmapState } from "../../hooks/useRoadmap";
import { CurrencyText, TooltipPopover, TruncatedText } from "../ui";

export interface ProjectionCardProps {
    roadmap: RoadmapState;
    className?: string;
}

/** History shown before the projection, in months. */
const HISTORY_MONTHS = 24;
/** Months with a balance update needed: one more than the intervals. */
const UNLOCK_MONTHS = REALITY_MIN_INTERVALS + 1;
const LINE_COLOR = "#6366F1";

interface ChartRow {
    month: string;
    history?: number;
    projection?: number;
    milestones: ProjectionMilestone[];
}

interface TooltipEntry {
    payload: ChartRow;
}

function ChartTooltip({
    active,
    payload,
    mask,
}: {
    active?: boolean;
    payload?: TooltipEntry[];
    mask: (t: string) => string;
}) {
    const row = payload?.[0]?.payload;
    if (!active || !row) return null;
    const value = row.projection ?? row.history ?? 0;
    return (
        <div className="min-w-36 space-y-1 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-2.5 text-xs shadow-cute">
            <div className="font-bold text-(--text-ink)">
                {formatShortMonth(row.month)}
                {row.history === undefined && (
                    <span className="font-medium text-(--text-muted)">
                        {" "}
                        · projected
                    </span>
                )}
            </div>
            <div className="font-mono-num text-indigo-600 dark:text-indigo-400">
                {mask(formatSGDEstimate(value))}
            </div>
            {row.milestones.map((m) => (
                <div key={m.goalId} className="text-(--text-muted)">
                    {m.emoji} {m.title} −{mask(formatSGDTarget(m.amount))}
                </div>
            ))}
        </div>
    );
}

function lifeEventWhen(c: CashFlowChange): string {
    if (c.kind === "ends")
        return `Ends · saves from ${formatShortMonth(c.startMonth)}`;
    return c.endMonth
        ? `${formatShortMonth(c.startMonth)} – ${formatShortMonth(c.endMonth)}`
        : `From ${formatShortMonth(c.startMonth)}`;
}

export function ProjectionCard({
    roadmap,
    className = "",
}: ProjectionCardProps) {
    const mask = useMoneyMask();
    const reduceMotion = useReducedMotion();
    const { history, projection, reality, result } = roadmap;
    const goalCosts = useMemo(
        () => summarizeGoalCosts(result.lifeEvents, roadmap.input.goals),
        [result.lifeEvents, roadmap.input.goals],
    );
    const otherLabel = otherChangesLabel(goalCosts.otherCount);
    const locked = reality.status === "locked";
    const updatedMonths = history.filter((p) => p.actual).length;

    const rows = useMemo<ChartRow[]>(() => {
        const start = projection[0]?.month;
        const past = history
            .filter((p) => !start || p.month < start)
            .slice(-HISTORY_MONTHS)
            .map((p) => ({ month: p.month, history: p.value, milestones: [] }));
        const future = projection.map((p, i) => ({
            month: p.month,
            projection: p.value,
            // The first projected month joins the solid line.
            history: i === 0 ? p.value : undefined,
            milestones: p.milestones,
        }));
        return [...past, ...future];
    }, [history, projection]);

    const minValue = rows.reduce(
        (min, r) => Math.min(min, r.projection ?? r.history ?? 0),
        0,
    );
    const last = projection.at(-1);
    const summary = last
        ? mask(
              `Pool ${formatSGDEstimate(projection[0].value)} now, projected ${formatSGDEstimate(last.value)} by ${formatShortMonth(last.month)}`,
          )
        : "";

    if (result.verdict === "none") return null;

    return (
        <section
            aria-label="Net worth projection"
            data-testid="projection-card"
            className={`space-y-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-cute sm:p-5 ${className}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink)">
                        <ChartLine
                            aria-hidden="true"
                            className="h-4 w-4"
                            strokeWidth={2.5}
                        />
                    </span>
                    <div className="min-w-0">
                        <h3 className="font-display text-base font-black tracking-tight text-(--text-ink)">
                            Net Worth Projection
                        </h3>
                        <p className="text-xs text-(--text-muted)">
                            Excludes CPF · no investment returns
                        </p>
                    </div>
                </div>
                <TooltipPopover
                    title="How it's drawn"
                    ariaLabel="How the projection is drawn"
                    align="right"
                    className="shrink-0"
                >
                    <dl className="space-y-1.5 text-xs">
                        <div>
                            <dt className="font-bold text-(--text-ink)">
                                Solid line
                            </dt>
                            <dd>
                                Your balance updates. Missing months are joined
                                with straight lines.
                            </dd>
                        </div>
                        <div>
                            <dt className="font-bold text-(--text-ink)">
                                Dashed line
                            </dt>
                            <dd>
                                Monthly saving plus recurring changes, dropping
                                when each goal is paid.
                            </dd>
                        </div>
                    </dl>
                </TooltipPopover>
            </div>

            {locked ? (
                <div
                    data-testid="projection-locked"
                    className="flex flex-col items-center gap-1 rounded-xl border-2 border-dashed border-(--border-subtle) bg-(--bg-canvas) px-4 py-6 text-center"
                >
                    <Lock
                        aria-hidden="true"
                        className="h-5 w-5 text-(--text-muted)"
                        strokeWidth={2.5}
                    />
                    <p className="text-sm font-bold text-(--text-ink)">
                        Update balances monthly to unlock
                    </p>
                    <p className="font-mono-num text-xs text-(--text-muted)">
                        {Math.min(updatedMonths, UNLOCK_MONTHS)} of{" "}
                        {UNLOCK_MONTHS} months
                    </p>
                </div>
            ) : (
                <figure>
                    <div
                        role="img"
                        aria-label={summary}
                        className="h-56 w-full"
                    >
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart
                                data={rows}
                                margin={{
                                    top: 12,
                                    right: 16,
                                    left: 0,
                                    bottom: 0,
                                }}
                            >
                                <CartesianGrid
                                    strokeDasharray="3 3"
                                    opacity={0.12}
                                    vertical={false}
                                />
                                <XAxis
                                    dataKey="month"
                                    tickLine={false}
                                    axisLine={false}
                                    minTickGap={24}
                                    tickFormatter={(m: string) =>
                                        formatShortMonth(m)
                                    }
                                    tick={{
                                        fontSize: 11,
                                        fill: "var(--text-faint)",
                                    }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={false}
                                    width={52}
                                    tickFormatter={(v: number) =>
                                        mask(formatSGDCompact(v))
                                    }
                                    tick={{
                                        fontSize: 11,
                                        fill: "var(--text-faint)",
                                    }}
                                />
                                {minValue < 0 && (
                                    <ReferenceLine
                                        y={0}
                                        stroke="var(--text-muted)"
                                        strokeOpacity={0.5}
                                    />
                                )}
                                <Tooltip
                                    content={<ChartTooltip mask={mask} />}
                                />
                                <Line
                                    type="linear"
                                    dataKey="history"
                                    name="Actual"
                                    stroke={LINE_COLOR}
                                    strokeWidth={2.5}
                                    dot={false}
                                    connectNulls={false}
                                    isAnimationActive={!reduceMotion}
                                />
                                <Line
                                    type="linear"
                                    dataKey="projection"
                                    name="Projected"
                                    stroke={LINE_COLOR}
                                    strokeWidth={2.5}
                                    strokeDasharray="5 4"
                                    dot={false}
                                    isAnimationActive={!reduceMotion}
                                />
                                {rows
                                    .filter((r) => r.milestones.length > 0)
                                    .map((r) => (
                                        <ReferenceDot
                                            key={r.month}
                                            x={r.month}
                                            y={r.projection}
                                            r={3.5}
                                            fill={LINE_COLOR}
                                            stroke="var(--bg-card)"
                                            strokeWidth={1.5}
                                            label={{
                                                value: r.milestones
                                                    .map((m) => m.emoji)
                                                    .join(""),
                                                position: "right",
                                                fontSize: 13,
                                            }}
                                        />
                                    ))}
                            </ComposedChart>
                        </ResponsiveContainer>
                    </div>
                    <figcaption className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-medium text-(--text-muted)">
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="h-0.5 w-4 rounded-full bg-indigo-500"
                            />
                            Actual
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                            <span
                                aria-hidden="true"
                                className="w-4 border-t-2 border-dashed border-indigo-500"
                            />
                            Projected
                        </span>
                        <span>Emoji = goal paid</span>
                    </figcaption>
                </figure>
            )}

            {/* Goal costs */}
            <div className="space-y-1.5 border-t-2 border-(--border-subtle) pt-3">
                <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Goal Costs
                </span>
                {goalCosts.linked.length === 0 ? (
                    <p className="text-xs text-(--text-muted)">
                        Link a recurring cost to a goal, like childcare after
                        Baby Fund.
                    </p>
                ) : (
                    <ul aria-label="Goal costs" className="space-y-1.5">
                        {goalCosts.linked.map(({ change: c, goalTitle }) => (
                            <li
                                key={c.id}
                                className="flex min-h-11 items-center gap-2 rounded-xl bg-(--bg-cream) px-3 py-1.5"
                            >
                                <CalendarClock
                                    aria-hidden="true"
                                    className="h-4 w-4 shrink-0 text-(--text-muted)"
                                    strokeWidth={2.5}
                                />
                                <span className="flex min-w-0 flex-1 flex-col">
                                    <TruncatedText
                                        text={c.name}
                                        className="text-xs font-bold text-(--text-ink)"
                                    />
                                    <span className="text-[11px] text-(--text-muted)">
                                        {goalTitle
                                            ? `after ${goalTitle}`
                                            : lifeEventWhen(c)}
                                    </span>
                                </span>
                                <span
                                    className={`shrink-0 font-mono-num text-xs font-bold ${
                                        c.monthlyDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-emerald-700 dark:text-emerald-400"
                                    }`}
                                >
                                    {c.monthlyDelta < 0 ? "−" : "+"}
                                    <CurrencyText
                                        formatted={formatSGD(
                                            Math.abs(c.monthlyDelta),
                                        )}
                                    />
                                    /mo
                                </span>
                            </li>
                        ))}
                    </ul>
                )}
                {otherLabel && (
                    <Link
                        to="/recurring"
                        className="flex min-h-11 items-center gap-1 text-xs font-bold text-(--text-muted) hover:text-(--text-ink)"
                    >
                        <span className="min-w-0 flex-1">
                            {otherLabel} · net {netSign(goalCosts.otherMonthly)}
                            <CurrencyText
                                formatted={formatSGD(
                                    Math.abs(goalCosts.otherMonthly),
                                )}
                            />
                            /mo
                        </span>
                        <ChevronRight
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0"
                            strokeWidth={2.5}
                        />
                    </Link>
                )}
            </div>
        </section>
    );
}

export default ProjectionCard;
