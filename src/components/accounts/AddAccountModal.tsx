/**
 * AddAccountModal Component
 * Facilitates creating new accounts with Singapore banking/broker presets,
 * owner selection, joint flag, initial balance snapshot, and zero-account welcome banner.
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Landmark,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { Account, AccountType, HouseholdMember } from '../../types/finance';
import { financeService } from '../../services/financeService';

export interface AddAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  members: HouseholdMember[];
  defaultOwnerId?: string;
  isInitialSetup?: boolean;
  onAccountCreated?: (newAccount: Account) => void;
}

interface SingaporePreset {
  name: string;
  institution: string;
  type: AccountType;
  badge?: string;
}

const SG_PRESETS: SingaporePreset[] = [
  // Banks
  { name: 'DBS Multiplier', institution: 'DBS', type: 'Cash', badge: 'Popular' },
  { name: 'OCBC 360', institution: 'OCBC', type: 'Cash', badge: 'Popular' },
  { name: 'UOB One', institution: 'UOB', type: 'Cash', badge: 'Popular' },
  { name: 'MariBank Savings', institution: 'MariBank', type: 'Cash' },
  { name: 'Trust Bank Savings', institution: 'Trust Bank', type: 'Cash' },

  // CPF
  { name: 'CPF Ordinary Account (OA)', institution: 'CPF', type: 'CPF', badge: 'CPF' },
  { name: 'CPF Special Account (SA)', institution: 'CPF', type: 'CPF', badge: 'CPF' },
  { name: 'CPF MediSave Account (MA)', institution: 'CPF', type: 'CPF', badge: 'CPF' },

  // Investment
  { name: 'SGX CDP Securities', institution: 'SGX CDP', type: 'Investment' },
  { name: 'Interactive Brokers (IBKR)', institution: 'IBKR', type: 'Investment' },
  { name: 'Endowus Core Portfolio', institution: 'Endowus', type: 'Investment' },
  { name: 'Syfe Cash+/Equity', institution: 'Syfe', type: 'Investment' },
  { name: 'Webull Securities', institution: 'Webull', type: 'Investment' },
];

export function AddAccountModal({
  isOpen,
  onClose,
  members,
  defaultOwnerId,
  isInitialSetup = false,
  onAccountCreated,
}: AddAccountModalProps) {
  const [name, setName] = useState('');
  const [institution, setInstitution] = useState('');
  const [type, setType] = useState<AccountType>('Cash');
  const [ownerId, setOwnerId] = useState(defaultOwnerId || members[0]?.id || '');
  const [isJoint, setIsJoint] = useState(false);
  const [balance, setBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setName('');
      setInstitution('');
      setType('Cash');
      setOwnerId(defaultOwnerId || members[0]?.id || '');
      setIsJoint(false);
      setBalance('');
      setNotes('');
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultOwnerId, members]);

  // Handle escape dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSelectPreset = (preset: SingaporePreset) => {
    setName(preset.name);
    setInstitution(preset.institution);
    setType(preset.type);
    if (preset.type === 'CPF') {
      setIsJoint(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Please provide an account name.');
      return;
    }

    const parsedBalance = parseFloat(balance);
    if (isNaN(parsedBalance)) {
      setError('Please enter a valid numeric starting balance.');
      return;
    }

    const resolvedOwnerId = ownerId || members[0]?.id;
    if (!resolvedOwnerId) {
      setError('Please select an account owner.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const created = await financeService.createAccount({
        owner_id: resolvedOwnerId,
        name: name.trim(),
        institution: institution.trim() || null,
        type,
        balance: parsedBalance,
        is_joint: isJoint,
        notes: notes.trim() || null,
        currency: 'SGD',
      });

      onAccountCreated?.(created);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-account-title"
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Landmark className="h-5 w-5" />
            </div>
            <div>
              <h2 id="add-account-title" className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Add New Account
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track your savings, CPF, or investments
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

        {/* Empty State Banner (if 0 accounts exist) */}
        {isInitialSetup && (
          <div className="px-6 py-3.5 bg-emerald-50/80 dark:bg-emerald-950/30 border-b border-emerald-100 dark:border-emerald-800/40 flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              <span className="font-bold">No accounts found yet.</span> Add your first Singapore bank account, CPF, or portfolio to start tracking net worth and logging balance updates.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-3 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Singapore Presets */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Singapore Quick Presets
            </label>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
              {SG_PRESETS.map((preset) => {
                const isSelected = name === preset.name && institution === preset.institution;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 border-slate-200/80 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700/80'
                    }`}
                  >
                    <span>{preset.name}</span>
                    {preset.badge && (
                      <span className={`text-[10px] px-1 rounded-sm ${
                        isSelected ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {preset.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name & Institution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="account-name" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Name *
              </label>
              <input
                id="account-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DBS Multiplier"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label htmlFor="account-institution" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Bank / Institution
              </label>
              <input
                id="account-institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. DBS, OCBC, UOB"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Account Type & Initial Balance */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="account-type" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Account Category *
              </label>
              <select
                id="account-type"
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
              <label htmlFor="initial-balance" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Starting Balance (SGD) *
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 font-semibold text-xs">
                  S$
                </span>
                <input
                  id="initial-balance"
                  type="number"
                  step="0.01"
                  required
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm font-semibold text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Owner & Joint Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
            <div>
              <label htmlFor="account-owner" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Primary Owner *
              </label>
              <select
                id="account-owner"
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

            <div className="pt-4 sm:pt-5">
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
          </div>

          {/* Notes (Optional) */}
          <div>
            <label htmlFor="account-notes" className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Notes / Remarks (Optional)
            </label>
            <input
              id="account-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Salary credit account, emergency fund"
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          {/* Action Buttons */}
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
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-linear-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 active:scale-95 transition-all shadow-md shadow-emerald-500/20 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                  <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddAccountModal;
