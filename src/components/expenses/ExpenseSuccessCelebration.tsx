/**
 * ExpenseSuccessCelebration Component
 * A compact 2s "Cha-ching!" toast with a cheering Bubby whenever an expense
 * is logged. Confetti is kept for real milestones (see DelightHost).
 * Expenses confirmed from the inbox (detail.source === "inbox") skip the
 * toast, so triage stays quick.
 *
 * Fully responsive and guarded against mobile horizontal overflow.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { X } from "lucide-react";
import type { Expense } from "../../types/finance";
import type { ExpenseAddedDetail } from "../../lib/appEvents";
import { feedback } from "../../lib/delight/feedback";
import { readBubbyStore } from "../../lib/bubby/storage";
import { CurrencyText } from "../ui/CurrencyText";
import { Bubby } from "../bubby/Bubby";

export interface ExpenseSuccessCelebrationProps {
    expense?: Expense | null;
    onFinished?: () => void;
}

const TOAST_MS = 2000;

interface ActiveToast {
    id: number;
    expense: Expense;
    stage: number;
    equipped: Record<string, string>;
}

export function ExpenseSuccessCelebration({
    expense,
    onFinished,
}: ExpenseSuccessCelebrationProps) {
    const [active, setActive] = useState<ActiveToast | null>(null);
    const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const seqRef = useRef(0);

    const clearDismissTimer = useCallback(() => {
        if (dismissTimerRef.current) {
            clearTimeout(dismissTimerRef.current);
            dismissTimerRef.current = null;
        }
    }, []);

    const handleDismiss = useCallback(() => {
        clearDismissTimer();
        setActive(null);
        onFinished?.();
    }, [clearDismissTimer, onFinished]);

    const triggerCelebration = useCallback(
        (exp: Expense) => {
            clearDismissTimer();
            // Stage and outfit from the last render of the live Bubby (works outside providers)
            const snapshot = readBubbyStore().snapshot;
            seqRef.current += 1;
            setActive({
                id: seqRef.current,
                expense: exp,
                stage: snapshot?.stage ?? 5,
                equipped: snapshot?.equipped ?? {},
            });
            feedback.routine("add");

            dismissTimerRef.current = setTimeout(() => {
                handleDismiss();
            }, TOAST_MS);
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
            const detail = (e as CustomEvent<ExpenseAddedDetail>).detail;
            // Inbox triage confirms many items quickly: no per-item toast
            if (detail && detail.source !== "inbox") {
                triggerCelebration(detail);
            }
        };
        window.addEventListener("expenseAdded", handleGlobalExpenseAdded);
        return () => window.removeEventListener("expenseAdded", handleGlobalExpenseAdded);
    }, [triggerCelebration]);

    if (!active) return null;
    const activeExpense = active.expense;

    return (
        <div
            role="status"
            aria-live="polite"
            onClick={handleDismiss}
            className="fixed top-16 sm:top-20 left-1/2 z-9999 -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] px-2 animate-toast-in select-none cursor-pointer"
        >
            <div className="relative flex items-center gap-2 sm:gap-3 rounded-2xl bg-(--bg-card) text-(--text-ink) pl-2 pr-3 sm:pr-4 py-1.5 sm:py-2 shadow-(--shadow-cute) border-2 border-(--border-ink) max-w-full active:scale-95 transition-transform">
                {/* Cheering Bubby badge */}
                <div className="flex h-9 w-9 shrink-0 items-end justify-center overflow-hidden rounded-xl bg-(--pastel-mint) border-2 border-(--border-ink) pt-0.5">
                    <Bubby
                        key={active.id}
                        stage={active.stage}
                        mood="happy"
                        reaction="cheer"
                        equipped={active.equipped}
                        size="xs"
                        className="h-8 w-8"
                        decorative
                    />
                </div>

                {/* Details Container */}
                <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm font-bold min-w-0 flex-1">
                    <span className="text-emerald-700 dark:text-emerald-300 font-extrabold shrink-0">
                        Cha-ching!
                    </span>
                    <span className="shrink-0">
                        <CurrencyText amount={activeExpense.amount} />
                    </span>
                    <span className="text-(--text-muted) shrink-0">•</span>
                    <span className="truncate max-w-28 sm:max-w-48 text-(--text-ink) font-medium">
                        {activeExpense.item}
                    </span>
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
