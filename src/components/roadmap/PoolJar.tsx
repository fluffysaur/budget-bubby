/**
 * PoolJar: the household pool as a jar of water. Goal bands stack from the
 * bottom in funding order; the water line is today's pool. Tapping a band
 * previews the water level at that goal's date. Motion is transform-only and
 * goes static under reduced motion (MotionConfig reducedMotion="user").
 */

import { useMemo } from "react";
import { m } from "motion/react";
import { Check } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { DURATION, EASE_OUT_SOFT } from "../../lib/motion";
import { layoutJar, type RoadmapResult } from "../../lib/roadmap";
import { useMoneyMask } from "../../hooks/useMoneyMask";
import { TruncatedText } from "../ui/TruncatedText";

export interface PoolJarProps {
    result: RoadmapResult;
    selectedId: string | null;
    onSelect: (goalId: string | null) => void;
    /** Jar height in pixels. */
    height?: number;
    className?: string;
}

/** Zig-zag across a band that was squashed to fit the jar. */
function SquiggleBreak() {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 120 8"
            preserveAspectRatio="none"
            className="absolute inset-x-0 top-1/2 h-2 w-full -translate-y-1/2 text-(--border-ink)"
        >
            <path
                d="M0 4 L10 0 L20 8 L30 0 L40 8 L50 0 L60 8 L70 0 L80 8 L90 0 L100 8 L110 0 L120 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
}

export function PoolJar({
    result,
    selectedId,
    onSelect,
    height = 240,
    className = "",
}: PoolJarProps) {
    const mask = useMoneyMask();
    const goals = result.goals;
    const layout = useMemo(
        () =>
            layoutJar({
                bands: goals.map((g) => g.stillNeeded),
                maxLevel: Math.max(0, result.poolToday),
                height,
            }),
        [goals, result.poolToday, height],
    );

    const selected = goals.find((g) => g.goal.id === selectedId) ?? null;
    const level = selected ? selected.available : result.poolToday;
    const levelPx = Math.min(layout.height, layout.toPx(level));
    const todayPx = Math.min(layout.height, layout.toPx(result.poolToday));
    const fundedCount = goals.filter(
        (g) => g.fundedToday >= g.stillNeeded,
    ).length;

    const summary = mask(
        `Pool ${formatSGD(result.poolToday)} covers ${fundedCount} of ${goals.length} goals today`,
    );

    return (
        <div
            className={`relative w-full ${className}`}
            style={{ height: layout.height + 12 }}
        >
            {/* Jar graphic (decorative to screen readers beyond its summary) */}
            <div
                role="img"
                aria-label={summary}
                className="absolute bottom-0 left-0 w-28 sm:w-32"
                style={{ height: layout.height + 12 }}
            >
                <div className="absolute top-0 left-1/2 h-3 w-16 -translate-x-1/2 rounded-t-lg border-2 border-b-0 border-(--border-ink) bg-(--bg-cream)" />
                <div
                    className="absolute bottom-0 inset-x-0 overflow-hidden rounded-t-2xl rounded-b-4xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute"
                    style={{ height: layout.height }}
                >
                    {/* Water: a full-height block slid up to the level */}
                    <m.div
                        aria-hidden="true"
                        className="absolute inset-x-0 bottom-0 bg-(--pastel-mint)"
                        style={{ height: layout.height }}
                        initial={{ y: layout.height }}
                        animate={{ y: layout.height - levelPx }}
                        transition={{
                            duration: DURATION.slow,
                            ease: EASE_OUT_SOFT,
                        }}
                    >
                        <m.svg
                            key={selectedId ?? "today"}
                            aria-hidden="true"
                            viewBox="0 0 240 10"
                            preserveAspectRatio="none"
                            className="absolute -top-2 left-0 h-2.5 w-[200%] text-(--pastel-mint)"
                            initial={{ x: "0%" }}
                            animate={{ x: "-25%" }}
                            transition={{
                                duration: DURATION.slow * 3,
                                ease: EASE_OUT_SOFT,
                            }}
                        >
                            <path
                                d="M0 5 Q15 0 30 5 T60 5 T90 5 T120 5 T150 5 T180 5 T210 5 T240 5 V10 H0 Z"
                                fill="currentColor"
                            />
                        </m.svg>
                    </m.div>

                    {/* Band dividers */}
                    {layout.bands.map((band, i) => (
                        <div
                            key={goals[i].goal.id}
                            aria-hidden="true"
                            className={`absolute inset-x-0 border-t-2 border-dashed ${
                                goals[i].goal.id === selectedId
                                    ? "border-(--border-ink) bg-(--pastel-butter-light)/40"
                                    : "border-(--border-subtle)"
                            }`}
                            style={{
                                bottom: band.bottom,
                                height: band.height,
                            }}
                        >
                            {band.broken && <SquiggleBreak />}
                            <span className="absolute left-1.5 top-1 text-sm leading-none">
                                {goals[i].goal.emoji}
                            </span>
                        </div>
                    ))}
                </div>

                {/* "You are here" tick at today's level */}
                <div
                    aria-hidden="true"
                    className="absolute -left-1 h-0.5 w-3 rounded-full bg-(--text-ink)"
                    style={{ bottom: Math.max(0, todayPx - 1) }}
                />
            </div>

            {/* Tap targets and labels, one per band */}
            {layout.bands.map((band, i) => {
                const g = goals[i];
                const isSelected = g.goal.id === selectedId;
                const funded = g.fundedToday >= g.stillNeeded;
                return (
                    <button
                        key={g.goal.id}
                        type="button"
                        aria-pressed={isSelected}
                        aria-label={`Preview ${g.goal.title}`}
                        onClick={() => onSelect(isSelected ? null : g.goal.id)}
                        className="absolute left-0 right-0 flex cursor-pointer items-center pl-32 sm:pl-36 text-left transition-colors"
                        style={{
                            bottom: band.bottom,
                            height: Math.max(band.height, 1),
                        }}
                    >
                        <span
                            className={`flex min-w-0 flex-1 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold ${
                                isSelected
                                    ? "bg-(--pastel-butter-light) text-(--text-ink)"
                                    : "text-(--text-muted)"
                            }`}
                        >
                            <TruncatedText
                                text={g.goal.title}
                                className="min-w-0 flex-1"
                            />
                            {funded && (
                                <Check
                                    aria-label="Covered"
                                    className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                                    strokeWidth={3}
                                />
                            )}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

export default PoolJar;
