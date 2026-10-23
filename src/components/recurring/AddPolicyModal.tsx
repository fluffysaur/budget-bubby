/**
 * AddPolicyModal Component
 * Dialog modal for creating or editing recurring policies, taxes, and subscriptions.
 * Features:
 * - Pre-filling for editing existing policies
 * - Field validation (Name required, positive Amount)
 * - Frequency selector with conditional renewal month input
 * - Owner selector (Yi Jia, Rachel, Joint)
 */

import { useState, useEffect, type FormEvent } from 'react';
import { X, Shield } from 'lucide-react';
import type {
  RecurringPolicy,
  RecurringPolicyType,
  RecurringFrequency,
  CreatePolicyInput,
} from '../../types/finance';
import { useHousehold } from '../../context/HouseholdContext';
import { mockMembers } from '../../data/mockSeedData';

function useSafeHousehold() {
  try {
    return useHousehold();
  } catch {
    return {
      members: mockMembers,
      activeMember: mockMembers[0],
      perspective: 'household' as const,
      setPerspective: () => {},
      theme: 'light' as const,
      toggleTheme: () => {},
      isMockMode: true,
      overview: null,
      loading: false,
      refreshData: async () => {},
    };
  }
}

export interface AddPolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (policyData: CreatePolicyInput & { id?: string }) => void | Promise<void>;
  initialPolicy?: RecurringPolicy | null;
}

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function AddPolicyModal({
  isOpen,
  onClose,
  onSave,
  initialPolicy = null,
}: AddPolicyModalProps) {
  const { members, activeMember } = useSafeHousehold();

  // Find member IDs
  const yiJiaMember = members.find((m) =>
    m.display_name.toLowerCase().includes('yi jia')
  );
  const rachelMember = members.find((m) =>
    m.display_name.toLowerCase().includes('rachel')
  );

  const defaultOwnerId =
    activeMember?.id || yiJiaMember?.id || 'mem-00000000-0011';

  // Form states
  const [name, setName] = useState<string>('');
  const [type, setType] = useState<RecurringPolicyType>('insurance');
  const [ownerId, setOwnerId] = useState<string>(defaultOwnerId);
  const [amount, setAmount] = useState<string>('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('annually');
  const [paymentMonth, setPaymentMonth] = useState<number>(1);
  const [startDate, setStartDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Sync state when initialPolicy changes or modal opens
  useEffect(() => {
    if (isOpen) {
      if (initialPolicy) {
        setName(initialPolicy.name);
        setType(initialPolicy.type);
        setOwnerId(initialPolicy.owner_id);
        setAmount(String(initialPolicy.amount));
        setFrequency(initialPolicy.frequency);
        setPaymentMonth(initialPolicy.payment_month || 1);
        setStartDate(initialPolicy.start_date || '');
        setNotes(initialPolicy.notes || '');
      } else {
        setName('');
        setType('insurance');
        setOwnerId(defaultOwnerId);
        setAmount('');
        setFrequency('annually');
        setPaymentMonth(9); // Default to Sep
        setStartDate('');
        setNotes('');
      }
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialPolicy, defaultOwnerId]);

  // Handle ESC key to dismiss
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validation
    const trimmedName = name.trim();
    if (!trimmedName) {
      setErrorMessage('Policy name is required.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage('Valid premium amount is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload: CreatePolicyInput & { id?: string } = {
        name: trimmedName,
        type,
        owner_id: ownerId,
        amount: Math.round(numericAmount * 100) / 100,
        frequency,
        payment_month: frequency === 'annually' ? Number(paymentMonth) : null,
        start_date: startDate || null,
        notes: notes.trim() || null,
      };

      if (initialPolicy?.id) {
        payload.id = initialPolicy.id;
      }

      await onSave(payload);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save policy');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isEditing = Boolean(initialPolicy?.id);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-headline"
      onClick={onClose}
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <h3
                id="modal-headline"
                className="text-lg font-bold text-slate-900 dark:text-white"
              >
                {isEditing ? 'Edit Recurring Policy' : 'Add Recurring Policy'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing
                  ? 'Update renewal dates or premium amounts'
                  : 'Track insurance, tax obligations, or recurring subscriptions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
            {errorMessage}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Policy Name */}
          <div>
            <label
              htmlFor="policy-name"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Policy Name
            </label>
            <input
              id="policy-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Manulife LifeReady 25, IRAS Income Tax"
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
            />
          </div>

          {/* Type & Owner Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Type */}
            <div>
              <label
                htmlFor="policy-type"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Type
              </label>
              <select
                id="policy-type"
                value={type}
                onChange={(e) => setType(e.target.value as RecurringPolicyType)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="insurance">Insurance</option>
                <option value="tax">Tax</option>
                <option value="subscription">Subscription</option>
              </select>
            </div>

            {/* Owner */}
            <div>
              <label
                htmlFor="policy-owner"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Owner
              </label>
              <select
                id="policy-owner"
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                {yiJiaMember && (
                  <option value={yiJiaMember.id}>👨 Yi Jia</option>
                )}
                {rachelMember && (
                  <option value={rachelMember.id}>👩 Rachel</option>
                )}
                <option value="joint">👥 Joint Household</option>
              </select>
            </div>
          </div>

          {/* Amount & Frequency Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Premium Amount */}
            <div>
              <label
                htmlFor="policy-amount"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Premium Amount
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-semibold">
                  S$
                </span>
                <input
                  id="policy-amount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            {/* Frequency */}
            <div>
              <label
                htmlFor="policy-frequency"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Frequency
              </label>
              <select
                id="policy-frequency"
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              >
                <option value="annually">Annually</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
          </div>

          {/* Conditional Renewal Month (for annual policies) & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Renewal Month */}
            <div>
              <label
                htmlFor="policy-renewal-month"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Renewal Month
              </label>
              <select
                id="policy-renewal-month"
                value={paymentMonth}
                disabled={frequency === 'monthly'}
                onChange={(e) => setPaymentMonth(Number(e.target.value))}
                className={`w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all ${
                  frequency === 'monthly' ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {MONTH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label} (Month {opt.value})
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label
                htmlFor="policy-start-date"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
              >
                Start Date
              </label>
              <input
                id="policy-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label
              htmlFor="policy-notes"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-1.5"
            >
              Notes
            </label>
            <textarea
              id="policy-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. GIRO deduction, hospital plan rider details..."
              className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20 focus:outline-none focus:ring-2 focus:ring-emerald-600/40 disabled:opacity-50 transition-all"
            >
              {isSubmitting ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default AddPolicyModal;
