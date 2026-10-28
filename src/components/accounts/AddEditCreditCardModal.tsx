/**
 * Add / Edit Credit Card Modal
 * Configures credit cards with:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Card Name, Bank, Last 4 Digits
 * - Statement / Billing Day of Month (1 - 31)
 * - Due Day of Month (1 - 31)
 * - Credit Limit (SGD)
 * - Card Color theme
 * - Card Owner selector
 */

import { useState, useEffect, type FormEvent } from "react";
import { CreditCard, Building, Calendar, DollarSign, Palette, User } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { Select } from "../ui/Select";
import { financeService } from "../../services/financeService";
import type { CreditCard as CreditCardType, HouseholdMember, CreateCreditCardInput } from "../../types/finance";

export interface AddEditCreditCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    card?: CreditCardType | null;
    members: HouseholdMember[];
    defaultOwnerId?: string;
    onCardSaved?: () => void;
}

const PRESET_COLORS = [
    { label: "Sky Blue", hex: "#0284c7" },
    { label: "Emerald Green", hex: "#059669" },
    { label: "Rose Red", hex: "#e11d48" },
    { label: "Royal Violet", hex: "#7c3aed" },
    { label: "Amber Orange", hex: "#d97706" },
    { label: "Slate Charcoal", hex: "#334155" },
    { label: "Midnight Blue", hex: "#1e3a8a" },
    { label: "Pink Fuchsia", hex: "#c026d3" },
];

const PRESET_BANKS = ["DBS", "OCBC", "UOB", "Citibank", "Standard Chartered", "HSBC", "AMEX", "Maybank", "Other"];

