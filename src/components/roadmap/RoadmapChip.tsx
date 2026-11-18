/**
 * RoadmapChip: the household plan on Home, as one full-width row.
 * Line 1: "Goals · On track" or "Goals · Short S$400/mo".
 * Line 2: the first short goal, or the next goal by date.
 * Hidden when there are no active goals.
 */

import { ChevronRight, Route } from "lucide-react";
import { useRoadmap } from "../../hooks/useRoadmap";
import { formatSGD } from "../../lib/currency";
import { formatShortMonth } from "../../lib/dateUtils";
import type { RoadmapGoalResult } from "../../lib/roadmap";
import { CurrencyText, TruncatedText } from "../ui";

export interface RoadmapChipProps {
    onOpen?: () => void;
    className?: string;
}

/** The goal worth naming: the first short one, else the next upcoming one. */
function focusLine(goals: RoadmapGoalResult[]): string | null {
    const short = goals.find((g) => g.status === "short");
    if (short) {
        return `${short.goal.emoji} ${short.goal.title} short by ${formatShortMonth(short.goal.targetDate)}`;
    }
    const next = goals.find((g) => g.status !== "overdue") ?? goals[0];
    if (!next) return null;
    return `Next: ${next.goal.emoji} ${next.goal.title} ${formatShortMonth(next.goal.targetDate)}`;
}

export function RoadmapChip({ onOpen, className = "" }: RoadmapChipProps) {
    const { result, isLoading } = useRoadmap();
    if (isLoading || result.verdict === "none") return null;
    const isShort = result.verdict === "short";
    const line = focusLine(result.goals);

    const content = (
        <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink)">
                <Route
                    aria-hidden="true"
                    className="h-4 w-4"
                    strokeWidth={2.5}
                />
            </span>
            <span className="flex min-w-0 flex-1 flex-col text-left">
                <span className="flex items-baseline gap-1.5 text-sm font-black text-(--text-ink)">
                    <span>Goals</span>
                    <span aria-hidden="true" className="text-(--text-muted)">
                        ·
                    </span>
                    <span
                        data-testid="roadmap-chip-verdict"
                        className={`font-mono-num ${
                            isShort
                                ? "text-rose-600 dark:text-rose-400"
                                : "text-emerald-700 dark:text-emerald-400"
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
                    </span>
                </span>
                {line && (
                    <TruncatedText
                        text={line}
                        className="text-xs font-medium text-(--text-muted)"
                    />
                )}
            </span>
            {onOpen && (
                <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-(--text-muted)"
                    strokeWidth={2.5}
                />
            )}
        </>
    );

    const base = `flex min-h-11 w-full items-center gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) px-3.5 py-2.5 shadow-cute-sm ${className}`;

    return onOpen ? (
        <button
            type="button"
            onClick={onOpen}
            className={`${base} cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-press`}
        >
            {content}
        </button>
    ) : (
        <div className={base}>{content}</div>
    );
}

export default RoadmapChip;
