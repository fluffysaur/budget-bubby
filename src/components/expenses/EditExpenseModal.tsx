/**
 * Edit Expense Modal
 * Full-featured modal for editing an existing expense:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Numeric amount input with multi-currency conversion (SGD, VND, JPY, MYR, USD, etc.)
 * - Category picker with color badges
 * - Payer selector (Yi Jia / Rachel)
 * - Shared toggle (50/50 or custom split ratio)
 * - Date picker & remarks notes
 * - Tag editor with contextual quick tags
 * - Updates expense via financeService.updateExpense and notifies onSave
 */

import { useState, useEffect, useMemo, type FormEvent } from "react";
import {
    Save,
    ArrowRightLeft,
    AlertCircle,
} from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { CentsFirstAmountInput } from "./CentsFirstAmountInput";
import { financeService } from "../../services/financeService";
import {
    SUPPORTED_CURRENCIES,
    convertToSGD,
} from "../../lib/currencyConverter";
import { formatSGD } from "../../lib/currency";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import type { Expense, Category, HouseholdMember, UpdateExpenseInput, SavingsGoal } from "../../types/finance";

export interface EditExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    expense: Expense | null;
    onSave?: (updatedExpense: Expense) => void;
    categories?: Category[];
    members?: HouseholdMember[];
}

const QUICK_TAG_SUGGESTIONS = [
    "Lunch",
    "Dinner",
    "Coffee",
    "Groceries",
    "Hawker",
    "Grab",
    "MRT / Bus",
    "Shopping",
    "Date Night",
    "Utilities",
    "Medical",
];

