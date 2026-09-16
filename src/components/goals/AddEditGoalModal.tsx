/**
 * AddEditGoalModal Component
 * Accessible dialog for creating or updating a savings milestone goal.
 * Features:
 * - Emoji picker preset chips & custom emoji input
 * - Title, Target Amount, Saved So Far, Target Date, Monthly Contribution inputs
 * - Live pacing calculator preview (Required pace & status indicator)
 * - Error alerts and accessible form controls
 * - Dual mode: addGoal or updateGoal via financeService
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X, Target, AlertCircle, TrendingUp } from 'lucide-react';
import { financeService } from '../../services/financeService';
import { calculateGoalPacing } from '../../lib/financialFormulas';
import { formatSGD } from '../../lib/currency';
import type { SavingsGoal, CreateGoalInput } from '../../types/finance';

export interface AddEditGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal?: SavingsGoal | null;
  onGoalSaved?: (goal: SavingsGoal) => void;
  householdId?: string;
}

export const EMOJI_PRESETS = [
  { emoji: '💍', label: 'Wedding' },
  { emoji: '🏖️', label: 'Honeymoon' },
  { emoji: '🏠', label: 'HDB Down Payment' },
  { emoji: '🔨', label: 'Renovation' },
  { emoji: '🍼', label: 'Baby Fund' },
  { emoji: '✈️', label: 'Vacation' },
  { emoji: '🚗', label: 'Car' },
  { emoji: '🛡️', label: 'Emergency Fund' },
  { emoji: '🎯', label: 'Other Goal' },
];

export function AddEditGoalModal({
  isOpen,
  onClose,
  goal,
  onGoalSaved,
  householdId,
}: AddEditGoalModalProps) {
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [emoji, setEmoji] = useState<string>('🎯');
  const [title, setTitle] = useState<string>('');
  const [targetAmount, setTargetAmount] = useState<string>('');
  const [savedSoFar, setSavedSoFar] = useState<string>('0');
  const [targetDate, setTargetDate] = useState<string>('');
  const [monthlyContribution, setMonthlyContribution] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset or populate state whenever isOpen or goal changes
  useEffect(() => {
    if (isOpen) {
      if (goal) {
        setEmoji(goal.emoji || '🎯');
        setTitle(goal.title);
        setTargetAmount(goal.target_amount.toString());
        setSavedSoFar(goal.saved_so_far.toString());
        // Handle YYYY-MM or YYYY-MM-DD
        const d = goal.target_date;
        setTargetDate(d.length === 7 ? `${d}-01` : d);
        setMonthlyContribution(goal.monthly_contribution.toString());
      } else {
        setEmoji('🎯');
        setTitle('');
        setTargetAmount('');
        setSavedSoFar('0');
        // Default target date to 1 year ahead
        const oneYearAhead = new Date();
        oneYearAhead.setFullYear(oneYearAhead.getFullYear() + 1);
        setTargetDate(oneYearAhead.toISOString().slice(0, 10));
        setMonthlyContribution('0');
      }
      setErrorMessage(null);
      setIsSubmitting(false);

      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, goal]);

  // Handle ESC key to dismiss modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Live Pacing Preview Calculation
  const numericTarget = parseFloat(targetAmount) || 0;
  const numericSaved = parseFloat(savedSoFar) || 0;
  const numericMonthly = parseFloat(monthlyContribution) || 0;

  const livePacing = numericTarget > 0 && targetDate
    ? calculateGoalPacing(numericTarget, numericSaved, targetDate, numericMonthly)
    : null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please enter a goal title');
      titleInputRef.current?.focus();
      return;
    }

    if (isNaN(numericTarget) || numericTarget <= 0) {
      setErrorMessage('Please enter a valid target amount greater than S$0.00');
      return;
    }

    if (isNaN(numericSaved) || numericSaved < 0) {
      setErrorMessage('Saved amount cannot be negative');
      return;
    }

    if (!targetDate) {
      setErrorMessage('Please select a target completion date');
      return;
    }

    if (isNaN(numericMonthly) || numericMonthly < 0) {
      setErrorMessage('Monthly contribution cannot be negative');
      return;
    }

    try {
      setIsSubmitting(true);

      // Ensure normalized date string
      const normalizedDate = targetDate.length === 7 ? `${targetDate}-01` : targetDate;

      if (goal) {
        // Edit Mode
        const updated = await financeService.updateGoal(goal.id, {
          emoji: emoji || '🎯',
          title: title.trim(),
          target_amount: numericTarget,
          saved_so_far: numericSaved,
          target_date: normalizedDate,
          monthly_contribution: numericMonthly,
        });
        onGoalSaved?.(updated);
      } else {
        // Create Mode
        const input: CreateGoalInput = {
          household_id: householdId,
          emoji: emoji || '🎯',
          title: title.trim(),
          target_amount: numericTarget,
          saved_so_far: numericSaved,
          target_date: normalizedDate,
          monthly_contribution: numericMonthly,
        };
        const created = await financeService.addGoal(input);
        onGoalSaved?.(created);
      }

      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save savings goal');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="goal-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl transition-all dark:bg-slate-900 dark:border dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <h2 id="goal-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                {goal ? 'Edit Savings Goal' : 'New Savings Goal'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track couple milestones, target dates, and monthly savings pace
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Emoji Presets & Custom Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Goal Icon / Emoji
            </label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {EMOJI_PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  aria-label={p.label}
                  onClick={() => setEmoji(p.emoji)}
                  className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-medium transition-all ${
                    emoji === p.emoji
                      ? 'bg-blue-600 text-white shadow-xs ring-2 ring-blue-600/30'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <span className="text-sm">{p.emoji}</span>
                  <span className="text-[11px]">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label="Custom Emoji"
                value={emoji}
                onChange={(e) => setEmoji(e.target.value)}
                maxLength={4}
                className="w-16 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-center text-lg focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
              <span className="text-xs text-slate-400">or type any custom emoji</span>
            </div>
          </div>

          {/* Goal Title */}
          <div>
            <label htmlFor="goal-title-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Goal Title <span className="text-rose-500">*</span>
            </label>
            <input
              id="goal-title-input"
              ref={titleInputRef}
              type="text"
              aria-label="Goal Title"
              placeholder="e.g. HDB Down Payment, Wedding, Baby Fund"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* Amounts Grid: Target & Saved */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="goal-target-amount" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Amount (S$) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  S$
                </span>
                <input
                  id="goal-target-amount"
                  type="number"
                  step="any"
                  min="0.01"
                  aria-label="Target Amount"
                  placeholder="50,000"
                  value={targetAmount}
                  onChange={(e) => setTargetAmount(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="goal-saved-so-far" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Saved So Far (S$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  S$
                </span>
                <input
                  id="goal-saved-so-far"
                  type="number"
                  step="any"
                  min="0"
                  aria-label="Saved So Far"
                  placeholder="0"
                  value={savedSoFar}
                  onChange={(e) => setSavedSoFar(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Target Date & Monthly Contribution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="goal-target-date" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Date <span className="text-rose-500">*</span>
              </label>
              <input
                id="goal-target-date"
                type="date"
                aria-label="Target Date"
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-medium text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="goal-monthly-contribution" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Monthly Contribution (S$)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  S$
                </span>
                <input
                  id="goal-monthly-contribution"
                  type="number"
                  step="any"
                  min="0"
                  aria-label="Monthly Contribution"
                  placeholder="500"
                  value={monthlyContribution}
                  onChange={(e) => setMonthlyContribution(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3.5 py-2 text-sm font-semibold text-slate-800 focus:border-blue-500 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Live Pacing Preview */}
          {livePacing && (
            <div className="rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/60">
              <div className="flex items-center justify-between font-semibold text-slate-700 dark:text-slate-200">
                <span className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                  Pacing Projection
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    livePacing.status === 'achieved'
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-400'
                      : livePacing.status === 'on_track'
                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-400'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-400'
                  }`}
                >
                  {livePacing.status === 'achieved'
                    ? 'Achieved'
                    : livePacing.status === 'on_track'
                    ? 'On Track'
                    : 'Behind'}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-slate-600 dark:text-slate-300">
                <div>
                  <span className="text-[11px] text-slate-400 block">Required Pace:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {livePacing.status === 'achieved' ? 'Complete' : `${formatSGD(livePacing.neededPerMonth)}/mo`}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] text-slate-400 block">Time to Target:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">
                    {livePacing.monthsRemaining} months
                  </span>
                </div>
              </div>
            </div>
          )}

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
              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Saving...' : goal ? 'Save Changes' : 'Create Goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
