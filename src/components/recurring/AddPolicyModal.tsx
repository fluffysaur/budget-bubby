/**
 * AddPolicyModal Component
 * Dialog modal for creating or editing recurring policies, taxes, and subscriptions.
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Pre-filling for editing existing policies
 * - Field validation (Name required, positive Amount)
 * - Frequency selector with conditional renewal month input
 * - Owner selector (Yi Jia, Rachel, Joint)
 */

import { useState, useEffect, type FormEvent } from "react";
import { Shield } from "lucide-react";
import type { RecurringPolicy, RecurringPolicyType, RecurringFrequency, CreatePolicyInput } from "../../types/finance";
import { useHousehold } from "../../context/HouseholdContext";
import { mockMembers } from "../../data/mockSeedData";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { Select } from "../ui/Select";

function useSafeHousehold() {
    try {
        return useHousehold();
    } catch {
        return {
            members: mockMembers,
            activeMember: mockMembers[0],
            perspective: "household" as const,
            setPerspective: () => {},
            theme: "light" as const,
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
    { value: 1, label: "January" },
    { value: 2, label: "February" },
    { value: 3, label: "March" },
    { value: 4, label: "April" },
    { value: 5, label: "May" },
    { value: 6, label: "June" },
    { value: 7, label: "July" },
    { value: 8, label: "August" },
    { value: 9, label: "September" },
    { value: 10, label: "October" },
    { value: 11, label: "November" },
    { value: 12, label: "December" },
];

export function AddPolicyModal({
    isOpen,
    onClose,
    onSave,
    initialPolicy = null,
}: AddPolicyModalProps) {
    const { members, activeMember } = useSafeHousehold();

    // Find member IDs
    const yiJiaMember = members.find((m) => m.display_name.toLowerCase().includes("yi jia"));

    const defaultOwnerId = activeMember?.id || yiJiaMember?.id || "mem-00000000-0011";

    // Form states
    const [name, setName] = useState<string>("");
    const [type, setType] = useState<RecurringPolicyType>("insurance");
    const [ownerId, setOwnerId] = useState<string>(defaultOwnerId);
    const [amount, setAmount] = useState<string>("");
    const [frequency, setFrequency] = useState<RecurringFrequency>("annually");
    const [paymentMonth, setPaymentMonth] = useState<number>(1);
    const [startDate, setStartDate] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
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
                setStartDate(initialPolicy.start_date ? initialPolicy.start_date.substring(0, 10) : "");
                setNotes(initialPolicy.notes || "");
            } else {
                setName("");
                setType("insurance");
                setOwnerId(defaultOwnerId);
                setAmount("");
                setFrequency("annually");
                setPaymentMonth(1);
                setStartDate("");
                setNotes("");
            }
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, initialPolicy, defaultOwnerId]);

    if (!isOpen) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const trimmedName = name.trim();
        if (!trimmedName) {
            setErrorMessage("Policy name is required.");
            return;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setErrorMessage("Valid premium amount is required.");
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
                payment_month: frequency === "annually" ? Number(paymentMonth) : null,
                start_date: startDate || null,
                notes: notes.trim() || null,
            };

            if (initialPolicy?.id) {
                payload.id = initialPolicy.id;
            }

            await onSave(payload);
            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to save policy");
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditing = Boolean(initialPolicy?.id);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="modal-headline"
                    title={isEditing ? "Edit Recurring Policy" : "Add Recurring Policy"}
                    subtitle={
                        isEditing
                            ? "Update renewal dates or premium amounts"
                            : "Track insurance, tax obligations, or recurring subscriptions"
                    }
                    icon={<Shield className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error notification */}
                    {errorMessage && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-300">
                            {errorMessage}
                        </div>
                    )}

                    {/* Policy Name */}
                    <div>
                        <label
                            htmlFor="policy-name"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Policy Name *
                        </label>
                        <input
                            id="policy-name"
                            type="text"
                            placeholder="e.g. AIA Guaranteed Protect Plus, IncomeShield"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Type and Owner grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Select
                                id="policy-type"
                                label="Type"
                                value={type}
                                onChange={(e) => setType(e.target.value as RecurringPolicyType)}
                                className="bg-(--bg-canvas)"
                            >
                                <option value="insurance">🛡️ Life / Health Insurance</option>
                                <option value="tax">🏛️ Income / Property Tax</option>
                                <option value="subscription">📱 Subscription (Netflix, Spotify)</option>
                                <option value="other">📦 Other Recurring</option>
                            </Select>
                        </div>

                        <div>
                            <Select
                                id="policy-owner"
                                label="Owner"
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                className="bg-(--bg-canvas)"
                            >
                                {members.map((m) => (
                                    <option
                                        key={m.id}
                                        value={m.id}
                                    >
                                        👤 {m.display_name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Amount & Frequency grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="policy-amount"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Premium Amount *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">
                                    S$
                                </span>
                                <input
                                    id="policy-amount"
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    placeholder="1200.00"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    className="w-full pl-9 pr-3.5 py-2 text-sm font-mono-num font-semibold rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>

                        <div>
                            <Select
                                id="policy-frequency"
                                label="Frequency"
                                value={frequency}
                                onChange={(e) => setFrequency(e.target.value as RecurringFrequency)}
                                className="bg-(--bg-canvas)"
                            >
                                <option value="annually">Once a year (Annual)</option>
                                <option value="monthly">Every month (Monthly)</option>
                            </Select>
                        </div>
                    </div>

                    {/* Conditional Renewal Month (Only if Annual) */}
                    {frequency === "annually" && (
                        <div>
                            <Select
                                id="policy-month"
                                label="Renewal Month"
                                value={paymentMonth}
                                onChange={(e) => setPaymentMonth(Number(e.target.value))}
                                className="bg-(--bg-canvas)"
                            >
                                {MONTH_OPTIONS.map((m) => (
                                    <option
                                        key={m.value}
                                        value={m.value}
                                    >
                                        📅 {m.label}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}

                    {/* Start Date */}
                    <div>
                        <label
                            htmlFor="policy-start-date"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Policy Inception / Start Date (Optional)
                        </label>
                        <input
                            id="policy-start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono-num rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label
                            htmlFor="policy-notes"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Notes
                        </label>
                        <textarea
                            id="policy-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. GIRO deduction, hospital plan rider details..."
                            className="w-full px-3.5 py-2 text-sm rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) resize-none"
                        />
                    </div>
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        {isSubmitting ? "Saving..." : "Save Policy"}
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddPolicyModal;
