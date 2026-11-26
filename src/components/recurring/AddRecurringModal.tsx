/**
 * AddRecurringModal Component
 * Dialog modal for creating or editing recurring items (insurance, tax, subscriptions, bills, other).
 * Features:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Pre-filling for editing existing recurring items
 * - Field validation (Name required, positive Amount)
 * - Frequency selector with conditional renewal month, due day and spend category
 * - Owner selector (partner one, partner two, Joint)
 * - Optional start and end dates (end must be on or after start)
 */

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Shield } from "lucide-react";
import type {
    Category,
    RecurringItem,
    RecurringItemType,
    RecurringFrequency,
    CreateRecurringItemInput,
    SavingsGoal,
} from "../../types/finance";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { isMockModeActive } from "../../services/financeService";
import { useLazyMockDefaults } from "../../hooks/useLazyMockDefaults";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Select } from "../ui/Select";
import { Input } from "../ui/Input";
import { CurrencyInput } from "../ui/CurrencyInput";
import { Textarea } from "../ui/Textarea";
import { formatShortMonth, MONTH_NAMES_FULL } from "../../lib/dateUtils";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { feedback } from "../../lib/delight/feedback";
import { filterCategoriesForMember } from "../../lib/financialFormulas";
import {
    findDefaultRecurringCategoryId,
    isSpendType,
    resolveGoalLinkedStartDate,
} from "../../lib/recurringItems";
import { Switch } from "../ui/Switch";
import { Alert } from "../ui/Alert";

function useSafeHousehold() {
    const ctx = useOptionalHousehold();
    const isMock = ctx?.isMockMode ?? isMockModeActive();
    const { members: mockMembers } = useLazyMockDefaults(!ctx && isMock);
    if (ctx) {
        return ctx;
    }
    return {
        members: isMock ? mockMembers : [],
        activeMember: null,
        perspective: "household" as const,
        setPerspective: () => {},
        theme: "light" as const,
        toggleTheme: () => {},
        isMockMode: isMock,
        overview: null,
        loading: false,
        refreshData: async () => {},
    };
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
    /** Household savings goals for optional goal-linked start date */
    goals?: SavingsGoal[];
}

