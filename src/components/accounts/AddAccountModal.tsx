/**
 * AddAccountModal Component
 * Ultra-minimal account creation modal:
 * - AnimatedModal wrapper
 * - Compact Singapore presets (popular chips + dropdown)
 * - Clean 1-glance form with optional fields behind "+ More details"
 */

import React, { useState, useEffect } from 'react';
import {
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
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from '../ui/AnimatedModal';
import { Select } from '../ui/Select';

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

      const targetMember = members.find((m) => m.id === resolvedOwnerId);

      const created = await financeService.createAccount({
        household_id: targetMember?.household_id,
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
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Header */}
        <ModalHeader
          id="add-account-title"
          title="Add New Account"
          icon={<Landmark className="h-4.5 w-4.5" strokeWidth={2.5} />}
          iconBgColor="bg-(--pastel-butter-light)"
          onClose={onClose}
        />

        <ModalBody>
            {/* Empty State Banner (if 0 accounts exist) */}
            {isInitialSetup && (
              <div className="p-3 rounded-2xl bg-(--pastel-butter-light) border-2 border-(--border-ink) shadow-cute-sm flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 stroke-3 text-(--text-ink) shrink-0 mt-0.5" />
                <div className="text-xs text-(--text-ink) leading-relaxed">
                  <span className="font-bold">No accounts found yet.</span> Add your bank, CPF, or investment account to track balances.
                </div>
              </div>
            )}

            {error && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex items-center gap-2 text-xs text-rose-700 dark:text-rose-300 font-medium">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Quick Presets */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                  Quick Preset
                </span>
                <div className="relative flex items-center">
                  <select
                    aria-label="More presets"
                    onChange={(e) => {
                      const found = ALL_PRESETS.find((p) => p.name === e.target.value);
                      if (found) handleSelectPreset(found);
                    }}
                    defaultValue=""
                    className="appearance-none text-[11px] font-bold text-(--text-ink) bg-(--bg-canvas) pl-2 pr-6 py-0.5 rounded-lg border border-(--border-subtle) hover:border-(--border-ink) cursor-pointer focus:outline-none focus:ring-1 focus:ring-(--pastel-lilac)"
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
                  <ChevronDown
                    className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-(--text-muted)"
                    strokeWidth={2.5}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {POPULAR_PRESETS.map((preset) => {
                  const isSelected = name === preset.name;
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() => handleSelectPreset(preset)}
                      className={`px-2.5 py-1 rounded-xl text-xs font-bold border transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                        isSelected
                          ? 'bg-(--pastel-butter) text-(--text-ink) border-(--border-ink) shadow-cute-sm'
                          : 'bg-(--bg-canvas) text-(--text-ink) border-(--border-subtle) hover:border-(--border-ink)'
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
                <label htmlFor="account-name" className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                  Account Name *
                </label>
                <input
                  id="account-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. DBS Multiplier"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                />
              </div>
              <div>
                <label htmlFor="account-institution" className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                  Bank / Institution
                </label>
                <input
                  id="account-institution"
                  type="text"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="e.g. DBS, OCBC, UOB"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                />
              </div>
            </div>

            {/* Account Type & Starting Balance */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Select
                  id="account-type"
                  label="Type *"
                  labelClassName="text-[11px] mb-1"
                  value={type}
                  onChange={(e) => setType(e.target.value as AccountType)}
                  sizeVariant="sm"
                  className="bg-(--bg-canvas)"
                >
                  <option value="Cash">Cash / Savings</option>
                  <option value="Investment">Investment / Brokerage</option>
                  <option value="CPF">CPF (OA/SA/MA)</option>
                  <option value="Other">Other Asset</option>
                </Select>
              </div>

              <div>
                <label htmlFor="initial-balance" className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                  Starting Balance (SGD) *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-(--text-muted) select-none">
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
                    className="w-full pl-9 pr-3 py-2 text-xs font-bold font-mono-num rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                  />
                </div>
              </div>
            </div>

            {/* Owner & Joint Status */}
            <div className="grid grid-cols-2 gap-3 items-center">
              <div>
                <Select
                  id="account-owner"
                  label="Owner *"
                  labelClassName="text-[11px] mb-1"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  sizeVariant="sm"
                  className="bg-(--bg-canvas)"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isJoint}
                    onChange={(e) => setIsJoint(e.target.checked)}
                    disabled={type === 'CPF'}
                    className="h-4 w-4 rounded-md border-(--border-ink) text-(--text-ink) accent-(--text-ink) cursor-pointer disabled:opacity-40"
                  />
                  <span className={`text-xs font-bold ${type === 'CPF' ? 'text-(--text-muted)' : 'text-(--text-ink)'}`}>
                    Joint Account
                  </span>
                </label>
              </div>
            </div>

            {/* Collapsible More Details (Institution + Notes) */}
            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-canvas) p-3">
              <button
                type="button"
                onClick={() => setShowMoreDetails((prev) => !prev)}
                className="w-full flex items-center justify-between text-xs font-bold text-(--text-ink) cursor-pointer"
              >
                <span>{showMoreDetails ? 'Hide extra details' : '+ More details (Bank, Notes)'}</span>
                {showMoreDetails ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </button>

              {showMoreDetails && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-2.5 pt-2.5 border-t border-(--border-subtle)">
                  <div>
                    <label htmlFor="account-institution-extra" className="block text-[10px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                      Institution
                    </label>
                    <input
                      id="account-institution-extra"
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="e.g. DBS, OCBC"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                    />
                  </div>
                  <div>
                    <label htmlFor="account-notes" className="block text-[10px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                      Notes
                    </label>
                    <input
                      id="account-notes"
                      type="text"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="e.g. Salary account"
                      className="w-full px-2.5 py-1.5 text-xs rounded-xl border border-(--border-subtle) hover:border-(--border-ink) focus:border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                    />
                  </div>
                </div>
              )}
            </div>
        </ModalBody>

        {/* Action Buttons Footer */}
        <ModalFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                <span>Create Account</span>
              </>
            )}
          </button>
        </ModalFooter>
      </form>
    </AnimatedModal>
  );
}

export default AddAccountModal;
