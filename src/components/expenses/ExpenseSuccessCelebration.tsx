/**
 * ExpenseSuccessCelebration Component
 * Renders a delightful celebratory toast with pastel confetti, sparkling stars,
 * and a synthesized Web Audio "cha-ching" sound effect when an expense is logged.
 *
 * Fully responsive and guarded against mobile horizontal overflow.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Coins, X } from "lucide-react";
import type { Expense } from "../../types/finance";
import { formatSGD } from "../../lib/currency";
import { playChaChingSound } from "../../lib/soundEffects";
import { haptics } from "../../lib/haptics";

export interface ExpenseSuccessCelebrationProps {
    expense?: Expense | null;
    onFinished?: () => void;
}

export function ExpenseSuccessCelebration({
    expense,
    onFinished,
}: ExpenseSuccessCelebrationProps) {
    const [activeExpense, setActiveExpense] = useState<Expense | null>(null);
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const clearDismissTimer = useCallback(() => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
        }
    }, []);

    const handleDismiss = useCallback(() => {
        clearDismissTimer();
        setActiveExpense(null);
        onFinished?.();
    }, [clearDismissTimer, onFinished]);

    const triggerCelebration = useCallback(
        (exp: Expense) => {
            clearDismissTimer();
            setActiveExpense(exp);
            try {
                playChaChingSound();
                haptics.success();
            } catch (err) {
                console.debug("Celebration sound/haptic skipped:", err);
            }

            dismissTimerRef.current = setTimeout(() => {
                handleDismiss();
            }, 3000);
        },
        [clearDismissTimer, handleDismiss],
    );

    // Clean up timer on unmount
    useEffect(() => {
        return () => {
            clearDismissTimer();
        };
    }, [clearDismissTimer]);

    // Listen to prop changes
    useEffect(() => {
        if (expense) {
            triggerCelebration(expense);
        }
    }, [expense, triggerCelebration]);

    // Global window event listener to catch 'expenseAdded'
    useEffect(() => {
        const handleGlobalExpenseAdded = (e: Event) => {
            const customEvent = e as CustomEvent<Expense>;
            if (customEvent.detail) {
                triggerCelebration(customEvent.detail);
            }
        };
        window.addEventListener("expenseAdded", handleGlobalExpenseAdded);
        return () => window.removeEventListener("expenseAdded", handleGlobalExpenseAdded);
    }, [triggerCelebration]);

    if (!activeExpense) return null;

    return (
        <div
            role="status"
            aria-live="polite"
            onClick={handleDismiss}
            className="fixed top-16 sm:top-20 left-1/2 z-9999 -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] px-2 animate-cha-ching select-none cursor-pointer"
        >
            <div className="relative flex items-center gap-2 sm:gap-3 rounded-2xl bg-(--bg-card) text-(--text-ink) px-3.5 sm:px-4.5 py-2.5 sm:py-3 shadow-(--shadow-cute) border-2 border-(--border-ink) max-w-full overflow-visible transition-transform hover:scale-105 active:scale-95">
                {/* Decorative Pastel Confetti Particles */}
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 overflow-visible"
                >
                    {/* Top-left fluttering confetti pieces */}
                    <span className="absolute -top-3.5 left-2 h-2.5 w-1.5 rounded-xs bg-[#bbf7d0] border border-(--border-ink) animate-confetti-left [animation-delay:0.05s]" />
                    <span className="absolute -top-2 left-8 h-2 w-2 rounded-full bg-[#dfc2ff] border border-(--border-ink) animate-confetti-left [animation-delay:0.12s]" />
                    <span className="absolute -top-4 left-16 h-3 w-1.5 -rotate-12 rounded-xs bg-[#fed7aa] border border-(--border-ink) animate-confetti-left [animation-delay:0.08s]" />

                    {/* Top-right fluttering confetti pieces */}
                    <span className="absolute -top-3.5 right-4 h-2.5 w-1.5 rotate-45 rounded-xs bg-[#fecdd3] border border-(--border-ink) animate-confetti-right [animation-delay:0.06s]" />
                    <span className="absolute -top-2 right-10 h-2 w-2 rounded-full bg-[#fef08a] border border-(--border-ink) animate-confetti-right [animation-delay:0.14s]" />
                    <span className="absolute -top-4 right-18 h-3 w-1.5 rotate-12 rounded-xs bg-[#bbf7d0] border border-(--border-ink) animate-confetti-right [animation-delay:0.1s]" />

                    {/* Shimmering Pastel Star Sparkles */}
                    <svg
                        className="absolute -top-4 left-4 h-4 w-4 fill-amber-400 text-amber-500 animate-sparkle-twinkle"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                    </svg>
                    <svg
                        className="absolute -top-3 right-6 h-3.5 w-3.5 fill-[#dfc2ff] text-purple-600 animate-sparkle-twinkle [animation-delay:0.15s]"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                    </svg>
                    <svg
                        className="absolute -bottom-2.5 right-12 h-3 w-3 fill-emerald-400 text-emerald-600 animate-sparkle-twinkle [animation-delay:0.25s]"
                        viewBox="0 0 24 24"
                    >
                        <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
                    </svg>
                </div>

                {/* Coin Badge Icon with Tactile Cute Styling */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--pastel-mint) border-2 border-(--border-ink) text-(--text-ink) shadow-(--shadow-cute-sm)">
                    <Coins className="h-4.5 w-4.5" />
                </div>

                {/* Details Container */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold min-w-0 flex-1">
                    <span className="text-emerald-700 dark:text-emerald-300 font-extrabold shrink-0">
                        Cha-ching!
                    </span>
                    <span className="font-extrabold shrink-0 font-mono-num">
                        {formatSGD(activeExpense.amount)}
                    </span>
                    <span className="text-(--text-muted) shrink-0">•</span>
                    <span className="truncate max-w-28 sm:max-w-48 text-(--text-ink) font-medium">
                        {activeExpense.item}
                    </span>
                    <Sparkles className="h-4 w-4 text-amber-500 fill-amber-400 shrink-0 ml-0.5 animate-pulse" />
                </div>

                {/* Dismiss Action Hint */}
                <button
                    type="button"
                    aria-label="Dismiss notification"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDismiss();
                    }}
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

export default ExpenseSuccessCelebration;
