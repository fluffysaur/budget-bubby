/**
 * Quick Add Expense Modal
 * Fast, mobile-optimized modal with:
 * - AnimatedModal wrapper (drawer slide on mobile, scale on desktop)
 * - Ultra-minimal layout without verbose copy
 * - Large numeric amount input
 * - Category chips
 * - Contextual 1-tap quick tags
 * - Inline Payer & Shared 50/50 toggle
 * - Compact Date & Note toggle
 */

import { useState, useEffect, useRef, useMemo, type FormEvent } from 'react';
import { X, Plus, Calendar, MessageSquarePlus, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { financeService } from '../../services/financeService';
import { getTodayDateString } from '../../lib/dateUtils';
import { isSpendableCategory } from '../../lib/financialFormulas';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { Category, HouseholdMember, Expense, CreateExpenseInput } from '../../types/finance';
import { AnimatedModal } from '../ui/AnimatedModal';

export interface QuickAddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onExpenseAdded?: (expense: Expense) => void;
  defaultPayerId?: string;
  defaultShared?: boolean;
  categories?: Category[];
  members?: HouseholdMember[];
}

const QUICK_TAGS_BY_CATEGORY: Record<string, string[]> = {
  food: ['Lunch', 'Dinner', 'Coffee', 'Groceries', 'Hawker', 'Breakfast'],
  transport: ['MRT / Bus', 'Grab', 'Gojek', 'Taxi', 'Parking'],
  lifestyle: ['Shopping', 'Date Night', 'Coffee & Cake', 'Personal Care', 'Gifts'],
  buffer: ['Clinic / Pharmacy', 'Household Items', 'Utilities', 'Repair / Misc'],
};

const DEFAULT_QUICK_TAGS = ['Lunch', 'Dinner', 'Coffee', 'Groceries', 'MRT / Bus', 'Grab'];

function getQuickTagsForCategory(categoryName?: string): string[] {
  if (!categoryName) return DEFAULT_QUICK_TAGS;
  const normalized = categoryName.trim().toLowerCase();
  return QUICK_TAGS_BY_CATEGORY[normalized] || DEFAULT_QUICK_TAGS;
}

