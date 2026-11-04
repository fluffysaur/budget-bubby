/**
 * AddRecurringModal Component
 * Dialog modal for creating or editing recurring items (insurance, tax, subscriptions, bills, other).
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Pre-filling for editing existing recurring items
 * - Field validation (Name required, positive Amount)
 * - Frequency selector with conditional renewal month, due day and spend category
 * - Owner selector (Yi Jia, Rachel, Joint)
 */

import { useState, useEffect, type FormEvent } from "react";
import { Shield } from "lucide-react";
import type {
    Category,
    RecurringItem,
    RecurringItemType,
    RecurringFrequency,
    CreateRecurringItemInput,
} from "../../types/finance";
import { useHousehold } from "../../context/HouseholdContext";
import { mockMembers } from "../../data/mockSeedData";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { MONTH_NAMES_FULL } from "../../lib/dateUtils";
import {
    findDefaultRecurringCategoryId,
    isSpendType,
} from "../../lib/recurringItems";
import { Alert } from "../ui/Alert";

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

export interface AddRecurringModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (
        itemData: CreateRecurringItemInput & { id?: string },
    ) => void | Promise<void>;
    initialItem?: RecurringItem | null;
    /** Budget categories for the spend category picker (subscription/bill/other) */
    categories?: Category[];
}

const EMPTY_CATEGORIES: Category[] = [];

const MONTH_OPTIONS = MONTH_NAMES_FULL.map((label, idx) => ({
    value: idx + 1,
    label,
}));

