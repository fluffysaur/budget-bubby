/**
 * ExpenseSuccessCelebration Component
 * Renders a delightful celebratory toast with coin bursts and a synthesized
 * Web Audio "cha-ching" sound effect when an expense is successfully logged.
 */

import { useState, useEffect, useCallback } from "react";
import { Sparkles, Coins } from "lucide-react";
import type { Expense } from "../../types/finance";
import { formatSGD } from "../../lib/currency";

export interface ExpenseSuccessCelebrationProps {
    expense?: Expense | null;
    onFinished?: () => void;
}

// Synthesize pleasant "cha-ching" dual chime sound via Web Audio API
function playChaChingSound() {
    if (typeof window === "undefined") return;
    const AudioContextClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    try {
        const ctx = new AudioContextClass();
        if (ctx.state === "suspended") {
            ctx.resume().catch(() => {});
        }

        const now = ctx.currentTime;

        // First bell chime (high E: ~1318.5 Hz)
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = "sine";
        osc1.frequency.setValueAtTime(1318.5, now);
        osc1.frequency.exponentialRampToValueAtTime(1567.98, now + 0.08); // slide up to G6
        gain1.gain.setValueAtTime(0.2, now);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
        osc1.connect(gain1);
        gain1.connect(ctx.destination);
        osc1.start(now);
        osc1.stop(now + 0.35);

        // Second celebratory cash chime (higher C7: ~2093 Hz)
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = "triangle";
        osc2.frequency.setValueAtTime(2093.0, now + 0.09);
        gain2.gain.setValueAtTime(0.25, now + 0.09);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        osc2.start(now + 0.09);
        osc2.stop(now + 0.55);
    } catch (err) {
        // Audio context may be restricted by autoplay policy or test environment
        console.debug("Audio play skipped:", err);
    }
}

export function ExpenseSuccessCelebration({ expense, onFinished }: ExpenseSuccessCelebrationProps) {
    const [activeExpense, setActiveExpense] = useState<Expense | null>(null);

    const triggerCelebration = useCallback(
        (exp: Expense) => {
            setActiveExpense(exp);
            playChaChingSound();
            const timer = setTimeout(() => {
                setActiveExpense(null);
                onFinished?.();
            }, 2500);
            return () => clearTimeout(timer);
        },
        [onFinished],
    );

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
            className="fixed top-18 sm:top-20 left-1/2 z-50 pointer-events-none -translate-x-1/2 animate-cha-ching"
        >
            <div className="relative flex items-center gap-2.5 rounded-full bg-slate-900/95 text-white dark:bg-white dark:text-slate-900 px-5 py-2.5 shadow-2xl border border-emerald-500/40 backdrop-blur-md">
                {/* Floating coins particle effect */}
                <span className="absolute -top-3 left-4 text-xs font-bold text-amber-400 animate-coin-float select-none">
                    +S$
                </span>
                <span className="absolute -top-4 right-6 text-[10px] font-bold text-emerald-400 animate-coin-float select-none">
                    ✨
                </span>

                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/40">
                    <Coins className="h-4 w-4" />
                </div>

                <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold">
                    <span className="text-emerald-400 dark:text-emerald-600">Cha-ching!</span>
                    <span className="font-extrabold">{formatSGD(activeExpense.amount)}</span>
                    <span className="text-slate-300 dark:text-slate-600">•</span>
                    <span className="truncate max-w-35 text-slate-200 dark:text-slate-700 font-medium">
                        {activeExpense.item}
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                </div>
            </div>
        </div>
    );
}

export default ExpenseSuccessCelebration;
