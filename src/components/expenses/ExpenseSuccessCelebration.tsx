/**
 * ExpenseSuccessCelebration Component
 * Renders a delightful celebratory toast with coin bursts and a synthesized
 * Web Audio "cha-ching" sound effect when an expense is successfully logged.
 *
 * Fully responsive and guarded against mobile horizontal overflow.
 */

import { useState, useEffect, useCallback } from 'react';
import { Sparkles, Coins } from 'lucide-react';
import type { Expense } from '../../types/finance';
import { formatSGD } from '../../lib/currency';
import { playChaChingSound } from '../../lib/soundEffects';

export interface ExpenseSuccessCelebrationProps {
  expense?: Expense | null;
  onFinished?: () => void;
}

export function ExpenseSuccessCelebration({
  expense,
  onFinished,
}: ExpenseSuccessCelebrationProps) {
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
    [onFinished]
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
    window.addEventListener('expenseAdded', handleGlobalExpenseAdded);
    return () => window.removeEventListener('expenseAdded', handleGlobalExpenseAdded);
  }, [triggerCelebration]);

  if (!activeExpense) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-16 sm:top-20 left-1/2 z-50 pointer-events-none -translate-x-1/2 w-max max-w-[calc(100vw-2rem)] px-2 animate-cha-ching select-none"
    >
      <div className="relative flex items-center gap-2 sm:gap-2.5 rounded-full bg-slate-900/95 text-white dark:bg-white dark:text-slate-900 px-3.5 sm:px-5 py-2 sm:py-2.5 shadow-2xl border border-emerald-500/40 backdrop-blur-md max-w-full overflow-hidden">
        {/* Floating coins particle effect */}
        <span
          aria-hidden="true"
          className="absolute -top-3 left-4 text-xs font-bold text-amber-400 animate-coin-float select-none"
        >
          +S$
        </span>
        <span
          aria-hidden="true"
          className="absolute -top-4 right-6 text-[10px] font-bold text-emerald-400 animate-coin-float select-none"
        >
          ✨
        </span>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-md shadow-emerald-500/40">
          <Coins className="h-4 w-4" />
        </div>

        <div className="flex items-center gap-1.5 text-xs sm:text-sm font-bold min-w-0">
          <span className="text-emerald-400 dark:text-emerald-600 shrink-0">Cha-ching!</span>
          <span className="font-extrabold shrink-0">{formatSGD(activeExpense.amount)}</span>
          <span className="text-slate-300 dark:text-slate-600 shrink-0">•</span>
          <span className="truncate max-w-[100px] sm:max-w-[180px] text-slate-200 dark:text-slate-700 font-medium">
            {activeExpense.item}
          </span>
          <Sparkles className="h-3.5 w-3.5 text-amber-400 shrink-0 ml-0.5" />
        </div>
      </div>
    </div>
  );
}

export default ExpenseSuccessCelebration;
