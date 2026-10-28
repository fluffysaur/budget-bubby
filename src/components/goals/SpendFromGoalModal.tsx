/**
 * SpendFromGoalModal Component
 * Quick spend logger with goal_id pre-selected:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Deducts from the goal's sinking fund balance
 * - Automatically tags the transaction with the goal's title
 * - Excludes the spend from normal monthly category spendable caps
 */

import { useState, useEffect, useRef, type FormEvent } from "react";
import { ShoppingBag, Calendar, DollarSign, Tag, User, Layers } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { financeService } from "../../services/financeService";
import { getTodayDateString } from "../../lib/dateUtils";
import { formatSGD } from "../../lib/currency";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import type { SavingsGoal, Category, HouseholdMember, CreateExpenseInput } from "../../types/finance";

export interface SpendFromGoalModalProps {
    isOpen: boolean;
    onClose: () => void;
    goal: SavingsGoal | null;
    categories?: Category[];
    members?: HouseholdMember[];
    defaultPayerId?: string;
    onSpendSaved?: () => void;
}

export function SpendFromGoalModal({
    isOpen,
    onClose,
    goal,
    categories = mockCategories,
    members = mockMembers,
    defaultPayerId,
    onSpendSaved,
}: SpendFromGoalModalProps) {
    const amountInputRef = useRef<HTMLInputElement>(null);

    const [amount, setAmount] = useState<string>("");
    const [item, setItem] = useState<string>("");
    const [categoryId, setCategoryId] = useState<string>(categories[0]?.id || "");
    const [payerId, setPayerId] = useState<string>(defaultPayerId || members[0]?.id || "");
    const [isShared, setIsShared] = useState<boolean>(true);
    const [date, setDate] = useState<string>(getTodayDateString());
    const [remarks, setRemarks] = useState<string>("");
    const [extraTag, setExtraTag] = useState<string>("");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && goal) {
            setAmount("");
            setItem("");
            setCategoryId(categories[0]?.id || "");
            setPayerId(defaultPayerId || members[0]?.id || "");
            setIsShared(true);
            setDate(getTodayDateString());
            setRemarks("");
            setExtraTag("");
            setErrorMessage(null);
            setIsSubmitting(false);

            setTimeout(() => {
                amountInputRef.current?.focus();
            }, 50);
        }
    }, [isOpen, goal, categories, members, defaultPayerId]);

    if (!goal) return null;

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        const numericAmount = parseFloat(amount);
        if (isNaN(numericAmount) || numericAmount <= 0) {
            setErrorMessage("Please enter a valid expense amount greater than S$0.00");
            amountInputRef.current?.focus();
            return;
        }

        if (!item.trim()) {
            setErrorMessage("Please enter an expense description (e.g. Banquet Deposit, Wedding Bands)");
            return;
        }

        // Prepare tags: automatically include the goal's title
        const tags = [goal.title];
        if (extraTag.trim()) {
            tags.push(extraTag.trim());
        }

        try {
            setIsSubmitting(true);
            const input: CreateExpenseInput = {
                payer_id: payerId,
                category_id: categoryId || null,
                date: date || getTodayDateString(),
                item: item.trim(),
                amount: numericAmount,
                remarks: remarks.trim() || null,
                is_shared: isShared,
                split_ratio: isShared ? 0.5 : 0.0,
                tags,
                goal_id: goal.id,
            };

            const created = await financeService.addExpense(input);
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("expenseAdded", { detail: created }),
                );
            }
            onSpendSaved?.();
            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to record goal spend");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden" data-testid="spend-from-goal-modal">
                <ModalHeader
                    title={`Spend from ${goal.title}`}
                    subtitle={`Fund balance: ${formatSGD(goal.saved_so_far)}`}
                    icon={<span className="text-xl">{goal.emoji || "🎯"}</span>}
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                {/* Notice Banner */}
                <div className="bg-(--pastel-butter-light) px-4 sm:px-5 py-2.5 border-b border-(--border-subtle) text-xs text-(--text-ink) flex items-center gap-2">
                    <ShoppingBag className="h-4 w-4 shrink-0 text-purple-600 dark:text-purple-400" />
                    <span>Deducts directly from sinking fund without affecting monthly category budgets.</span>
                </div>

                <ModalBody>
                    {errorMessage && (
                        <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900">
                            {errorMessage}
                        </div>
                    )}

                    {/* Amount Input */}
                    <div>
                        <label htmlFor="spend-amount" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            <DollarSign className="h-3.5 w-3.5 text-(--text-muted)" />
                            <span>Amount to Spend (SGD) *</span>
                        </label>
                        <div className="relative">
                            <span className="absolute left-3.5 top-2.5 text-base font-bold text-(--text-muted)">S$</span>
                            <input
                                id="spend-amount"
                                ref={amountInputRef}
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-10 pr-3.5 py-2.5 text-lg font-mono-num font-bold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                required
                            />
                        </div>
                    </div>

                    {/* Item / Description */}
                    <div>
                        <label htmlFor="spend-item" className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            Item / Description *
                        </label>
                        <input
                            id="spend-item"
                            type="text"
                            value={item}
                            onChange={(e) => setItem(e.target.value)}
                            placeholder={`e.g. ${goal.title} deposit / vendor invoice`}
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            required
                        />
                    </div>

                    {/* Category & Payer */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="spend-category" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <Layers className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Category</span>
                            </label>
                            <select
                                id="spend-category"
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-xs font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            >
                                {categories.map((c) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label htmlFor="spend-payer" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <User className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Payer</span>
                            </label>
                            <select
                                id="spend-payer"
                                value={payerId}
                                onChange={(e) => setPayerId(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-xs font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            >
                                {members.map((m) => (
                                    <option key={m.id} value={m.id}>
                                        {m.display_name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Date & Shared Toggle */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="spend-date" className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                <Calendar className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Date</span>
                            </label>
                            <input
                                id="spend-date"
                                type="date"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-xs font-mono-num font-semibold text-(--text-ink)"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                                Split Type
                            </label>
                            <button
                                type="button"
                                onClick={() => setIsShared((prev) => !prev)}
                                className={`w-full py-2 px-3 rounded-xl text-xs font-bold border-2 border-(--border-ink) transition-all cursor-pointer shadow-cute-sm ${
                                    isShared
                                        ? "bg-(--pastel-lilac) text-(--text-ink)"
                                        : "bg-(--pastel-butter) text-(--text-ink)"
                                }`}
                            >
                                {isShared ? "Shared (50/50)" : "Personal"}
                            </button>
                        </div>
                    </div>

                    {/* Tag Preview */}
                    <div>
                        <label className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted) mb-1.5">
                            <Tag className="h-3.5 w-3.5 text-(--text-muted)" />
                            <span>Spend Tag</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) shrink-0">
                                #{goal.title}
                            </span>
                            <input
                                type="text"
                                value={extraTag}
                                onChange={(e) => setExtraTag(e.target.value)}
                                placeholder="Additional tag (optional)"
                                className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                            />
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
                        {isSubmitting ? "Logging Spend..." : "Log & Deduct from Goal"}
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default SpendFromGoalModal;
