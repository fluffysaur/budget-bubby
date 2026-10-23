/**
 * EditAccountModal Component
 * Allows editing account metadata (name, institution, type, owner, joint status, and notes)
 * without resetting historical balance snapshots.
 */

import React, { useState, useEffect } from 'react';
import { X, Pencil, AlertCircle, Loader2, Check } from 'lucide-react';
import type { Account, AccountType, HouseholdMember } from '../../types/finance';
import { financeService } from '../../services/financeService';

export interface EditAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  account: Account | null;
  members: HouseholdMember[];
  onAccountUpdated?: (updatedAccount: Account) => void;
}

export function EditAccountModal({
  isOpen,
  onClose,
  account,
  members,
  onAccountUpdated,
}: EditAccountModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('Cash');
  const [ownerId, setOwnerId] = useState('');
  const [isJoint, setIsJoint] = useState(false);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && account) {
      setName(account.name);
      setInstitution(account.institution || '');
      setType(account.type);
      setOwnerId(account.owner_id);
      setIsJoint(account.is_joint);
      setNotes(account.notes || '');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, account]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !account) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Account name is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const updated = await financeService.updateAccount(account.id, {
        name: name.trim(),
        institution: institution.trim() || null,
        type,
        owner_id: ownerId || account.owner_id,
        is_joint: type === 'CPF' ? false : isJoint,
        notes: notes.trim() || null,
      });

      onAccountUpdated?.(updated);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update account details');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-account-title"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-y-auto"
    >
      <div
        className="w-full max-w-lg my-8 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Pencil className="h-5 w-5" />
            </div>
            <div>
              <h2 id="edit-account-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Edit Account Details
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update account name, category, or owner
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Account Name & Institution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-account-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Name *
              </label>
              <input
                id="edit-account-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="edit-account-institution" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bank / Institution
              </label>
              <input
                id="edit-account-institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. DBS, OCBC"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Category & Owner */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="edit-account-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Category *
              </label>
              <select
                id="edit-account-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                <option value="Cash">Cash / Savings / Current</option>
                <option value="Investment">Investment / Brokerage / SRS</option>
                <option value="CPF">CPF (OA / SA / MA)</option>
                <option value="Other">Other Asset</option>
              </select>
            </div>

            <div>
              <label htmlFor="edit-account-owner" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Owner *
              </label>
              <select
                id="edit-account-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Joint Status */}
          <div className="pt-1">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={isJoint}
                onChange={(e) => setIsJoint(e.target.checked)}
                disabled={type === 'CPF'}
                className="h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
              />
              <span className={`text-xs font-semibold ${type === 'CPF' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                Joint Household Account
              </span>
            </label>
            {type === 'CPF' && (
              <span className="text-[10px] text-slate-400 block mt-0.5">CPF accounts cannot be joint in SG</span>
            )}
          </div>

          {/* Notes */}
          <div>
            <label htmlFor="edit-account-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes / Remarks
            </label>
            <input
              id="edit-account-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Salary credited here"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition-all shadow-md shadow-blue-600/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default EditAccountModal;
