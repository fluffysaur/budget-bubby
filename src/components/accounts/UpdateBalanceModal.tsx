/**
 * UpdateBalanceModal Component
 * Supports both:
 * 1. Fast single-account balance update (when `account` is provided)
 * 2. Multi-account selection and batch balance update (when `accounts` list is provided)
 * 3. Empty state with "+ Add Account" action when 0 accounts exist
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Calendar,
  FileText,
  Landmark,
  Plus,
  Check,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import type { Account, BulkBalanceUpdateItem } from '../../types/finance';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { getTodayDateString } from '../../lib/dateUtils';

export interface UpdateBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  account?: Account | null;
  accounts?: Account[];
  onBalanceUpdated?: (updatedAccount: Account) => void;
  onBalancesUpdated?: (updatedAccounts: Account[]) => void;
  onOpenAddAccount?: () => void;
}

export function UpdateBalanceModal({
  isOpen,
  onClose,
  account,
  accounts,
  onBalanceUpdated,
  onBalancesUpdated,
  onOpenAddAccount,
}: UpdateBalanceModalProps) {
  const accountsList = accounts || [];

  // Common states
  const [date, setDate] = useState<string>(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Single-account state
  const [singleBalance, setSingleBalance] = useState<string>('');
  const [singleNotes, setSingleNotes] = useState<string>('');

  // Multi-account states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [balancesMap, setBalancesMap] = useState<Record<string, string>>({});
  const [notesMap, setNotesMap] = useState<Record<string, string>>({});
  const [typeFilter, setTypeFilter] = useState<'All' | 'Cash' | 'Investment' | 'CPF'>('All');

  const isMultiMode = !account;

  // Initialize state when modal opens or target changes
  useEffect(() => {
    if (!isOpen) return;

    setDate(getTodayDateString());
    setError(null);
    setIsSubmitting(false);

    if (account) {
      // Single-account setup
      setSingleBalance(account.balance.toString());
      setSingleNotes(account.notes || '');
    } else if (accountsList.length > 0) {
      // Multi-account setup: default select all
      const allIds = new Set(accountsList.map((a) => a.id));
      setSelectedIds(allIds);

      const bMap: Record<string, string> = {};
      const nMap: Record<string, string> = {};
      accountsList.forEach((a) => {
        bMap[a.id] = a.balance.toString();
        nMap[a.id] = a.notes || '';
      });
      setBalancesMap(bMap);
      setNotesMap(nMap);
    }
  }, [isOpen, account?.id, account?.balance, accountsList.length]);

  // Handle escape key dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Filtered accounts for multi-mode
  const filteredAccounts = useMemo(() => {
    if (typeFilter === 'All') return accountsList;
    return accountsList.filter((a) => a.type === typeFilter);
  }, [accountsList, typeFilter]);

  if (!isOpen) return null;

  // Handle 0 accounts empty state in multi-mode
  if (isMultiMode && accountsList.length === 0) {
    if (!onOpenAddAccount) return null;
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="empty-balance-title"
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      >
        <div
          className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden p-6 text-center animate-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex h-14 w-14 mx-auto items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400 mb-4">
            <Landmark className="h-7 w-7" />
          </div>
          <h2 id="empty-balance-title" className="text-lg font-bold text-slate-900 dark:text-white mb-1">
            No Accounts Found
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-6 max-w-xs mx-auto leading-relaxed">
            There are no accounts configured in this perspective yet. Create your first Singapore bank, CPF, or investment account to track balances.
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddAccount?.();
              }}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-95 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Add First Account</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- Handlers for Single Mode ---
  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account) return;

    const parsedBalance = parseFloat(singleBalance);
    if (isNaN(parsedBalance)) {
      setError('Please enter a valid numeric balance');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const trimmedNotes = singleNotes.trim();
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

  // --- Handlers for Multi Mode ---
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredAccounts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAccounts.map((a) => a.id)));
    }
  };

  const handleToggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedIds.size === 0) {
      setError('Please select at least one account to update');
      return;
    }

    const updates: BulkBalanceUpdateItem[] = [];
    for (const acc of accountsList) {
      if (!selectedIds.has(acc.id)) continue;

      const rawVal = balancesMap[acc.id];
      const parsed = parseFloat(rawVal);
      if (isNaN(parsed)) {
        setError(`Invalid balance for ${acc.name}. Please enter numbers only.`);
        return;
      }

      updates.push({
        accountId: acc.id,
        balance: parsed,
        newBalance: parsed,
        notes: notesMap[acc.id]?.trim() || undefined,
      });
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const snapshotDate = date || getTodayDateString();
      const updatedAccounts = await financeService.bulkUpdateAccountBalances(updates, snapshotDate);

      onBalancesUpdated?.(updatedAccounts);
      if (updatedAccounts.length > 0) {
        onBalanceUpdated?.(updatedAccounts[0]);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update balances');
    } finally {
      setIsSubmitting(false);
    }
  };

  // RENDER: Single Account Mode
  if (account) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="single-modal-title"
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
              <h2 id="single-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">
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
          <form onSubmit={handleSingleSubmit} className="p-6 space-y-4">
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
                New Balance (SGD) *
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
                  value={singleBalance}
                  onChange={(e) => setSingleBalance(e.target.value)}
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
                  value={singleNotes}
                  onChange={(e) => setSingleNotes(e.target.value)}
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

  // RENDER: Multi-Account Selection Mode
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="multi-modal-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        className="w-full max-w-2xl my-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 id="multi-modal-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Update Account Balances
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select accounts to update and record balance snapshots
              </p>
            </div>
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

        {/* Toolbar: Category Filters & Snapshot Date */}
        <div className="px-6 py-3 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {(['All', 'Cash', 'Investment', 'CPF'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTypeFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  typeFilter === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="multi-snapshot-date" className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Date:
            </label>
            <input
              id="multi-snapshot-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Selection summary & Select All */}
        <div className="px-6 py-2.5 bg-slate-100/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <span className="font-semibold text-slate-600 dark:text-slate-300">
            {selectedIds.size} of {filteredAccounts.length} account{filteredAccounts.length === 1 ? '' : 's'} selected
          </span>
          <button
            type="button"
            onClick={handleToggleSelectAll}
            className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer"
          >
            {selectedIds.size === filteredAccounts.length ? 'Deselect All' : 'Select All'}
          </button>
        </div>

        {/* Form Body: Account Selection List */}
        <form onSubmit={handleMultiSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {filteredAccounts.map((acc) => {
            const isChecked = selectedIds.has(acc.id);
            const currentVal = acc.balance;
            const enteredVal = parseFloat(balancesMap[acc.id] || '0');
            const diff = !isNaN(enteredVal) ? Math.round((enteredVal - currentVal) * 100) / 100 : 0;

            return (
              <div
                key={acc.id}
                className={`p-3.5 rounded-xl border transition-all ${
                  isChecked
                    ? 'border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/20 dark:bg-emerald-950/20'
                    : 'border-slate-200/80 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40 opacity-70'
                }`}
              >
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      id={`chk-${acc.id}`}
                      checked={isChecked}
                      onChange={() => handleToggleAccount(acc.id)}
                      className="h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <label htmlFor={`chk-${acc.id}`} className="min-w-0 cursor-pointer select-none">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </span>
                        {acc.is_joint && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            Joint
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-400">
                          {acc.institution || acc.type}
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-400 block">Current:</span>
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {formatSGD(acc.balance)}
                    </span>
                  </div>
                </div>

                {isChecked && (
                  <div className="mt-2.5 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-center">
                    <div className="sm:col-span-5 relative">
                      <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-bold text-xs">
                        S$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={balancesMap[acc.id] ?? ''}
                        onChange={(e) =>
                          setBalancesMap((prev) => ({ ...prev, [acc.id]: e.target.value }))
                        }
                        placeholder="0.00"
                        className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs sm:text-sm font-bold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>

                    <div className="sm:col-span-3 flex items-center text-xs">
                      {diff > 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-emerald-600 dark:text-emerald-400">
                          <ArrowUpRight className="h-3.5 w-3.5" />
                          +{formatSGD(diff)}
                        </span>
                      ) : diff < 0 ? (
                        <span className="inline-flex items-center gap-0.5 font-bold text-rose-600 dark:text-rose-400">
                          <ArrowDownRight className="h-3.5 w-3.5" />
                          {formatSGD(diff)}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-0.5 text-slate-400">
                          <Minus className="h-3.5 w-3.5" />
                          Unchanged
                        </span>
                      )}
                    </div>

                    <div className="sm:col-span-4">
                      <input
                        type="text"
                        value={notesMap[acc.id] ?? ''}
                        onChange={(e) =>
                          setNotesMap((prev) => ({ ...prev, [acc.id]: e.target.value }))
                        }
                        placeholder="Notes (optional)"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleMultiSubmit}
            disabled={isSubmitting || selectedIds.size === 0}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-95 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving Balances...</span>
              </>
            ) : (
              <>
                <Check className="h-4 w-4 stroke-[2.5]" />
                <span>Save {selectedIds.size} Balance{selectedIds.size === 1 ? '' : 's'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default UpdateBalanceModal;
