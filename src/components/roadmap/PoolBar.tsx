/**
 * PoolBar: the household pool as one stacked bar. Goal segments run left to
 * right in funding order, sized by what each still needs (with a minimum
 * width so small goals stay tappable). The fill is today's pool; tapping a
 * segment animates the fill to that goal's projected level on its date.
 * A dashed "Spare" segment appears when the pool exceeds every goal.
 * Motion is transform-only and goes static under reduced motion
 * (MotionConfig reducedMotion="user").
 */

import { useMemo } from "react";
import { m } from "motion/react";
import { formatSGDEstimate } from "../../lib/currency";
import { DURATION, EASE_OUT_SOFT } from "../../lib/motion";
import { layoutJar, type RoadmapResult } from "../../lib/roadmap";
import { useMoneyMask } from "../../hooks/useMoneyMask";

export interface PoolBarProps {
    result: RoadmapResult;
    selectedId: string | null;
    onSelect: (goalId: string | null) => void;
    className?: string;
}

/** `selectedId` value for the Spare segment. */
export const SPARE_ID = "spare";

/** Layout in percent of the bar's width. */
const SCALE = 100;
/** Minimum segment width, in percent. */
const MIN_SEGMENT = 10;
/** Segments narrower than this hide their emoji. */
const EMOJI_MIN = 8;

export function PoolBar({
    result,
    selectedId,
    onSelect,
    className = "",
}: PoolBarProps) {
    const mask = useMoneyMask();
    const goals = result.goals;
    const layout = useMemo(
        () =>
            layoutJar({
                bands: goals.map((g) => g.stillNeeded),
                maxLevel: Math.max(0, result.poolToday),
                height: SCALE,
                minBand: MIN_SEGMENT,
                maxShare: 1,
            }),
        [goals, result.poolToday],
    );
    // More than 10 goals overflow 100%; rescale so the bar always fits.
    const pct = (px: number) => (px / layout.height) * 100;

    const selected = goals.find((g) => g.goal.id === selectedId) ?? null;
    const level = selected ? selected.available : result.poolToday;
    const fill = Math.min(100, pct(layout.toPx(level)));
    const today = Math.min(100, pct(layout.toPx(result.poolToday)));
    const fundedCount = goals.filter(
        (g) => g.fundedToday >= g.stillNeeded,
    ).length;

    return (
        <div className={`space-y-1 ${className}`}>
            <div
                data-testid="pool-bar"
                className="relative h-11 overflow-hidden rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm"
            >
                {/* Fill: a full-width block scaled from the left */}
                <m.div
                    aria-hidden="true"
                    className="absolute inset-0 origin-left bg-(--pastel-mint)"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: fill / 100 }}
                    transition={{
                        duration: DURATION.slow,
                        ease: EASE_OUT_SOFT,
                    }}
                />

                {layout.headroom && (
                    <button
                        type="button"
                        aria-pressed={selectedId === SPARE_ID}
                        aria-label="Show spare"
                        onClick={() =>
                            onSelect(selectedId === SPARE_ID ? null : SPARE_ID)
                        }
                        className={`absolute inset-y-0 flex cursor-pointer items-center justify-center border-l-2 border-dashed border-(--border-subtle) text-2xs font-bold uppercase tracking-wider text-(--text-muted) ${
                            selectedId === SPARE_ID
                                ? "ring-2 ring-inset ring-(--border-ink)"
                                : ""
                        }`}
                        style={{
                            left: `${pct(layout.headroom.bottom)}%`,
                            width: `${pct(layout.headroom.height)}%`,
                        }}
                    >
                        {pct(layout.headroom.height) >= 14 && "Spare"}
                    </button>
                )}

                {layout.bands.map((seg, i) => {
                    const g = goals[i];
                    const isSelected = g.goal.id === selectedId;
                    const width = pct(seg.height);
                    return (
                        <button
                            key={g.goal.id}
                            type="button"
                            aria-pressed={isSelected}
                            aria-label={`Preview ${g.goal.title}`}
                            onClick={() =>
                                onSelect(isSelected ? null : g.goal.id)
                            }
                            className={`absolute inset-y-0 flex cursor-pointer items-center justify-center text-base transition-colors ${
                                i > 0
                                    ? "border-l-2 border-dashed border-(--border-ink)/40"
                                    : ""
                            } ${
                                isSelected
                                    ? "ring-2 ring-inset ring-(--border-ink)"
                                    : ""
                            }`}
                            style={{
                                left: `${pct(seg.bottom)}%`,
                                width: `${width}%`,
                            }}
                        >
                            {width >= EMOJI_MIN && (
                                <span aria-hidden="true">{g.goal.emoji}</span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* "Today" tick under the bar */}
            <div aria-hidden="true" className="relative h-3">
                <span
                    className="absolute top-0 h-2 w-0.5 -translate-x-1/2 rounded-full bg-(--text-ink)"
                    style={{ left: `${today}%` }}
                />
            </div>

            <span className="sr-only">
                {mask(
                    `Pool ${formatSGDEstimate(result.poolToday)} covers ${fundedCount} of ${goals.length} goals today`,
                )}
            </span>
        </div>
    );
}

export default PoolBar;
