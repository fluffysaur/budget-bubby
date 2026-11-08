/**
 * BonusCelebration Component
 * Confetti toast with a chime and haptic when a new bonus is logged.
 * Driven by the parent: pass a celebration and it auto-dismisses after 3 s.
 */

import { useEffect } from "react";
import { Sparkles, X } from "lucide-react";
import { playChaChingSound } from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";
import { formatSGD } from "../../lib/currency";
import { CurrencyText } from "../ui/CurrencyText";

export interface BonusCelebrationData {
    /** Changes for every new celebration so repeat logs re-trigger it. */
    id: string;
    net: number;
    goalTotal: number;
    reachedGoalTitle?: string | null;
}

export interface BonusCelebrationProps {
    celebration: BonusCelebrationData | null;
    onDone: () => void;
}

const CONFETTI = [
    "absolute -top-3.5 left-2 h-2.5 w-1.5 rounded-xs bg-(--pastel-mint) animate-confetti-left [animation-delay:0.05s]",
    "absolute -top-2 left-8 h-2 w-2 rounded-full bg-(--pastel-lilac) animate-confetti-left [animation-delay:0.12s]",
    "absolute -top-4 left-16 h-3 w-1.5 -rotate-12 rounded-xs bg-(--pastel-butter) animate-confetti-left [animation-delay:0.08s]",
    "absolute -top-3.5 right-4 h-2.5 w-1.5 rotate-45 rounded-xs bg-(--pastel-pink) animate-confetti-right [animation-delay:0.06s]",
    "absolute -top-2 right-10 h-2 w-2 rounded-full bg-(--pastel-butter) animate-confetti-right [animation-delay:0.14s]",
    "absolute -top-4 right-18 h-3 w-1.5 rotate-12 rounded-xs bg-(--pastel-mint) animate-confetti-right [animation-delay:0.1s]",
];

export function BonusCelebration({
    celebration,
    onDone,
}: BonusCelebrationProps) {
    const celebrationId = celebration?.id;

    useEffect(() => {
        if (!celebrationId) return;
        try {
            playChaChingSound();
            haptics.success();
        } catch (err) {
            console.debug("Celebration sound/haptic skipped:", err);
        }
        const timer = setTimeout(onDone, 3000);
        return () => clearTimeout(timer);
    }, [celebrationId, onDone]);

    if (!celebration) return null;

    const subtitle = celebration.reachedGoalTitle
        ? `🎉 ${celebration.reachedGoalTitle} reached`
        : celebration.goalTotal > 0
          ? `${formatSGD(celebration.goalTotal)} to goals`
          : null;

    return (
        <div
            role="status"
            aria-live="polite"
            data-testid="bonus-celebration"
            onClick={onDone}
            className="fixed top-16 sm:top-20 left-1/2 z-9999 -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] px-2 animate-cha-ching select-none cursor-pointer"
        >
            <div className="relative flex items-center gap-2 sm:gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) px-3.5 py-2.5 sm:px-4.5 sm:py-3 text-(--text-ink) shadow-cute">
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-visible"
                >
                    {CONFETTI.map((cls) => (
                        <span
                            key={cls}
                            className={`${cls} border border-(--border-ink)`}
                        />
                    ))}
                </div>

                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) shadow-cute-sm">
                    <Sparkles className="h-4.5 w-4.5" />
                </div>

                <div className="min-w-0 flex-1">
                    <p className="text-xs sm:text-sm font-extrabold">
                        <CurrencyText amount={celebration.net} /> bonus logged
                    </p>
                    {subtitle && (
                        <p className="truncate text-xs font-bold text-(--text-muted)">
                            {subtitle}
                        </p>
                    )}
                </div>

                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDone();
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-(--text-muted) transition-colors hover:bg-(--bg-cream) hover:text-(--text-ink)"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export default BonusCelebration;