const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_GOALS: SavingsGoal[] = [];
const GOAL_OFFSET_OPTIONS = [0, 3, 6, 9, 12, 18, 24] as const;

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
    goals = EMPTY_GOALS,
}: AddRecurringModalProps) {
    const { members, activeMember } = useSafeHousehold();
    const { me } = useLoggedInMember(members);

    // The member in view, else the member using this device, else joint
    const defaultOwnerId = activeMember?.id || me?.id || "joint";

    // Form states
    const [name, setName] = useState<string>("");
    const [type, setType] = useState<RecurringItemType>("insurance");
    const [ownerId, setOwnerId] = useState<string>(defaultOwnerId);
    const [amount, setAmount] = useState<string>("");
    const [frequency, setFrequency] = useState<RecurringFrequency>("annually");
    const [paymentMonth, setPaymentMonth] = useState<number>(1);
    const [dueDay, setDueDay] = useState<string>("");
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [notes, setNotes] = useState<string>("");
    // null = not chosen yet, falls back to the household's lifestyle category
    const [categoryId, setCategoryId] = useState<string | null>(null);
    const [paidFromCpfOa, setPaidFromCpfOa] = useState<boolean>(false);
    const [goalId, setGoalId] = useState<string>("");
    const [goalOffsetMonths, setGoalOffsetMonths] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    const linkableGoals = useMemo(
        () =>
            goals.filter(
                (g) => g.status !== "achieved" || g.id === initialItem?.goal_id,
            ),
        [goals, initialItem?.goal_id],
    );

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
                setEndDate(
                    initialItem.end_date
                        ? initialItem.end_date.substring(0, 10)
                        : "",
                );
                setNotes(initialItem.notes || "");
                setCategoryId(initialItem.category_id ?? "");
                setPaidFromCpfOa(!!initialItem.paid_from_cpf_oa);
                setGoalId(initialItem.goal_id ?? "");
                setGoalOffsetMonths(initialItem.goal_offset_months ?? 0);
            } else {
                setName("");
                setType("insurance");
                setOwnerId(defaultOwnerId);
                setAmount("");
                setFrequency("annually");
                setPaymentMonth(1);
                setDueDay("");
                setStartDate("");
                setEndDate("");
                setNotes("");
                setCategoryId(null);
                setPaidFromCpfOa(false);
                setGoalId("");
                setGoalOffsetMonths(0);
            }
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [isOpen, initialItem, defaultOwnerId]);

    const scopedCategories = useMemo(
        () =>
            filterCategoriesForMember(
                categories,
                ownerId === "joint" ? undefined : ownerId,
            ),
        [categories, ownerId],
    );

    if (!isOpen) return null;

    const showCategory = isSpendType(type);
    const selectedCategoryId =
        categoryId ?? findDefaultRecurringCategoryId(scopedCategories) ?? "";
    const linkedGoal = goalId
        ? (goals.find((g) => g.id === goalId) ?? null)
        : null;
    const effectiveStartDate = linkedGoal?.target_date
        ? resolveGoalLinkedStartDate(linkedGoal.target_date, goalOffsetMonths)
        : startDate;
    const offsetChoices = GOAL_OFFSET_OPTIONS.includes(
        goalOffsetMonths as (typeof GOAL_OFFSET_OPTIONS)[number],
    )
        ? GOAL_OFFSET_OPTIONS
        : [...GOAL_OFFSET_OPTIONS, goalOffsetMonths].sort((a, b) => a - b);

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

        if (effectiveStartDate && endDate && endDate < effectiveStartDate) {
            setErrorMessage("End date must be on or after start date.");
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
                start_date: effectiveStartDate || null,
                end_date: endDate || null,
                notes: notes.trim() || null,
                paid_from_cpf_oa: showCategory && paidFromCpfOa,
                goal_id: goalId || null,
                goal_offset_months: goalId ? goalOffsetMonths : null,
            };

            if (initialItem?.id) {
                payload.id = initialItem.id;
            }

            await onSave(payload);
            feedback.routine("save");
            onClose();
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to save recurring item",
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
                    title={isEditing ? "Edit Recurring" : "Add Recurring"}
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
                    <Input
                        id="recurring-name"
                        label="Name *"
                        type="text"
                        placeholder="e.g. Netflix, gym, phone plan, cloud storage"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    {/* Type and Owner grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <Select
                                id="recurring-type"
                                label="Type"
                                value={type}
                                onChange={(e) =>
                                    setType(e.target.value as RecurringItemType)
                                }
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

                        {members.length > 0 && (
                            <div>
                                <Select
                                    id="recurring-owner"
                                    label="Owner"
                                    value={ownerId}
                                    onChange={(e) => setOwnerId(e.target.value)}
                                >
                                    {members.map((m) => (
                                        <option key={m.id} value={m.id}>
                                            👤 {m.display_name}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                    </div>

                    {/* Spend category (subscription / bill / other only) */}
                    {showCategory && (
                        <div>
                            <Select
                                id="recurring-category"
                                label="Category"
                                value={selectedCategoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                            >
                                <option value="">No category</option>
                                {scopedCategories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    )}

                    {/* Amount & Frequency grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <CurrencyInput
                            id="recurring-amount"
                            label="Amount *"
                            min="0.01"
                            placeholder="1200.00"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                        />

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
                            >
                                <option value="annually">Yearly</option>
                                <option value="monthly">Monthly</option>
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
                            />
                        </div>
                    </div>

                    {/* Link to goal (optional) */}
                    {linkableGoals.length > 0 && (
                        <div className="space-y-2 rounded-xl border-2 border-(--border-subtle) bg-(--bg-cream) p-3">
                            <div
                                className={`grid gap-3 ${
                                    goalId
                                        ? "grid-cols-1 sm:grid-cols-2"
                                        : "grid-cols-1"
                                }`}
                            >
                                <Select
                                    id="recurring-goal-link"
                                    label="Link to goal"
                                    value={goalId}
                                    onChange={(e) => setGoalId(e.target.value)}
                                >
                                    <option value="">None (manual date)</option>
                                    {linkableGoals.map((g) => (
                                        <option key={g.id} value={g.id}>
                                            {g.emoji} {g.title} (
                                            {formatShortMonth(g.target_date)})
                                        </option>
                                    ))}
                                </Select>
                                {goalId && (
                                    <Select
                                        id="recurring-goal-offset"
                                        label="Offset"
                                        value={goalOffsetMonths}
                                        onChange={(e) =>
                                            setGoalOffsetMonths(
                                                Number(e.target.value),
                                            )
                                        }
                                    >
                                        {offsetChoices.map((m) => (
                                            <option key={m} value={m}>
                                                {m === 0
                                                    ? "At goal date"
                                                    : `+${m} months`}
                                            </option>
                                        ))}
                                    </Select>
                                )}
                            </div>
                            {linkedGoal && effectiveStartDate && (
                                <p className="text-xs font-bold text-(--text-muted)">
                                    Starts{" "}
                                    <span className="font-mono-num text-(--text-ink)">
                                        {formatShortMonth(effectiveStartDate)}
                                    </span>{" "}
                                    ({effectiveStartDate}) — moves if goal is
                                    delayed
                                </p>
                            )}
                        </div>
                    )}

                    {/* Start & End Dates */}
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            id="recurring-start-date"
                            label={linkedGoal ? "Start (from goal)" : "Start"}
                            type="date"
                            value={effectiveStartDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            disabled={Boolean(linkedGoal)}
                            mono
                        />
                        <Input
                            id="recurring-end-date"
                            label="End (Optional)"
                            type="date"
                            min={effectiveStartDate || undefined}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            mono
                        />
                    </div>

                    {showCategory && (
                        <Switch
                            id="recurring-paid-from-cpf-oa"
                            label="Paid from CPF OA"
                            hint="Counts against CPF OA growth, not cash savings."
                            checked={paidFromCpfOa}
                            onChange={setPaidFromCpfOa}
                        />
                    )}

                    {/* Notes */}
                    <Textarea
                        label="Notes"
                        id="recurring-notes"
                        rows={2}
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="e.g. GIRO deduction, hospital plan rider details..."
                    />
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
