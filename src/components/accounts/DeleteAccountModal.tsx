/**
 * DeleteAccountModal Component
 * Prompts for destructive confirmation before deleting an account and cascading its balance snapshots.
 */

import { useState } from 'react';
import { Trash2, AlertTriangle, Loader2 } from 'lucide-react';
import type { Account } from '../../types/finance';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';

export interface DeleteAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  onAccountDeleted?: (accountId: string) => void;
}

export function DeleteAccountModal({
  isOpen,
  onClose,
  account,
  onAccountDeleted,
}: DeleteAccountModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !account) return null;

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setError(null);
      await financeService.deleteAccount(account.id);
      onAccountDeleted?.(account.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete account');
      setIsDeleting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400 shrink-0">
            <AlertTriangle className="h-6 w-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 id="delete-account-title" className="text-base font-bold text-slate-900 dark:text-white">
              Delete Account?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This action cannot be undone
            </p>
          </div>
        </div>

        <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
          Are you sure you want to delete <span className="font-bold text-slate-900 dark:text-white">{account.name}</span>
          {account.institution ? ` (${account.institution})` : ''} with current balance of{' '}
          <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatSGD(account.balance)}</span>?
        </p>

        <div className="p-3.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/30 border border-rose-200/80 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 mb-5">
          <p className="font-semibold mb-1">Warning:</p>
          <p>
            Deleting this account will permanently remove all historical balance snapshots, net worth timeline entries, and monthly records associated with it.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-100 text-rose-800 text-xs mb-4">
            {error}
          </div>
        )}

        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Keep Account
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-md shadow-rose-600/20 disabled:opacity-50 cursor-pointer"
          >
            {isDeleting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Deleting...</span>
              </>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Account</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DeleteAccountModal;
