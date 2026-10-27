/**
 * SpendFromGoalModal Component
 * Quick spend logger with goal_id pre-selected:
 * - Deducts from the goal's sinking fund balance
 * - Automatically tags the transaction with the goal's title
 * - Excludes the spend from normal monthly category spendable caps
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { ShoppingBag, X, Calendar, DollarSign, Tag, User, Layers } from 'lucide-react';
import { AnimatedModal } from '../ui/AnimatedModal';
import { Button } from '../ui/Button';
import { financeService } from '../../services/financeService';
import { getTodayDateString } from '../../lib/dateUtils';
import { formatSGD } from '../../lib/currency';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { SavingsGoal, Category, HouseholdMember, CreateExpenseInput } from '../../types/finance';

export interface SpendFromGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: SavingsGoal | null;
  categories?: Category[];
  members?: HouseholdMember[];
  defaultPayerId?: string;
  onSpendSaved?: () => void;
}

export function SpendFromGoalModal({
  isOpen,
  onClose,
  goal,
  categories = mockCategories,
  members = mockMembers,
  defaultPayerId,
  onSpendSaved,
}: SpendFromGoalModalProps) {
  const amountInputRef = useRef<HTMLInputElement>(null);

  const [amount, setAmount] = useState<string>('');
  const [item, setItem] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [payerId, setPayerId] = useState<string>(defaultPayerId || members[0]?.id || '');
  const [isShared, setIsShared] = useState<boolean>(true);
  const [date, setDate] = useState<string>(getTodayDateString());
  const [remarks, setRemarks] = useState<string>('');
  const [extraTag, setExtraTag] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && goal) {
      setAmount('');
      setItem('');
      setCategoryId(categories[0]?.id || '');
      setPayerId(defaultPayerId || members[0]?.id || '');
      setIsShared(true);
      setDate(getTodayDateString());
      setRemarks('');
      setExtraTag('');
      setErrorMessage(null);
      setIsSubmitting(false);

      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, goal, categories, members, defaultPayerId]);

  if (!goal) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Please enter a valid expense amount greater than S$0.00');
      amountInputRef.current?.focus();
      return;
    }

    if (!item.trim()) {
      setErrorMessage('Please enter an expense description (e.g. Banquet Deposit, Wedding Bands)');
      return;
    }

    // Prepare tags: automatically include the goal's title
    const tags = [goal.title];
    if (extraTag.trim()) {
      tags.push(extraTag.trim());
    }

    try {
      setIsSubmitting(true);
      const input: CreateExpenseInput = {
        payer_id: payerId,
        category_id: categoryId || null,
        date: date || getTodayDateString(),
        item: item.trim(),
        amount: Math.round(numericAmount * 100) / 100,
        remarks: remarks.trim() ? remarks.trim() : `Funded by goal: ${goal.title}`,
        is_shared: isShared,
        split_ratio: isShared ? 0.5 : 0.0,
        goal_id: goal.id,
        tags,
      };

      await financeService.addExpense(input);
      onSpendSaved?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save goal-funded spend');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden" data-testid="spend-from-goal-modal">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-50 text-2xl shadow-xs dark:bg-purple-950/50">
              {goal.emoji || '🎯'}
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                <span>Spend from {goal.title}</span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Current fund balance: <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatSGD(goal.saved_so_far)}</span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Notice Banner */}
        <div className="bg-purple-50/70 dark:bg-purple-950/30 px-5 py-2.5 border-b border-purple-100 dark:border-purple-900/40 text-[11px] text-purple-700 dark:text-purple-300 flex items-center gap-2">
          <ShoppingBag className="h-4 w-4 shrink-0 text-purple-600" />
          <span>This spend will deduct from your sinking fund without affecting monthly category budgets.</span>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                {errorMessage}
              </div>
            )}

            {/* Amount Input */}
            <div>
              <label htmlFor="spend-amount" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                <span>Amount to Spend (SGD) *</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-base font-bold text-slate-400">S$</span>
                <input
                  id="spend-amount"
                  ref={amountInputRef}
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 py-2.5 text-lg font-bold text-slate-900 focus:border-purple-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Item / Description */}
            <div>
              <label htmlFor="spend-item" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Item / Description *
              </label>
              <input
                id="spend-item"
                type="text"
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder={`e.g. ${goal.title} deposit / vendor invoice`}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-purple-500 focus:outline-hidden focus:ring-2 focus:ring-purple-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>

            {/* Category & Payer */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="spend-category" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Layers className="h-3.5 w-3.5 text-slate-400" />
                  <span>Category</span>
                </label>
                <select
                  id="spend-category"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="spend-payer" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Payer</span>
                </label>
                <select
                  id="spend-payer"
                  value={payerId}
                  onChange={(e) => setPayerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Date & Shared Toggle */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="spend-date" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Date</span>
                </label>
                <input
                  id="spend-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Split Type
                </label>
                <button
                  type="button"
                  onClick={() => setIsShared((prev) => !prev)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                    isShared
                      ? 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800'
                      : 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                  }`}
                >
                  {isShared ? 'Shared (50/50)' : 'Personal'}
                </button>
              </div>
            </div>

            {/* Tag Preview */}
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Spend Tag</span>
              </label>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-800 shrink-0">
                  #{goal.title}
                </span>
                <input
                  type="text"
                  value={extraTag}
                  onChange={(e) => setExtraTag(e.target.value)}
                  placeholder="Additional tag (optional)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-purple-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Logging Spend...' : 'Log & Deduct from Goal'}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
}
