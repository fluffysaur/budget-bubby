/**
 * UpdateBalanceModal Component
 * Fast modal for instant balance updates:
 * - Pre-populated with current balance, institution, and existing notes
 * - Singapore context date picker (default today)
 * - Numeric balance input with SGD currency badge
 * - Invokes financeService.updateAccountBalance to record date-stamped snapshot
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  FileText,
} from 'lucide-react';
import type { Account } from '../../types/finance';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { getTodayDateString } from '../../lib/dateUtils';

export interface UpdateBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onBalanceUpdated?: (updatedAccount: Account) => void;
}

export function UpdateBalanceModal({
  isOpen,
  onClose,
  account,
  onBalanceUpdated,
}: UpdateBalanceModalProps) {
  const [balance, setBalance] = useState<string>('');
  const [date, setDate] = useState<string>(getTodayDateString());
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when account or open status changes
  useEffect(() => {
    if (account && isOpen) {
      setBalance(account.balance.toString());
      setDate(getTodayDateString());
      setNotes(account.notes || '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [account, isOpen]);

  // Handle escape key dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !account) {
    return null;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedBalance = parseFloat(balance);

    if (isNaN(parsedBalance)) {
      setError('Please enter a valid numeric balance');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const trimmedNotes = notes.trim();
      const updatedAccount = await financeService.updateAccountBalance(
        account.id,
        parsedBalance,
        trimmedNotes,
        date || getTodayDateString()
      );

      onBalanceUpdated?.(updatedAccount);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update account balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <h2 id="modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
              Update Account Balance
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {account.name} {account.institution ? `(${account.institution})` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Current Balance Reference */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Current Balance
            </span>
            <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
              {formatSGD(account.balance)}
            </span>
          </div>

          {/* New Balance Input */}
          <div>
            <label
              htmlFor="new-balance"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
            >
              New Balance (SGD)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-semibold text-sm">
                S$
              </div>
              <input
                id="new-balance"
                type="number"
                step="0.01"
                autoFocus
                required
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Snapshot Date Input */}
          <div>
            <label
              htmlFor="snapshot-date"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
            >
              Snapshot Date (Singapore Time)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Calendar className="h-4 w-4" />
              </div>
              <input
                id="snapshot-date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Optional Notes Input */}
          <div>
            <label
              htmlFor="account-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2"
            >
              Notes / Remarks (Optional)
            </label>
            <div className="relative">
              <div className="absolute top-3 left-3 pointer-events-none text-slate-400">
                <FileText className="h-4 w-4" />
              </div>
              <textarea
                id="account-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Monthly salary credited, interest credited"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500 resize-none"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-md shadow-emerald-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Save Balance</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default UpdateBalanceModal;