export function AddRecurringModal({
    isOpen,
    onClose,
    onSave,
    initialItem = null,
    categories = EMPTY_CATEGORIES,
}: AddRecurringModalProps) {
    const { members, activeMember } = useSafeHousehold();

    // Find member IDs
    const yiJiaMember = members.find((m) =>
        m.display_name.toLowerCase().includes("yi jia"),
    );

    const defaultOwnerId =
        activeMember?.id || yiJiaMember?.id || "mem-00000000-0011";

    // Form states
    const [name, setName] = useState<string>("");
    const [type, setType] = useState<RecurringItemType>("insurance");
    const [ownerId, setOwnerId] = useState<string>(defaultOwnerId);
    const [amount, setAmount] = useState<string>("");
    const [frequency, setFrequency] = useState<RecurringFrequency>("annually");
    const [paymentMonth, setPaymentMonth] = useState<number>(1);
    const [dueDay, setDueDay] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    // null = not chosen yet, falls back to the household's lifestyle category
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Sync state when initialItem changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (initialItem) {
                setName(initialItem.name);
                setType(initialItem.type);
                setOwnerId(initialItem.owner_id);
                setAmount(String(initialItem.amount));
                setFrequency(initialItem.frequency);
                setPaymentMonth(initialItem.payment_month || 1);
                setDueDay(
                    initialItem.due_day ? String(initialItem.due_day) : "",
                );
                setStartDate(
                    initialItem.start_date
                        ? initialItem.start_date.substring(0, 10)
                        : "",
                );
                setNotes(initialItem.notes || "");
                setCategoryId(initialItem.category_id ?? "");
            } else {
                setName("");
                setType("insurance");
                setOwnerId(defaultOwnerId);
                setAmount("");
                setFrequency("annually");
                setPaymentMonth(1);
                setDueDay("");
                setStartDate("");
                setNotes("");
                setCategoryId(null);
            }
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, initialItem, defaultOwnerId]);

    if (!isOpen) return null;

    const showCategory = isSpendType(type);
    const selectedCategoryId =
        categoryId ?? findDefaultRecurringCategoryId(categories) ?? "";

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const trimmedName = name.trim();
        if (!trimmedName) {
            setErrorMessage("Name is required.");
            return;
        }

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setErrorMessage("Valid amount is required.");
            return;
        }

        const trimmedDueDay = dueDay.trim();
        const numericDueDay = Number(trimmedDueDay);
        if (frequency === "monthly" && !trimmedDueDay) {
            setErrorMessage("Due day is required for monthly items.");
            return;
        }
        if (
            trimmedDueDay &&
            (!Number.isInteger(numericDueDay) ||
                numericDueDay < 1 ||
                numericDueDay > 31)
        ) {
            setErrorMessage("Due day must be between 1 and 31.");
            return;
        }

        try {
            setIsSubmitting(true);
            const payload: CreateRecurringItemInput & { id?: string } = {
                name: trimmedName,
                type,
                owner_id: ownerId,
                amount: Math.round(numericAmount * 100) / 100,
                frequency,
                payment_month:
                    frequency === "annually" ? Number(paymentMonth) : null,
                due_day: trimmedDueDay ? numericDueDay : null,
                category_id: showCategory ? selectedCategoryId || null : null,
                start_date: startDate || null,
                notes: notes.trim() || null,
            };

            if (initialItem?.id) {
                payload.id = initialItem.id;
            }

            await onSave(payload);
            onClose();
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to save recurring item",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    const isEditing = Boolean(initialItem?.id);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
                <ModalHeader
                    id="modal-headline"
                    title={
                        isEditing
                            ? "Edit Recurring"
                            : "Add Recurring"
                    }
                    subtitle={
                        isEditing
                            ? "Update amount or due date"
                            : "Insurance, tax, subscriptions & bills"
                    }
                    icon={<Shield className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error notification */}
                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
                    )}

                    {/* Name */}
                    <div>
                        <label
                            htmlFor="recurring-name"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Name *
                        </label>
                        <input
                            id="recurring-name"
                            type="text"
                            placeholder="e.g. Netflix, gym, phone plan, cloud storage"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Type and Owner grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Select
                                id="recurring-type"
                                label="Type"
                                value={type}
                                onChange={(e) =>
                                    setType(
                                        e.target.value as RecurringItemType,
                                    )
                                }
                                className="bg-(--bg-canvas)"
                            >
                                <option value="insurance">🛡️ Insurance</option>
                                <option value="tax">🏛️ Tax</option>
                                <option value="subscription">
                                    📱 Subscription
                                </option>
                                <option value="bill">🧾 Bill</option>
                                <option value="other">📦 Other</option>
                            </Select>
                        </div>

                        <div>
                            <Select
                                id="recurring-owner"
                                label="Owner"
                                value={ownerId}
                                onChange={(e) => setOwnerId(e.target.value)}
                                className="bg-(--bg-canvas)"
                            >
                                {members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        👤 {m.display_name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>

                    {/* Spend category (subscription / bill / other only) */}
                    {showCategory && (
                        <div>
                            <Select
                                id="recurring-category"
                                label="Category"
                                value={selectedCategoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="bg-(--bg-canvas)"
                            >
                                <option value="">No category</option>
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}

                    {/* Amount & Frequency grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label
                                htmlFor="recurring-amount"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Amount *
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2 text-sm font-bold text-(--text-muted)">
                                    S$
                                </span>
                                <input
                                    id="recurring-amount"
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
                                id="recurring-frequency"
                                label="Frequency"
                                value={frequency}
                                onChange={(e) =>
                                    setFrequency(
                                        e.target.value as RecurringFrequency,
                                    )
                                }
                                className="bg-(--bg-canvas)"
                            >
                                <option value="annually">
                                    Once a year (Annual)
                                </option>
                                <option value="monthly">
                                    Every month (Monthly)
                                </option>
                            </Select>
                        </div>
                    </div>

                    {/* Renewal Month (annual only) & Due Day */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {frequency === "annually" && (
                            <div>
                                <Select
                                    id="recurring-month"
                                    label="Renewal Month"
                                    value={paymentMonth}
                                    onChange={(e) =>
                                        setPaymentMonth(Number(e.target.value))
                                    }
                                    className="bg-(--bg-canvas)"
                                >
                                    {MONTH_OPTIONS.map((m) => (
                                        <option key={m.value} value={m.value}>
                                            📅 {m.label}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                        <div>
                            <Input
                                id="recurring-due-day"
                                label={
                                    frequency === "monthly"
                                        ? "Due Day *"
                                        : "Due Day (Optional)"
                                }
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={31}
                                step={1}
                                placeholder="1-31"
                                value={dueDay}
                                onChange={(e) => setDueDay(e.target.value)}
                                mono
                                className="bg-(--bg-canvas)"
                            />
                        </div>
                    </div>

                    {/* Start Date */}
                    <div>
                        <label
                            htmlFor="recurring-start-date"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Start Date (Optional)
                        </label>
                        <input
                            id="recurring-start-date"
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs font-mono-num rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label
                            htmlFor="recurring-notes"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Notes
                        </label>
                        <textarea
                            id="recurring-notes"
                            rows={2}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="e.g. GIRO deduction, hospital plan rider details..."
                            className="w-full px-3.5 py-2 text-sm rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) resize-none"
                        />
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                        isLoading={isSubmitting}
                    >
                        {isSubmitting ? "Saving..." : "Save"}
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default AddRecurringModal;
