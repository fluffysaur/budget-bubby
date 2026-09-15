/**
 * Quick Add Expense Modal
 * Fast, mobile-optimized modal with:
 * - Large numeric amount input (auto-focused)
 * - Category chips
 * - Payer toggle (Yi Jia / Rachel)
 * - Shared (50/50) split toggle
 * - Merchant/Item description
 * - Date picker (defaults to today)
 * - Remarks / notes field
 * - Dual-mode financeService persistence
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { X, Plus } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { financeService } from '../../services/financeService';
import { getTodayDateString } from '../../lib/dateUtils';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { Category, HouseholdMember, Expense, CreateExpenseInput } from '../../types/finance';

export interface QuickAddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded?: (expense: Expense) => void;
  defaultPayerId?: string;
  categories?: Category[];
  members?: HouseholdMember[];
}

export function QuickAddExpenseModal({
  isOpen,
  onClose,
  onExpenseAdded,
  defaultPayerId,
  categories: propCategories,
  members: propMembers,
}: QuickAddExpenseModalProps) {
  const { members: ctxMembers, activeMember } = useHousehold();
  const members = propMembers && propMembers.length > 0
    ? propMembers
    : ctxMembers && ctxMembers.length > 0
    ? ctxMembers
    : mockMembers;

  const categories = propCategories && propCategories.length > 0
    ? propCategories
    : mockCategories;

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [amount, setAmount] = useState<string>('');
  const [item, setItem] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || '');
  const [payerId, setPayerId] = useState<string>(() => {
    if (defaultPayerId) return defaultPayerId;
    if (activeMember) return activeMember.id;
    return members[0]?.id || '';
  });
  const [isShared, setIsShared] = useState<boolean>(true);
  const [date, setDate] = useState<string>(getTodayDateString());
  const [remarks, setRemarks] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form and focus on open
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setItem('');
      setCategoryId(categories[0]?.id || '');
      setPayerId(defaultPayerId || (activeMember ? activeMember.id : members[0]?.id || ''));
      setIsShared(true);
      setDate(getTodayDateString());
      setRemarks('');
      setErrorMessage(null);
      setIsSubmitting(false);

      // Auto-focus amount
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, defaultPayerId, activeMember, categories, members]);

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
      setErrorMessage('Please enter a description or merchant name');
      return;
    }

    try {
      setIsSubmitting(true);
      const input: CreateExpenseInput = {
        payer_id: payerId,
        category_id: categoryId || null,
        date: date || getTodayDateString(),
        item: item.trim(),
        amount: numericAmount,
        remarks: remarks.trim() ? remarks.trim() : null,
        is_shared: isShared,
        split_ratio: isShared ? 0.5 : 0.0,
      };

      const created = await financeService.addExpense(input);
      onExpenseAdded?.(created);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </div>
            <div>
              <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
                Quick Add Expense
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Log day-to-day spending with automatic 50/50 split
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
          <div className="mt-4 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Large Amount Input */}
          <div>
            <label
              htmlFor="expense-amount"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Amount (S$)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 select-none">
                S$
              </span>
              <input
                ref={amountInputRef}
                id="expense-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 py-3 pl-14 sm:pl-16 pr-4 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 transition-colors placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
              />
            </div>
          </div>

          {/* Item / Merchant */}
          <div>
            <label
              htmlFor="expense-item"
              className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Item / Description
            </label>
            <input
              id="expense-item"
              type="text"
              placeholder="e.g., FairPrice Groceries, Din Tai Fung, Grab"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
            />
          </div>

          {/* Category Chips */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Category
            </span>
            <div className="flex flex-wrap gap-1.5" aria-label="Category Selection">
              {categories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 font-semibold ring-2 ring-emerald-600/30'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: isSelected ? '#ffffff' : cat.color || '#10B981' }}
                    />
                    <span>{cat.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Payer Toggle */}
          <div>
            <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">
              Paid By
            </span>
            <div className="grid grid-cols-2 gap-2" aria-label="Payer Selection">
              {members.map((member) => {
                const isSelected = payerId === member.id;
                return (
                  <button
                    key={member.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setPayerId(member.id)}
                    className={`flex items-center justify-center gap-2 rounded-xl border p-2.5 text-xs font-semibold transition-all ${
                      isSelected
                        ? 'border-emerald-600 bg-emerald-50/80 text-emerald-800 shadow-xs dark:border-emerald-500 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700/50'
                    }`}
                  >
                    <span className="text-base">{member.avatar_url || '👤'}</span>
                    <span>{member.display_name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Shared 50/50 Toggle */}
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex flex-col">
              <label
                htmlFor="expense-shared-toggle"
                className="text-xs font-semibold text-slate-800 dark:text-slate-200 cursor-pointer"
              >
                Shared (50/50) Expense
              </label>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {isShared
                  ? 'Split equally between Yi Jia & Rachel (unsettled ledger)'
                  : 'Personal expense (paid solely for yourself)'}
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                id="expense-shared-toggle"
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-600 dark:bg-slate-700 peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          {/* Date & Remarks Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="expense-date"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
              >
                Date
              </label>
              <input
                id="expense-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
            <div>
              <label
                htmlFor="expense-remarks"
                className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
              >
                Remarks / Notes
              </label>
              <input
                id="expense-remarks"
                type="text"
                placeholder="Optional notes..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />
            </div>
          </div>

          {/* Submit Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-600 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSubmitting ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Plus className="h-4 w-4 stroke-[2.5]" />
                  <span>Add Expense</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default QuickAddExpenseModal;