export function AddEditCreditCardModal({
    isOpen,
    onClose,
    card,
    members,
    defaultOwnerId,
    onCardSaved,
}: AddEditCreditCardModalProps) {
    const isEditing = Boolean(card);

    const [name, setName] = useState<string>("");
    const [bank, setBank] = useState<string>("DBS");
    const [customBank, setCustomBank] = useState<string>("");
    const [last4, setLast4] = useState<string>("");
    const [billingDay, setBillingDay] = useState<number>(15);
    const [dueDay, setDueDay] = useState<number>(5);
    const [creditLimit, setCreditLimit] = useState<string>("");
    const [color, setColor] = useState<string>(PRESET_COLORS[0].hex);
    const [ownerId, setOwnerId] = useState<string>(defaultOwnerId || members[0]?.id || "");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (card) {
                setName(card.name);
                const isPresetBank = PRESET_BANKS.includes(card.bank);
                setBank(isPresetBank ? card.bank : "Other");
                setCustomBank(isPresetBank ? "" : card.bank);
                setLast4(card.last4 || "");
                setBillingDay(card.billing_day || 15);
                setDueDay(card.due_day || 5);
                setCreditLimit(card.credit_limit ? card.credit_limit.toString() : "");
                setColor(card.color || PRESET_COLORS[0].hex);
                setOwnerId(card.owner_id || defaultOwnerId || members[0]?.id || "");
            } else {
                setName("");
                setBank("DBS");
                setCustomBank("");
                setLast4("");
                setBillingDay(15);
                setDueDay(5);
                setCreditLimit("");
                setColor(PRESET_COLORS[0].hex);
                setOwnerId(defaultOwnerId || members[0]?.id || "");
            }
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, card, members, defaultOwnerId]);

    if (!isOpen) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!name.trim()) {
            setErrorMessage("Please enter a card name");
            return;
        }

        const effectiveBank = bank === "Other" ? customBank.trim() : bank;
        if (!effectiveBank) {
            setErrorMessage("Please select or enter an issuing bank");
            return;
        }

        if (last4 && (last4.length !== 4 || isNaN(Number(last4)))) {
            setErrorMessage("Last 4 digits must be exactly 4 digits, or left blank");
            return;
        }

        const bDay = Number(billingDay);
        const dDay = Number(dueDay);
        if (isNaN(bDay) || bDay < 1 || bDay > 31) {
            setErrorMessage("Statement day must be between 1 and 31");
            return;
        }
        if (isNaN(dDay) || dDay < 1 || dDay > 31) {
            setErrorMessage("Payment due day must be between 1 and 31");
            return;
        }

        const numericLimit = creditLimit ? parseFloat(creditLimit) : null;
        if (numericLimit !== null && (isNaN(numericLimit) || numericLimit < 0)) {
            setErrorMessage("Please enter a valid credit limit");
            return;
        }

        try {
            setIsSubmitting(true);

            if (isEditing && card) {
                await financeService.updateCreditCard(card.id, {
                    name: name.trim(),
                    bank: effectiveBank,
                    last4: last4 || null,
                    billing_day: bDay,
                    due_day: dDay,
                    credit_limit: numericLimit,
                    color,
                    owner_id: ownerId,
                });
            } else {
                const input: CreateCreditCardInput = {
                    name: name.trim(),
                    bank: effectiveBank,
                    last4: last4 || null,
                    billing_day: bDay,
                    due_day: dDay,
                    credit_limit: numericLimit,
                    color,
                    owner_id: ownerId,
                };
                await financeService.addCreditCard(input);
            }

            onCardSaved?.();
            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to save credit card");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title={isEditing ? "Edit Credit Card" : "Add Credit Card"}
                    subtitle="Track statements, billing cycles, and due dates"
                    icon={<CreditCard className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {errorMessage && (
                        <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                            {errorMessage}
                        </div>
                    )}

                    {/* Card Name */}
                    <div>
                        <label htmlFor="card-name" className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            Card Name *
                        </label>
                        <input
                            id="card-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. DBS Altitude Visa, UOB One Card"
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            required
                        />
                    </div>

                    {/* Bank & Last 4 Digits */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="card-bank" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <Building className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Issuing Bank *</span>
                            </label>
                            <Select
                                id="card-bank"
                                value={bank}
                                onChange={(e) => setBank(e.target.value)}
                                className="bg-(--bg-canvas)"
                            >
                                {PRESET_BANKS.map((b) => (
                                    <option key={b} value={b}>
                                        {b}
                                    </option>
                                ))}
                            </Select>
                            {bank === "Other" && (
                                <input
                                    type="text"
                                    value={customBank}
                                    onChange={(e) => setCustomBank(e.target.value)}
                                    placeholder="Enter bank name"
                                    className="mt-2 w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-xs text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            )}
                        </div>

                        <div>
                            <label htmlFor="card-last4" className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                Last 4 Digits
                            </label>
                            <input
                                id="card-last4"
                                type="text"
                                maxLength={4}
                                value={last4}
                                onChange={(e) => setLast4(e.target.value.replace(/\D/g, ""))}
                                placeholder="1234"
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm font-mono-num text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                        </div>
                    </div>

                    {/* Statement Date & Due Date */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="card-billing-day" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <Calendar className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Statement Day</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-(--text-muted)">Day</span>
                                <input
                                    id="card-billing-day"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={billingDay}
                                    onChange={(e) => setBillingDay(parseInt(e.target.value) || 1)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-sm font-mono-num font-bold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                                <span className="text-xs text-(--text-muted)">of month</span>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="card-due-day" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <Calendar className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Payment Due Day</span>
                            </label>
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-(--text-muted)">Day</span>
                                <input
                                    id="card-due-day"
                                    type="number"
                                    min={1}
                                    max={31}
                                    value={dueDay}
                                    onChange={(e) => setDueDay(parseInt(e.target.value) || 1)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-sm font-mono-num font-bold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                                <span className="text-xs text-(--text-muted)">of month</span>
                            </div>
                        </div>
                    </div>

                    {/* Credit Limit & Card Owner */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="card-limit" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <DollarSign className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Credit Limit</span>
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">S$</span>
                                <input
                                    id="card-limit"
                                    type="number"
                                    step="100"
                                    min="0"
                                    value={creditLimit}
                                    onChange={(e) => setCreditLimit(e.target.value)}
                                    placeholder="e.g. 10000"
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-9 pr-3.5 py-2 text-sm font-mono-num font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>
                        </div>

                        <div>
                            <label htmlFor="card-owner" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <User className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Cardholder</span>
                            </label>
                            <Select
                                id="card-owner"
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                className="bg-(--bg-canvas)"
                            >
                                {members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.display_name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Color Presets */}
                    <div>
                        <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-2">
                            <Palette className="h-3.5 w-3.5 text-(--text-muted)" />
                            <span>Card Color Badge</span>
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            {PRESET_COLORS.map((c) => (
                                <button
                                    key={c.hex}
                                    type="button"
                                    title={c.label}
                                    onClick={() => setColor(c.hex)}
                                    className={`h-7 w-7 rounded-full border-2 border-(--border-ink) transition-transform cursor-pointer ${
                                        color === c.hex
                                            ? "ring-2 ring-purple-600 scale-110 shadow-cute-sm"
                                            : "hover:scale-105 opacity-80 hover:opacity-100"
                                    }`}
                                    style={{ backgroundColor: c.hex }}
                                />
                            ))}
                        </div>
                    </div>
                </ModalBody>

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
                        {isSubmitting ? "Saving..." : isEditing ? "Save Changes" : "Add Credit Card"}
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddEditCreditCardModal;
