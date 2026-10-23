/**
 * UpdateBalanceModal Component
 * Streamlined, search-enabled balance update modal:
 * - Supports single-account quick edit (when `account` is passed)
 * - Supports multi-account batch update with instant change-detection (no checkboxes required)
 * - Instant search filter + Category filter pills
 * - Only modified accounts are saved
 * - Smooth entry/exit animations via AnimatedModal
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  Search,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Landmark,
  Plus,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { Account, BulkBalanceUpdateItem } from '../../types/finance';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { getTodayDateString } from '../../lib/dateUtils';
import { AnimatedModal } from '../ui/AnimatedModal';

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
  const accountsList = useMemo(() => accounts || [], [accounts]);

  // Common states
  const [date, setDate] = useState<string>(getTodayDateString());
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Single-account state
  const [singleBalance, setSingleBalance] = useState<string>('');
  const [singleNotes, setSingleNotes] = useState<string>('');

  // Multi-account states
  const [searchQuery, setSearchQuery] = useState<string>('');
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
    setSearchQuery('');

    if (account) {
      setSingleBalance(account.balance.toString());
      setSingleNotes(account.notes || '');
    } else if (accountsList.length > 0) {
      const bMap: Record<string, string> = {};
      const nMap: Record<string, string> = {};
      accountsList.forEach((a) => {
        bMap[a.id] = a.balance.toString();
        nMap[a.id] = a.notes || '';
      });
      setBalancesMap(bMap);
      setNotesMap(nMap);
    }
  }, [isOpen, account, accountsList]);

  // Filtered accounts for multi-mode (Search + Type Filter)
  const filteredAccounts = useMemo(() => {
    return accountsList.filter((a) => {
      const matchesType = typeFilter === 'All' || a.type === typeFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        a.name.toLowerCase().includes(q) ||
        (a.institution && a.institution.toLowerCase().includes(q)) ||
        a.type.toLowerCase().includes(q);
      return matchesType && matchesSearch;
    });
  }, [accountsList, typeFilter, searchQuery]);

  // Identify modified accounts across all accounts
  const modifiedAccounts = useMemo(() => {
    return accountsList.filter((a) => {
      const currentVal = a.balance;
      const rawEntered = balancesMap[a.id];
      if (rawEntered === undefined) return false;
      const parsed = parseFloat(rawEntered);
      if (isNaN(parsed)) return false;
      const balanceChanged = Math.abs(parsed - currentVal) >= 0.01;
      const notesChanged = (notesMap[a.id] || '').trim() !== (a.notes || '').trim();
      return balanceChanged || notesChanged;
    });
  }, [accountsList, balancesMap, notesMap]);

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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account balance');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Handlers for Multi Mode ---
  const handleMultiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (modifiedAccounts.length === 0) {
      setError('No balance changes detected to save.');
      return;
    }

    const updates: BulkBalanceUpdateItem[] = [];
    for (const acc of modifiedAccounts) {
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update balances');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Empty state when 0 accounts exist
  if (isMultiMode && accountsList.length === 0) {
    if (!onOpenAddAccount) return null;
    return (
      <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
        <div className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-500">
            <Landmark className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">No Accounts Found</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Add your first bank account or CPF to start tracking balances.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenAddAccount();
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Add First Account</span>
          </button>
        </div>
      </AnimatedModal>
    );
  }

  // RENDER: Single Account Mode
  if (account) {
    return (
      <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex items-center justify-between p-5 sm:p-6 pb-3 border-b border-slate-100 dark:border-slate-800 shrink-0">
            <div>
              <h2 id="single-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Update Account Balance
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {account.name} {account.institution ? `(${account.institution})` : ''}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSingleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
              {error && (
                <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{error}</span>
                </div>
              )}

              <div>
                <label htmlFor="single-balance-input" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Balance (S$)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                    S$
                  </span>
                  <input
                    id="single-balance-input"
                    type="number"
                    step="0.01"
                    value={singleBalance}
                    onChange={(e) => setSingleBalance(e.target.value)}
                    placeholder="0.00"
                    required
                    autoFocus
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-base font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Previous: <span className="font-semibold text-slate-600 dark:text-slate-300">{formatSGD(account.balance)}</span>
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="single-date-input" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Snapshot Date
                  </label>
                  <input
                    id="single-date-input"
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="single-notes-input" className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    id="single-notes-input"
                    type="text"
                    value={singleNotes}
                    onChange={(e) => setSingleNotes(e.target.value)}
                    placeholder="e.g. Salary credited"
                    className="w-full px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 pt-3 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-95 disabled:opacity-50 transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
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
      </AnimatedModal>
    );
  }

  // RENDER: Multi-Account Batch Update Mode
  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-2xl">
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Landmark className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2 id="multi-modal-title" className="text-base font-bold text-slate-900 dark:text-white">
                Update Account Balances
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Type directly into any balance. Only modified accounts will be saved.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search, Filter Pills & Date */}
        <div className="px-5 py-2.5 bg-slate-50/70 dark:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          {/* Search bar */}
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Type Filters */}
          <div className="flex items-center gap-1">
            {(['All', 'Cash', 'Investment', 'CPF'] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setTypeFilter(cat)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                  typeFilter === cat
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Date Picker */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[11px] font-medium text-slate-400">Date:</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium text-slate-900 dark:text-white"
            />
          </div>
        </div>

        {/* Change Counter Banner */}
        <div className="px-5 py-1.5 bg-slate-100/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs shrink-0">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
            Showing {filteredAccounts.length} of {accountsList.length} accounts
          </span>
          <span className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
            {modifiedAccounts.length} modified
          </span>
        </div>

        {/* Accounts List */}
        <form onSubmit={handleMultiSubmit} className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {filteredAccounts.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-400">
              No accounts match "{searchQuery}"
            </div>
          ) : (
            filteredAccounts.map((acc) => {
              const currentVal = acc.balance;
              const enteredVal = parseFloat(balancesMap[acc.id] || '0');
              const isModified =
                !isNaN(enteredVal) && Math.abs(enteredVal - currentVal) >= 0.01;
              const diff = !isNaN(enteredVal) ? enteredVal - currentVal : 0;

              return (
                <div
                  key={acc.id}
                  className={`p-2.5 sm:p-3 rounded-xl border transition-all flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 ${
                    isModified
                      ? 'border-emerald-400/80 bg-emerald-50/30 dark:border-emerald-700/60 dark:bg-emerald-950/20'
                      : 'border-slate-200/70 bg-white dark:border-slate-800 dark:bg-slate-900/40'
                  }`}
                >
                  {/* Account Name & Info */}
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-7 w-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs shrink-0">
                      {acc.type === 'Cash' ? '💵' : acc.type === 'Investment' ? '📈' : '🏛️'}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                          {acc.name}
                        </span>
                        {acc.is_joint && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
                            Joint
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-2">
                        <span>{acc.institution || acc.type}</span>
                        <span>•</span>
                        <span>Prev: {formatSGD(currentVal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Input & Delta Indicator */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    {/* Delta Pill */}
                    {isModified ? (
                      <span
                        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                          diff > 0
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300'
                        }`}
                      >
                        {diff > 0 ? (
                          <ArrowUpRight className="h-3 w-3" />
                        ) : (
                          <ArrowDownRight className="h-3 w-3" />
                        )}
                        {diff > 0 ? '+' : ''}
                        {formatSGD(diff)}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-300 dark:text-slate-600 hidden sm:inline">
                        —
                      </span>
                    )}

                    {/* Numeric Input */}
                    <div className="relative w-32 sm:w-36">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
                        S$
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        value={balancesMap[acc.id] ?? ''}
                        onChange={(e) =>
                          setBalancesMap((prev) => ({
                            ...prev,
                            [acc.id]: e.target.value,
                          }))
                        }
                        placeholder="0.00"
                        className={`w-full pl-8 pr-2.5 py-1.5 rounded-lg border text-right text-xs font-bold transition-all focus:outline-none focus:ring-1 ${
                          isModified
                            ? 'border-emerald-500 bg-white dark:bg-slate-800 text-emerald-700 dark:text-emerald-300 ring-1 ring-emerald-500/20'
                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 text-slate-900 dark:text-white'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </form>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 shrink-0 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200/60 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleMultiSubmit}
            disabled={isSubmitting || modifiedAccounts.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-md shadow-emerald-500/20 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>
                  {modifiedAccounts.length > 0
                    ? `Save ${modifiedAccounts.length} Modified Account${modifiedAccounts.length === 1 ? '' : 's'}`
                    : 'No Changes to Save'}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </AnimatedModal>
  );
}

export default UpdateBalanceModal;