export function EditExpenseModal({
    isOpen,
    onClose,
    expense,
    onSave,
    categories: propCategories,
    members: propMembers,
}: EditExpenseModalProps) {
    const categories = propCategories && propCategories.length > 0 ? propCategories : mockCategories;
    const members = propMembers && propMembers.length > 0 ? propMembers : mockMembers;

    const [amount, setAmount] = useState<number>(0);
    const [currency, setCurrency] = useState<string>("SGD");
    const [item, setItem] = useState<string>("");
    const [categoryId, setCategoryId] = useState<string>("");
    const [payerId, setPayerId] = useState<string>("");
    const [date, setDate] = useState<string>("");
    const [remarks, setRemarks] = useState<string>("");
    const [isShared, setIsShared] = useState<boolean>(true);
    const [splitRatio, setSplitRatio] = useState<number>(0.5);
    const [tags, setTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>("");
    const [goalId, setGoalId] = useState<string>("");
    const [availableGoals, setAvailableGoals] = useState<SavingsGoal[]>([]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Load goals for linking
    useEffect(() => {
        if (isOpen) {
            financeService
                .getGoals()
                .then((goals) => {
                    setAvailableGoals(goals || []);
                })
                .catch(() => {});
        }
    }, [isOpen]);

    // Sync form state when expense changes or modal opens
    useEffect(() => {
        if (expense && isOpen) {
            const origCurr = expense.original_currency || "SGD";
            setCurrency(origCurr);
            setAmount(
                expense.original_amount !== undefined && expense.original_amount !== null
                    ? expense.original_amount
                    : expense.amount,
            );
            setItem(expense.item);
            setCategoryId(expense.category_id || "");
            setPayerId(expense.payer_id || members[0]?.id || "");
            setDate(expense.date);
            setRemarks(expense.remarks || "");
            setIsShared(expense.is_shared);
            setSplitRatio(expense.split_ratio ?? 0.5);
            setTags(expense.tags ? [...expense.tags] : []);
            setGoalId(expense.goal_id || "");
            setErrorMessage(null);
        }
    }, [expense, isOpen, members]);

    // Currency configuration
    const currentCurrencyConfig = useMemo(() => {
        return SUPPORTED_CURRENCIES.find((c) => c.code === currency) || SUPPORTED_CURRENCIES[0];
    }, [currency]);

    // Computed SGD equivalent if foreign currency
    const convertedPreview = useMemo(() => {
        if (currency === "SGD") return null;
        return convertToSGD(amount, currency);
    }, [amount, currency]);

    // Add a tag
    const handleAddTag = (tagToAdd: string) => {
        const clean = tagToAdd.trim().replace(/^#/, "");
        if (!clean) return;
        if (!tags.includes(clean)) {
            setTags((prev) => [...prev, clean]);
        }
        setNewTagInput("");
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags((prev) => prev.filter((t) => t !== tagToRemove));
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!expense) return;

        if (!item.trim()) {
            setErrorMessage("Please enter an item description.");
            return;
        }
        if (amount <= 0) {
            setErrorMessage("Please enter a valid amount greater than 0.");
            return;
        }
        if (!date) {
            setErrorMessage("Please select a valid date.");
            return;
        }

        try {
            setIsSubmitting(true);
            setErrorMessage(null);

            const { amountInSGD, exchangeRate } = convertToSGD(amount, currency);

            const updates: UpdateExpenseInput = {
                payer_id: payerId,
                category_id: categoryId || null,
                date,
                item: item.trim(),
                amount: amountInSGD,
                original_amount: currency !== "SGD" ? amount : null,
                original_currency: currency,
                exchange_rate: currency !== "SGD" ? exchangeRate : null,
                remarks: remarks.trim() || null,
                is_shared: isShared,
                split_ratio: isShared ? splitRatio : 0.5,
                tags: tags.map((t) => t.trim()).filter(Boolean),
                goal_id: goalId || null,
            };

            const updated = await financeService.updateExpense(expense.id, updates);
            onSave?.(updated);
            onClose();
        } catch (err) {
            console.error("Failed to update expense:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to save changes.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!expense) return null;

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Edit Expense"
                    subtitle="Update amount, split, tags, or details"
                    icon={<Save className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-butter-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {errorMessage && (
                        <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            <AlertCircle className="h-4 w-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Amount and Currency */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                Amount &amp; Currency
                            </label>
                            <select
                                aria-label="Select currency"
                                value={currency}
                                onChange={(e) => setCurrency(e.target.value)}
                                className="rounded-full border border-(--border-subtle) hover:border-(--border-ink) bg-(--bg-canvas) px-2.5 py-1 text-xs font-bold text-(--text-ink) cursor-pointer focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            >
                                {SUPPORTED_CURRENCIES.map((c) => (
                                    <option key={c.code} value={c.code}>
                                        {c.flag} {c.code} ({c.symbol})
                                    </option>
                                ))}
                            </select>
                        </div>

                        <CentsFirstAmountInput
                            value={amount}
                            onChange={setAmount}
                            currencySymbol={currentCurrencyConfig.symbol}
                            autoFocus
                            id="edit-expense-amount"
                            aria-label="Edit expense amount"
                        />

                        {convertedPreview && (
                            <div className="mt-2 text-center text-xs font-bold text-(--text-ink) bg-(--pastel-butter-light) rounded-lg p-2 border border-(--border-ink)">
                                ≈ {formatSGD(convertedPreview.amountInSGD)} SGD (Rate: 1 SGD ={" "}
                                {convertedPreview.exchangeRate.toLocaleString()} {currency})
                            </div>
                        )}
                    </div>

                    {/* Description / Item */}
                    <div>
                        <label
                            htmlFor="edit-expense-item"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Item Description *
                        </label>
                        <input
                            id="edit-expense-item"
                            type="text"
                            required
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            placeholder="e.g. Lunch at Maxwell, Groceries, Grab"
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2.5 text-sm font-semibold text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Category Selection */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-2">
                            Category
                        </label>
                        <div className="flex flex-wrap gap-2">
                            {categories.map((cat) => {
                                const isSelected = categoryId === cat.id;
                                return (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        onClick={() => setCategoryId(cat.id)}
                                        className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                            isSelected
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                                : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                        }`}
                                    >
                                        <span
                                            className="h-2 w-2 rounded-full border border-black/20"
                                            style={{ backgroundColor: cat.color || "#dfc2ff" }}
                                        />
                                        <span>{cat.name}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Payer and Date Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Payer */}
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                Paid By
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                {members.slice(0, 2).map((m) => {
                                    const isSelected = payerId === m.id;
                                    return (
                                        <button
                                            key={m.id}
                                            type="button"
                                            onClick={() => setPayerId(m.id)}
                                            className={`flex items-center justify-center gap-2 rounded-xl p-2.5 text-xs font-bold transition-all cursor-pointer ${
                                                isSelected
                                                    ? "border-2 border-(--border-ink) bg-(--pastel-butter) text-(--text-ink) shadow-cute-sm"
                                                    : "border border-(--border-subtle) bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light)"
                                            }`}
                                        >
                                            <span>{m.avatar_url || "👤"}</span>
                                            <span>{m.display_name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Date */}
                        <div>
                            <label
                                htmlFor="edit-expense-date"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Date
                            </label>
                            <div className="relative">
                                <input
                                    id="edit-expense-date"
                                    type="date"
                                    required
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-xs font-mono-num font-semibold text-(--text-ink)"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Shared 50/50 & Split Ratio */}
                    <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-cute-sm space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ArrowRightLeft className="h-4 w-4 text-(--text-ink)" />
                                <span className="text-xs font-bold text-(--text-ink)">
                                    Shared Couple Expense
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isShared}
                                onClick={() => setIsShared(!isShared)}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-hidden ${
                                    isShared ? "bg-(--pastel-lilac)" : "bg-(--bg-canvas)"
                                }`}
                            >
                                <span
                                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-(--border-ink) shadow-xs transition duration-200 ease-in-out mt-0.5 ml-0.5 ${
                                        isShared ? "translate-x-5 bg-white" : "translate-x-0"
                                    }`}
                                />
                            </button>
                        </div>

                        {isShared && (
                            <div className="pt-2 border-t border-(--border-subtle) space-y-1.5">
                                <div className="flex justify-between text-xs font-medium text-(--text-ink)">
                                    <span>Partner's Split Share</span>
                                    <span className="font-bold text-(--text-ink)">
                                        {Math.round(splitRatio * 100)}% ({formatSGD(amount * splitRatio)})
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={splitRatio}
                                    onChange={(e) => setSplitRatio(parseFloat(e.target.value))}
                                    className="w-full accent-purple-600 cursor-pointer"
                                />
                                <div className="flex justify-between text-[10px] text-(--text-muted)">
                                    <span>0% (Full Payer)</span>
                                    <span className="font-semibold text-(--text-ink)">50/50</span>
                                    <span>100% (Full Partner)</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            Tags
                        </label>
                        {/* Tag Pills */}
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mb-2">
                                {tags.map((tag) => (
                                    <span
                                        key={tag}
                                        className="inline-flex items-center gap-1 rounded-full bg-(--pastel-lilac-light) px-2.5 py-0.5 text-xs font-bold text-(--text-ink) border border-(--border-ink)"
                                    >
                                        #{tag}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveTag(tag)}
                                            aria-label={`Remove tag ${tag}`}
                                            className="ml-1 text-(--text-muted) hover:text-rose-600 cursor-pointer"
                                        >
                                            ×
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}

                        {/* Add Tag Input */}
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                        e.preventDefault();
                                        handleAddTag(newTagInput);
                                    }
                                }}
                                placeholder="Add tag (e.g. VietnamTrip, DateNight)..."
                                className="flex-1 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
                            <button
                                type="button"
                                onClick={() => handleAddTag(newTagInput)}
                                className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) hover:bg-(--pastel-butter-light) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-all"
                            >
                                + Add
                            </button>
                        </div>

                        {/* Contextual quick tags */}
                        <div className="flex flex-wrap gap-1 mt-2">
                            {QUICK_TAG_SUGGESTIONS.filter((s) => !tags.includes(s))
                                .slice(0, 6)
                                .map((suggested) => (
                                    <button
                                        key={suggested}
                                        type="button"
                                        onClick={() => handleAddTag(suggested)}
                                        className="rounded-full border border-(--border-subtle) hover:border-(--border-ink) bg-(--bg-canvas) hover:bg-(--pastel-butter-light) px-2 py-0.5 text-[11px] font-bold text-(--text-ink) cursor-pointer transition-all shadow-cute-sm"
                                    >
                                        +{suggested}
                                    </button>
                                ))}
                        </div>
                    </div>

                    {/* Goal Link (Optional) */}
                    {availableGoals.length > 0 && (
                        <div>
                            <label
                                htmlFor="edit-expense-goal"
                                className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                            >
                                Link to Savings Goal (Optional)
                            </label>
                            <select
                                id="edit-expense-goal"
                                value={goalId}
                                onChange={(e) => setGoalId(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-xs font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) cursor-pointer"
                            >
                                <option value="">None (Standard expense)</option>
                                {availableGoals.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {g.title} (Saved: {formatSGD(g.saved_so_far)} / {formatSGD(g.target_amount)})
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Remarks */}
                    <div>
                        <label
                            htmlFor="edit-expense-remarks"
                            className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Remarks / Notes
                        </label>
                        <textarea
                            id="edit-expense-remarks"
                            rows={2}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            placeholder="Add extra context, receipt notes, location..."
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
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
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) px-5 py-2.5 text-xs font-black text-(--text-ink) shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Save className="h-4 w-4 stroke-[2.5]" />
                        <span>{isSubmitting ? "Saving..." : "Save Changes"}</span>
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default EditExpenseModal;