export function QuickAddExpenseModal({
  isOpen,
  onClose,
  onExpenseAdded,
  defaultPayerId,
  defaultShared,
  categories: propCategories,
  members: propMembers,
}: QuickAddExpenseModalProps) {
  const { members: ctxMembers, activeMember, perspective } = useHousehold();
  const members = propMembers && propMembers.length > 0
    ? propMembers
    : ctxMembers && ctxMembers.length > 0
    ? ctxMembers
    : mockMembers;

  const categories = propCategories && propCategories.length > 0
    ? propCategories
    : mockCategories;

  const spendableCategories = useMemo(
    () => categories.filter((c) => isSpendableCategory(c)),
    [categories]
  );
  const allocationCategories = useMemo(
    () => categories.filter((c) => !isSpendableCategory(c)),
    [categories]
  );

  const amountInputRef = useRef<HTMLInputElement>(null);

  // Default to Personal when in Personal perspective, or Shared when in Combined view (unless overridden)
  const resolvedDefaultShared =
    defaultShared !== undefined ? defaultShared : perspective === 'household';

  // Form State
  const [amount, setAmount] = useState<string>('');
  const [item, setItem] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(
    spendableCategories[0]?.id || categories[0]?.id || ''
  );
  const [showMoreCategories, setShowMoreCategories] = useState<boolean>(false);
  const [payerId, setPayerId] = useState<string>(() => {
    if (defaultPayerId) return defaultPayerId;
    if (activeMember) return activeMember.id;
    return members[0]?.id || '';
  });
  const [isShared, setIsShared] = useState<boolean>(resolvedDefaultShared);
  const [date, setDate] = useState<string>(getTodayDateString());
  const [remarks, setRemarks] = useState<string>('');
  const [showDateAndNotes, setShowDateAndNotes] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Reset form and focus on open
  useEffect(() => {
    if (isOpen) {
      setAmount('');
      setItem('');
      setCategoryId(spendableCategories[0]?.id || categories[0]?.id || '');
      setShowMoreCategories(false);
      setPayerId(defaultPayerId || (activeMember ? activeMember.id : members[0]?.id || ''));
      setIsShared(defaultShared !== undefined ? defaultShared : perspective === 'household');
      setDate(getTodayDateString());
      setRemarks('');
      setShowDateAndNotes(false);
      setErrorMessage(null);
      setIsSubmitting(false);

      // Auto-focus amount
      setTimeout(() => {
        amountInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen, defaultPayerId, defaultShared, activeMember, perspective, categories, spendableCategories, members]);

  const selectedCategory = categories.find((c) => c.id === categoryId);
  const quickTags = getQuickTagsForCategory(selectedCategory?.name);
  const visibleCategories = showMoreCategories
    ? categories
    : spendableCategories.length > 0
    ? spendableCategories
    : categories;

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
      setErrorMessage('Please select a quick tag or enter a description');
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
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isToday = date === getTodayDateString();

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
            <h2 id="modal-title" className="text-base font-bold text-slate-900 dark:text-white">
              Quick Add Expense
            </h2>
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

        {/* Form wrapping scrollable content and pinned footer */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
            {/* Error Alert */}
            {errorMessage && (
              <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Large Amount Input */}
          <div>
            <label
              htmlFor="expense-amount"
              className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Amount (S$)
            </label>
            <div className="relative flex items-center">
              <span className="absolute left-4 text-2xl font-bold text-emerald-600 dark:text-emerald-400 select-none">
                S$
              </span>
              <input
                ref={amountInputRef}
                id="expense-amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 py-2.5 pl-14 sm:pl-16 pr-4 text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 transition-colors placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
              />
            </div>
          </div>

          {/* Category Chips */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Category
              </span>
              {allocationCategories.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowMoreCategories((prev) => !prev)}
                  className="text-[11px] font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 cursor-pointer"
                >
                  {showMoreCategories ? 'Spendable only' : `+ More (${allocationCategories.length})`}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5" aria-label="Category Selection">
              {visibleCategories.map((cat) => {
                const isSelected = categoryId === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setCategoryId(cat.id)}
                    className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white shadow-xs dark:bg-emerald-500 font-semibold ring-2 ring-emerald-600/30'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 font-medium'
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

          {/* Quick Tags + Description */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="expense-item"
                className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
              >
                Item / Description
              </label>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-400 dark:text-slate-500">
                <Sparkles className="h-3 w-3 text-emerald-500" />
                Tap tag or type
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Quick Tags">
              {quickTags.map((tag) => {
                const isActiveTag = item.toLowerCase() === tag.toLowerCase();
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => setItem(tag)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all cursor-pointer ${
                      isActiveTag
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 font-semibold'
                        : 'bg-slate-50 text-slate-600 border border-slate-200/80 hover:bg-slate-100 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700'
                    }`}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>

            <input
              id="expense-item"
              type="text"
              placeholder="e.g., FairPrice Groceries, Grab, Lunch"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:focus:border-emerald-400"
            />
          </div>

          {/* Minimal Inline Payer & Shared Toggle */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 rounded-xl border border-slate-200/80 bg-slate-50/60 p-2.5 dark:border-slate-800 dark:bg-slate-800/40">
            {/* Payer Toggle */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                Payer:
              </span>
              <div className="flex gap-1" aria-label="Payer Selection">
                {members.map((member) => {
                  const isSelected = payerId === member.id;
                  return (
                    <button
                      key={member.id}
                      type="button"
                      aria-pressed={isSelected}
                      onClick={() => setPayerId(member.id)}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                      }`}
                    >
                      <span>{member.avatar_url || '👤'}</span>
                      <span>{member.display_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Split Toggle */}
            <div className="flex items-center justify-between sm:justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-200/60 dark:border-slate-700/60">
              <label
                htmlFor="expense-shared-toggle"
                className="text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
              >
                {isShared ? 'Shared (50/50)' : 'Personal'}
              </label>
              <input
                id="expense-shared-toggle"
                type="checkbox"
                aria-label="Shared"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="sr-only"
              />
              <button
                type="button"
                role="switch"
                aria-checked={isShared}
                onClick={() => setIsShared((prev) => !prev)}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isShared ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    isShared ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Compact Date & Notes Toggle */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-800/20 p-2.5">
            <button
              type="button"
              onClick={() => setShowDateAndNotes((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-semibold">
                  <Calendar className="h-3.5 w-3.5" />
                  {isToday ? 'Today' : date}
                </span>
                <span className="text-slate-300 dark:text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-slate-500 dark:text-slate-400 truncate max-w-[180px]">
                  <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
                  {remarks ? remarks : 'Add note / date'}
                </span>
              </span>
              {showDateAndNotes ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            <div className={`grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800 ${showDateAndNotes ? 'block' : 'sr-only'}`}>
              <div>
                <label
                  htmlFor="expense-date"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                >
                  Date
                </label>
                <input
                  id="expense-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label
                  htmlFor="expense-remarks"
                  className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                >
                  Remarks / Notes
                </label>
                <input
                  id="expense-remarks"
                  type="text"
                  placeholder="Optional..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Submit Actions Footer */}
          <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-500/20 hover:from-emerald-700 hover:to-teal-600 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
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
    </AnimatedModal>
  );
}

export default QuickAddExpenseModal;
