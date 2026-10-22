/**
 * AddAccountModal Component
 * Ultra-minimal account creation modal:
 * - AnimatedModal wrapper
 * - Compact Singapore presets (popular chips + dropdown)
 * - Clean 1-glance form with optional fields behind "+ More details"
 */

import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Landmark,
  AlertCircle,
  Loader2,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { Account, AccountType, HouseholdMember } from '../../types/finance';
import { financeService } from '../../services/financeService';
import { AnimatedModal } from '../ui/AnimatedModal';

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
}

const POPULAR_PRESETS: SingaporePreset[] = [
  { name: 'DBS Multiplier', institution: 'DBS', type: 'Cash' },
  { name: 'OCBC 360', institution: 'OCBC', type: 'Cash' },
  { name: 'UOB One', institution: 'UOB', type: 'Cash' },
  { name: 'CPF OA', institution: 'CPF', type: 'CPF' },
  { name: 'IBKR', institution: 'IBKR', type: 'Investment' },
];

const ALL_PRESETS: SingaporePreset[] = [
  ...POPULAR_PRESETS,
  { name: 'MariBank Savings', institution: 'MariBank', type: 'Cash' },
  { name: 'Trust Bank Savings', institution: 'Trust Bank', type: 'Cash' },
  { name: 'CPF Special Account (SA)', institution: 'CPF', type: 'CPF' },
  { name: 'CPF MediSave (MA)', institution: 'CPF', type: 'CPF' },
  { name: 'Endowus Portfolio', institution: 'Endowus', type: 'Investment' },
  { name: 'Syfe Cash+/Equity', institution: 'Syfe', type: 'Investment' },
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
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setInstitution('');
      setType('Cash');
      setOwnerId(defaultOwnerId || members[0]?.id || '');
      setIsJoint(false);
      setBalance('');
      setNotes('');
      setShowMoreDetails(false);
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultOwnerId, members]);

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
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="p-5 sm:p-6 max-h-[88vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Landmark className="h-4.5 w-4.5" />
            </div>
            <h2 id="add-account-title" className="text-base font-bold text-slate-900 dark:text-white">
              Add New Account
            </h2>
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

        {/* Empty State Banner (if 0 accounts exist) */}
        {isInitialSetup && (
          <div className="my-3 p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40 flex items-start gap-2.5">
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs text-emerald-800 dark:text-emerald-300 leading-relaxed">
              <span className="font-bold">No accounts found yet.</span> Add your bank, CPF, or investment account to track balances.
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Presets */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Quick Preset
              </span>
              <select
                aria-label="More presets"
                onChange={(e) => {
                  const found = ALL_PRESETS.find((p) => p.name === e.target.value);
                  if (found) handleSelectPreset(found);
                }}
                defaultValue=""
                className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 bg-transparent border-none cursor-pointer focus:outline-none"
              >
                <option value="" disabled>
                  More presets...
                </option>
                {ALL_PRESETS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {POPULAR_PRESETS.map((preset) => {
                const isSelected = name === preset.name;
                return (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => handleSelectPreset(preset)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white font-semibold shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                    }`}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Account Name & Bank / Institution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="account-name" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Account Name *
              </label>
              <input
                id="account-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DBS Multiplier"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
            <div>
              <label htmlFor="account-institution" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Bank / Institution
              </label>
              <input
                id="account-institution"
                type="text"
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. DBS, OCBC, UOB"
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Account Type & Starting Balance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="account-type" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Type *
              </label>
              <select
                id="account-type"
                value={type}
                onChange={(e) => setType(e.target.value as AccountType)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                <option value="Cash">Cash / Savings</option>
                <option value="Investment">Investment / Brokerage</option>
                <option value="CPF">CPF (OA/SA/MA)</option>
                <option value="Other">Other Asset</option>
              </select>
            </div>

            <div>
              <label htmlFor="initial-balance" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Starting Balance (SGD) *
              </label>
              <div className="relative">
                <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 select-none">
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
                  className="w-full pl-8 pr-2.5 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
            </div>
          </div>

          {/* Owner & Joint Status */}
          <div className="grid grid-cols-2 gap-3 items-center">
            <div>
              <label htmlFor="account-owner" className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Owner *
              </label>
              <select
                id="account-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.display_name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isJoint}
                  onChange={(e) => setIsJoint(e.target.checked)}
                  disabled={type === 'CPF'}
                  className="h-4 w-4 rounded-md border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:opacity-40"
                />
                <span className={`text-xs font-semibold ${type === 'CPF' ? 'text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  Joint Account
                </span>
              </label>
            </div>
          </div>

          {/* Collapsible More Details (Institution + Notes) */}
          <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 p-2.5">
            <button
              type="button"
              onClick={() => setShowMoreDetails((prev) => !prev)}
              className="w-full flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-400 cursor-pointer"
            >
              <span>{showMoreDetails ? 'Hide extra details' : '+ More details (Bank, Notes)'}</span>
              {showMoreDetails ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {showMoreDetails && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-slate-200/60 dark:border-slate-800">
                <div>
                  <label htmlFor="account-institution" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Institution
                  </label>
                  <input
                    id="account-institution"
                    type="text"
                    value={institution}
                    onChange={(e) => setInstitution(e.target.value)}
                    placeholder="e.g. DBS, OCBC"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label htmlFor="account-notes" className="block text-[10px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Notes
                  </label>
                  <input
                    id="account-notes"
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Salary account"
                    className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
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
                  <span>Saving...</span>
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
    </AnimatedModal>
  );
}

export default AddAccountModal;
