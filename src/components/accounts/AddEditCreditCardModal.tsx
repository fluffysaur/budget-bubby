/**
 * Add / Edit Credit Card Modal
 * Configures credit cards with:
 * - Card Name, Bank, Last 4 Digits
 * - Statement / Billing Day of Month (1 - 31)
 * - Due Day of Month (1 - 31)
 * - Credit Limit (SGD)
 * - Card Color theme
 * - Card Owner selector
 */

import { useState, useEffect, type FormEvent } from 'react';
import { CreditCard, X, Building, Calendar, DollarSign, Palette, User } from 'lucide-react';
import { AnimatedModal } from '../ui/AnimatedModal';
import { Button } from '../ui/Button';
import { financeService } from '../../services/financeService';
import type { CreditCard as CreditCardType, HouseholdMember, CreateCreditCardInput } from '../../types/finance';

export interface AddEditCreditCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  card?: CreditCardType | null;
  members: HouseholdMember[];
  defaultOwnerId?: string;
  onCardSaved?: () => void;
}

const PRESET_COLORS = [
  { label: 'Sky Blue', hex: '#0284c7' },
  { label: 'Emerald Green', hex: '#059669' },
  { label: 'Rose Red', hex: '#e11d48' },
  { label: 'Royal Violet', hex: '#7c3aed' },
  { label: 'Amber Orange', hex: '#d97706' },
  { label: 'Slate Charcoal', hex: '#334155' },
  { label: 'Midnight Blue', hex: '#1e3a8a' },
  { label: 'Pink Fuchsia', hex: '#c026d3' },
];

const PRESET_BANKS = ['DBS', 'OCBC', 'UOB', 'Citibank', 'Standard Chartered', 'HSBC', 'AMEX', 'Maybank', 'Other'];

