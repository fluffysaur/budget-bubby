/**
 * QuickDepositModal Component
 * Accessible dialog to quickly deposit funds into a savings goal.
 * Features:
 * - Quick preset chips (+S$100, +S$500, +S$1,000, +S$5,000)
 * - Custom numeric deposit input
 * - Live preview of updated balance and new progress %
 * - Updates goal saved_so_far via financeService.updateGoal
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X, Coins, AlertCircle } from 'lucide-react';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import type { SavingsGoal } from '../../types/finance';

export interface QuickDepositModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: SavingsGoal | null;
  onDepositSaved?: (updatedGoal: SavingsGoal) => void;
}

const DEPOSIT_PRESETS = [100, 250, 500, 1000, 5000];

export function QuickDepositModal({
  isOpen,
  onClose,
  goal,
  onDepositSaved,
}: QuickDepositModalProps) {
  const depositInputRef = useRef<HTMLInputElement>(null);

  const [depositAmount, setDepositAmount] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDepositAmount('');
      setErrorMessage(null);
      setIsSubmitting(false);

      const timer = setTimeout(() => {
        depositInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, goal]);

  // Handle ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !goal) return null;

  const numericDeposit = parseFloat(depositAmount) || 0;
  const newSavedSoFar = goal.saved_so_far + numericDeposit;
  const newProgressPercent = goal.target_amount > 0
    ? Math.min(100, Math.round((newSavedSoFar / goal.target_amount) * 100))
    : 0;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (isNaN(numericDeposit) || numericDeposit <= 0) {
      setErrorMessage('Please enter a deposit amount greater than S$0.00');
      depositInputRef.current?.focus();
      return;
    }

    try {
      setIsSubmitting(true);
      const updated = await financeService.updateGoal(goal.id, {
        saved_so_far: Math.round(newSavedSoFar * 100) / 100,
      });
      onDepositSaved?.(updated);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to process deposit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="deposit-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 dark:border dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 id="deposit-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Quick Deposit
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                <span>{goal.emoji}</span>
                <span className="font-semibold">{goal.title}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-500" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Quick Preset Buttons */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Quick Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {DEPOSIT_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setDepositAmount(amount.toString())}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950/30 dark:hover:text-emerald-400 transition-all"
                >
                  +{formatSGD(amount)}
                </button>
              ))}
            </div>
          </div>

          {/* Deposit Amount Input */}
          <div>
            <label htmlFor="quick-deposit-amount" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Deposit Amount (S$) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                S$
              </span>
              <input
                id="quick-deposit-amount"
                ref={depositInputRef}
                type="number"
                step="any"
                min="0.01"
                required
                aria-label="Deposit Amount"
                placeholder="500.00"
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2.5 text-sm font-semibold text-slate-800 focus:border-emerald-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* Balance Preview */}
          <div className="rounded-xl bg-slate-50 p-3 text-xs border border-slate-100 dark:bg-slate-800/60 dark:border-slate-800">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1">
              <span>Current Saved:</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{formatSGD(goal.saved_so_far)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-1.5">
              <span>New Saved Total:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatSGD(newSavedSoFar)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 border-t border-slate-200/60 pt-1.5 dark:border-slate-700/60">
              <span>New Progress:</span>
              <span className="font-bold text-slate-800 dark:text-slate-200">{newProgressPercent}%</span>
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 focus:outline-hidden focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Depositing...' : 'Confirm Deposit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
