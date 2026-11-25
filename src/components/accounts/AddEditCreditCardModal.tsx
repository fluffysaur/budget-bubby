/**
 * Add / Edit Credit Card Modal
 * Configures credit cards with:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Card Name, Bank (free text), Last 4 Digits
 * - Statement / Billing Day of Month (1 - 31)
 * - Due Day of Month (1 - 31)
 * - Credit Limit (SGD)
 * - Card Color theme
 * - Card Owner selector
 */

import { useState, useEffect, type FormEvent } from "react";
import {
    CreditCard,
    Building,
    Calendar,
    Palette,
    Trash2,
} from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Input } from "../ui/Input";
import { Select } from "../ui/Select";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { financeService } from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import type {
    CreditCard as CreditCardType,
    HouseholdMember,
    CreateCreditCardInput,
} from "../../types/finance";

export interface AddEditCreditCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    card?: CreditCardType | null;
    members: HouseholdMember[];
    defaultOwnerId?: string;
    onCardSaved?: () => void;
    /** Called when the user chooses Delete; the parent owns the confirmation. */
    onDelete?: (card: CreditCardType) => void;
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

export function AddEditCreditCardModal({
    isOpen,
    onClose,
    card,
    members = [],
    defaultOwnerId,
    onCardSaved,
    onDelete,
}: AddEditCreditCardModalProps) {
    const isEditing = Boolean(card);
    const { me } = useLoggedInMember(members);
    const initialOwnerId = defaultOwnerId || me?.id || "";

    const [name, setName] = useState<string>("");
    const [bank, setBank] = useState<string>("");
    const [last4, setLast4] = useState<string>("");
    const [billingDay, setBillingDay] = useState<number | string>(15);
    const [dueDay, setDueDay] = useState<number | string>(5);
    const [creditLimit, setCreditLimit] = useState<string>("");
    const [color, setColor] = useState<string>(PRESET_COLORS[0].hex);
    const [ownerId, setOwnerId] = useState<string>(initialOwnerId);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen) {
            if (card) {
                setName(card.name);
                setBank(card.bank);
                setLast4(card.last4 || "");
                setBillingDay(card.billing_day || 15);
                setDueDay(card.due_day || 5);
                setCreditLimit(
                    card.credit_limit ? card.credit_limit.toString() : "",
                );
                setColor(card.color || PRESET_COLORS[0].hex);
                setOwnerId(card.owner_id || initialOwnerId);
            } else {
                setName("");
                setBank("");
                setLast4("");
                setBillingDay(15);
                setDueDay(5);
                setCreditLimit("");
                setColor(PRESET_COLORS[0].hex);
                setOwnerId(initialOwnerId);
            }
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, card, initialOwnerId]);

    if (!isOpen) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (!name.trim()) {
            setErrorMessage("Please enter a card name");
            return;
        }

        const effectiveBank = bank.trim();
        if (!effectiveBank) {
            setErrorMessage("Enter a bank");
            return;
        }

        if (last4 && (last4.length !== 4 || isNaN(Number(last4)))) {
            setErrorMessage("Last 4 digits only");
            return;
        }

        const bDay = Number(billingDay);
        const dDay = Number(dueDay);
        if (
            String(billingDay).trim() === "" ||
            isNaN(bDay) ||
            !Number.isInteger(bDay) ||
            bDay < 1 ||
            bDay > 31
        ) {
            setErrorMessage("Day must be 1-31");
            return;
        }
        if (
            String(dueDay).trim() === "" ||
            isNaN(dDay) ||
            !Number.isInteger(dDay) ||
            dDay < 1 ||
            dDay > 31
        ) {
            setErrorMessage("Day must be 1-31");
            return;
        }

        const numericLimit = creditLimit ? parseFloat(creditLimit) : null;
        if (
            numericLimit !== null &&
            (isNaN(numericLimit) || numericLimit < 0)
        ) {
            setErrorMessage("Please enter a valid credit limit");
            return;
        }

        if (!ownerId) {
            setErrorMessage("Please select a cardholder.");
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

            feedback.routine("save");
            onCardSaved?.();
            onClose();
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to save credit card",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
                <ModalHeader
                    title={isEditing ? "Edit Credit Card" : "Add Credit Card"}
                    icon={
                        <CreditCard className="h-4.5 w-4.5" strokeWidth={2.5} />
                    }
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
                    )}

                    <div className="space-y-3">
                        <Input
                            id="card-name"
                            label="Card Name *"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. DBS Altitude Visa, UOB One Card"
                            required
                        />

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                id="card-bank"
                                label="Issuing Bank"
                                type="text"
                                required
                                value={bank}
                                onChange={(e) => setBank(e.target.value)}
                                placeholder="e.g. DBS, OCBC, UOB"
                                leftIcon={
                                    <Building
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            />
                            <Input
                                id="card-last4"
                                label="Last 4 Digits"
                                type="text"
                                inputMode="numeric"
                                maxLength={4}
                                mono
                                value={last4}
                                onChange={(e) =>
                                    setLast4(e.target.value.replace(/\D/g, ""))
                                }
                                placeholder="1234"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <Input
                                id="card-billing-day"
                                label="Statement Day"
                                type="number"
                                min={1}
                                max={31}
                                mono
                                value={billingDay}
                                onChange={(e) => setBillingDay(e.target.value)}
                                leftIcon={
                                    <Calendar
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            />
                            <Input
                                id="card-due-day"
                                label="Payment Due Day"
                                type="number"
                                min={1}
                                max={31}
                                mono
                                value={dueDay}
                                onChange={(e) => setDueDay(e.target.value)}
                                leftIcon={
                                    <Calendar
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <CurrencyInput
                                id="card-limit"
                                label="Credit Limit"
                                step="100"
                                min="0"
                                value={creditLimit}
                                onChange={(e) => setCreditLimit(e.target.value)}
                                placeholder="e.g. 10000"
                            />
                            <Select
                                id="card-owner"
                                label="Cardholder"
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                            >
                                <option value="" disabled>
                                    Choose cardholder
                                </option>
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
                                    className={`relative h-7 w-7 rounded-full after:absolute after:-inset-2.5 after:content-[''] border-2 border-(--border-ink) transition-transform cursor-pointer ${
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
                    {isEditing && card && onDelete && (
                        <Button
                            variant="danger"
                            size="sm"
                            className="mr-auto"
                            onClick={() => onDelete(card)}
                            disabled={isSubmitting}
                            leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                        >
                            Delete
                        </Button>
                    )}
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={isSubmitting}
                        disabled={isSubmitting}
                    >
                        {isEditing ? "Save" : "Add Card"}
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddEditCreditCardModal;
