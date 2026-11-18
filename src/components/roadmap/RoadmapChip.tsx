/**
 * RoadmapChip: the household plan's verdict on Home ("On track" or
 * "Short S$400/mo"). Hidden when there are no active goals.
 */

import { ChevronRight, Route } from "lucide-react";
import { useRoadmap } from "../../hooks/useRoadmap";
import { CurrencyText } from "../ui";
import { formatSGD } from "../../lib/currency";

export interface RoadmapChipProps {
    onOpen?: () => void;
    className?: string;
}

export function RoadmapChip({ onOpen, className = "" }: RoadmapChipProps) {
    const { result, isLoading } = useRoadmap();
    if (isLoading || result.verdict === "none") return null;
    const isShort = result.verdict === "short";

    const content = (
        <>
            <Route
                aria-hidden="true"
                className="h-4 w-4 shrink-0 text-(--text-muted)"
                strokeWidth={2.5}
            />
            <span className="text-xs font-bold text-(--text-muted)">Goals</span>
            <span
                data-testid="roadmap-chip-verdict"
                className={`font-mono-num text-xs font-black ${
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
            {onOpen && (
                <ChevronRight
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 text-(--text-muted)"
                    strokeWidth={2.5}
                />
            )}
        </>
    );

    const base = `inline-flex min-h-11 items-center gap-1.5 rounded-full border-2 border-(--border-ink) bg-(--bg-card) px-3.5 shadow-cute-sm ${className}`;

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