export function AddEditCreditCardModal({
  isOpen,
  onClose,
  card,
  members,
  defaultOwnerId,
  onCardSaved,
}: AddEditCreditCardModalProps) {
  const isEditing = Boolean(card);

  const [name, setName] = useState<string>('');
  const [bank, setBank] = useState<string>('DBS');
  const [customBank, setCustomBank] = useState<string>('');
  const [last4, setLast4] = useState<string>('');
  const [billingDay, setBillingDay] = useState<number>(15);
  const [dueDay, setDueDay] = useState<number>(5);
  const [creditLimit, setCreditLimit] = useState<string>('');
  const [color, setColor] = useState<string>(PRESET_COLORS[0].hex);
  const [ownerId, setOwnerId] = useState<string>(defaultOwnerId || members[0]?.id || '');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (card) {
        setName(card.name);
        if (PRESET_BANKS.includes(card.bank)) {
          setBank(card.bank);
          setCustomBank('');
        } else {
          setBank('Other');
          setCustomBank(card.bank);
        }
        setLast4(card.last4 || '');
        setBillingDay(card.billing_day || 15);
        setDueDay(card.due_day || 5);
        setCreditLimit(card.credit_limit ? String(card.credit_limit) : '');
        setColor(card.color || PRESET_COLORS[0].hex);
        setOwnerId(card.owner_id);
      } else {
        setName('');
        setBank('DBS');
        setCustomBank('');
        setLast4('');
        setBillingDay(15);
        setDueDay(5);
        setCreditLimit('');
        setColor(PRESET_COLORS[0].hex);
        setOwnerId(defaultOwnerId || members[0]?.id || '');
      }
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, card, members, defaultOwnerId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Please enter a card name (e.g. DBS Altitude Visa)');
      return;
    }

    const finalBank = bank === 'Other' ? customBank.trim() : bank;
    if (!finalBank) {
      setErrorMessage('Please specify the issuing bank');
      return;
    }

    if (billingDay < 1 || billingDay > 31) {
      setErrorMessage('Statement billing day must be between 1 and 31');
      return;
    }

    if (dueDay < 1 || dueDay > 31) {
      setErrorMessage('Payment due day must be between 1 and 31');
      return;
    }

    const parsedLimit = creditLimit.trim() ? parseFloat(creditLimit) : null;
    if (parsedLimit !== null && (isNaN(parsedLimit) || parsedLimit < 0)) {
      setErrorMessage('Please enter a valid credit limit');
      return;
    }

    try {
      setIsSubmitting(true);
      if (isEditing && card) {
        await financeService.updateCreditCard(card.id, {
          name: trimmedName,
          bank: finalBank,
          last4: last4.trim() ? last4.trim().slice(-4) : null,
          billing_day: billingDay,
          due_day: dueDay,
          credit_limit: parsedLimit,
          color,
          owner_id: ownerId,
        });
      } else {
        const input: CreateCreditCardInput = {
          name: trimmedName,
          bank: finalBank,
          last4: last4.trim() ? last4.trim().slice(-4) : null,
          billing_day: billingDay,
          due_day: dueDay,
          credit_limit: parsedLimit,
          color,
          owner_id: ownerId,
        };
        await financeService.addCreditCard(input);
      }

      onCardSaved?.();
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save credit card');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-5 sm:p-6 pb-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: color }}
            >
              <CreditCard className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">
                {isEditing ? 'Edit Credit Card' : 'Add Credit Card'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Track statements, billing cycles, and due dates
              </p>
            </div>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6 space-y-4">
            {errorMessage && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                {errorMessage}
              </div>
            )}

            {/* Card Name */}
            <div>
              <label htmlFor="card-name" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                Card Name *
              </label>
              <input
                id="card-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. DBS Altitude Visa, UOB One Card"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>

            {/* Bank & Last 4 Digits */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-bank" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Building className="h-3.5 w-3.5 text-slate-400" />
                  <span>Issuing Bank *</span>
                </label>
                <select
                  id="card-bank"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  {PRESET_BANKS.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
                {bank === 'Other' && (
                  <input
                    type="text"
                    value={customBank}
                    onChange={(e) => setCustomBank(e.target.value)}
                    placeholder="Enter bank name"
                    className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                )}
              </div>

              <div>
                <label htmlFor="card-last4" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                  <span>Last 4 Digits</span>
                </label>
                <input
                  id="card-last4"
                  type="text"
                  maxLength={4}
                  value={last4}
                  onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))}
                  placeholder="e.g. 4128"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-mono text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>

            {/* Statement Day & Due Day */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-billing-day" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Statement Day *</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="card-billing-day"
                    type="number"
                    min={1}
                    max={31}
                    value={billingDay}
                    onChange={(e) => setBillingDay(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    required
                  />
                  <span className="text-xs text-slate-500 shrink-0">of month</span>
                </div>
              </div>

              <div>
                <label htmlFor="card-due-day" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <Calendar className="h-3.5 w-3.5 text-slate-400" />
                  <span>Payment Due Day *</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="card-due-day"
                    type="number"
                    min={1}
                    max={31}
                    value={dueDay}
                    onChange={(e) => setDueDay(parseInt(e.target.value, 10) || 1)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    required
                  />
                  <span className="text-xs text-slate-500 shrink-0">of month</span>
                </div>
              </div>
            </div>

            {/* Credit Limit & Owner */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="card-credit-limit" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                  <span>Credit Limit (SGD)</span>
                </label>
                <input
                  id="card-credit-limit"
                  type="number"
                  step="any"
                  value={creditLimit}
                  onChange={(e) => setCreditLimit(e.target.value)}
                  placeholder="e.g. 15000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="card-owner" className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  <User className="h-3.5 w-3.5 text-slate-400" />
                  <span>Card Holder *</span>
                </label>
                <select
                  id="card-owner"
                  value={ownerId}
                  onChange={(e) => setOwnerId(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/20 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.display_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Color Accent Picker */}
            <div>
              <label className="flex items-center gap-1 text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                <Palette className="h-3.5 w-3.5 text-slate-400" />
                <span>Card Color Badge</span>
              </label>
              <div className="flex flex-wrap items-center gap-2">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c.hex}
                    type="button"
                    title={c.label}
                    onClick={() => setColor(c.hex)}
                    className={`h-7 w-7 rounded-full transition-transform cursor-pointer ${
                      color === c.hex
                        ? 'ring-2 ring-indigo-500 ring-offset-2 scale-110 shadow-xs'
                        : 'hover:scale-105 opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex items-center justify-end gap-2 shrink-0">
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting} type="button">
              Cancel
            </Button>
            <Button variant="primary" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : isEditing ? 'Save Changes' : 'Add Credit Card'}
            </Button>
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
}
