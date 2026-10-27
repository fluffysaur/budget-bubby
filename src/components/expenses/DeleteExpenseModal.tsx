/**
 * Delete Expense Confirmation Modal
 * Replaces inline confirmation with an explicit, high-clarity dialog:
 * - AnimatedModal wrapper
 * - Shows expense item name, formatted amounts (SGD & foreign currency)
 * - Highlights payer, category, and date
 * - Clear warning alerts if deletion restores a linked savings goal or impacts shared couple settlement
 * - Confirms deletion via financeService.deleteExpense(id)
 */

import { useState } from 'react';
import { Trash2, AlertTriangle, X, ArrowRightLeft, Target } from 'lucide-react';
import { AnimatedModal } from '../ui/AnimatedModal';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { formatForeignAmount } from '../../lib/currencyConverter';
import { formatDisplayDate } from '../../lib/dateUtils';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { Expense, Category, HouseholdMember } from '../../types/finance';

export interface DeleteExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  expense: Expense | null;
  onDeleted?: (deletedId: string) => void;
  categories?: Category[];
  members?: HouseholdMember[];
}

export function DeleteExpenseModal({
  isOpen,
  onClose,
  expense,
  onDeleted,
  categories = mockCategories,
  members = mockMembers,
}: DeleteExpenseModalProps) {
  const [isDeleting, setIsDeleting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!expense) return null;

  const category = categories.find((c) => c.id === expense.category_id);
  const payer = members.find((m) => m.id === expense.payer_id);
  const hasForeignCurrency =
    expense.original_currency &&
    expense.original_currency !== 'SGD' &&
    expense.original_amount !== undefined &&
    expense.original_amount !== null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setErrorMessage(null);
      onDeleted?.(expense.id);
      await financeService.deleteExpense(expense.id);
      onClose();
    } catch (err) {
      console.error('Failed to delete expense:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete expense.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatedModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="max-w-md"
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden"
    >
      <div className="p-6 space-y-5">
        {/* Header Icon & Title */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400">
              <Trash2 className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Delete Expense?
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                This transaction will be permanently removed.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label="Close modal"
            className="rounded-xl p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Expense Summary Card */}
        <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                {expense.item}
              </h3>
              {expense.remarks && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {expense.remarks}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="text-lg font-black text-slate-900 dark:text-white">
                {formatSGD(expense.amount)}
              </div>
              {hasForeignCurrency && (
                <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                  {formatForeignAmount(expense.original_amount!, expense.original_currency!)}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 text-xs">
            {/* Category */}
            {category && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: category.color || '#10B981' }}
                />
                <span>{category.name}</span>
              </span>
            )}

            {/* Payer */}
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200 shadow-2xs">
              <span>{payer?.avatar_url || '👤'}</span>
              <span>{payer?.display_name || 'Unknown'}</span>
            </span>

            {/* Date */}
            <span className="text-slate-500 dark:text-slate-400 font-medium">
              {formatDisplayDate(expense.date)}
            </span>
          </div>
        </div>

        {/* Warning Alerts */}
        <div className="space-y-2">
          {expense.goal_id && (
            <div className="flex items-start gap-2.5 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-900/40">
              <Target className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <span className="font-bold">Savings Goal Balance Restored:</span> Deleting this expense will return{' '}
                <span className="font-bold">{formatSGD(expense.amount)}</span> back to the linked savings goal balance.
              </div>
            </div>
          )}

          {expense.is_shared && (
            <div className="flex items-start gap-2.5 rounded-xl bg-blue-50 p-3 text-xs font-medium text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-200 dark:border-blue-900/40">
              <ArrowRightLeft className="h-4 w-4 shrink-0 mt-0.5 text-blue-600 dark:text-blue-400" />
              <div>
                <span className="font-bold">Couple Settlement Adjusted:</span> This was logged as a shared expense. Deleting it will recalculate who owes whom in the monthly summary.
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            aria-label={`Cancel delete ${expense.item}`}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            aria-label={`Confirm delete ${expense.item}`}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" />
            <span>{isDeleting ? 'Deleting...' : 'Delete Expense'}</span>
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

export default DeleteExpenseModal;
