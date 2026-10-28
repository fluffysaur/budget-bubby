/**
 * Delete Expense Confirmation Modal
 * Replaces inline confirmation with an explicit, high-clarity dialog:
 * - AnimatedModal wrapper + ModalHeader / ModalBody / ModalFooter
 * - Shows expense item name, formatted amounts (SGD & foreign currency)
 * - Highlights payer, category, and date
 * - Clear warning alerts if deletion restores a linked savings goal or impacts shared couple settlement
 * - Confirms deletion via financeService.deleteExpense(id)
 */

import { useState } from "react";
import { Trash2, AlertTriangle, ArrowRightLeft, Target } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { financeService } from "../../services/financeService";
import { formatSGD } from "../../lib/currency";
import { formatForeignAmount } from "../../lib/currencyConverter";
import { formatDisplayDate } from "../../lib/dateUtils";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import type { Expense, Category, HouseholdMember } from "../../types/finance";

export interface DeleteExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    expense: Expense | null;
    onDeleted?: (deletedId: string) => void;
    categories?: Category[];
    members?: HouseholdMember[];
}

export function DeleteExpenseModal({
    isOpen,
    onClose,
    expense,
    onDeleted,
    categories = mockCategories,
    members = mockMembers,
}: DeleteExpenseModalProps) {
    const [isDeleting, setIsDeleting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    if (!expense) return null;

    const category = categories.find((c) => c.id === expense.category_id);
    const payer = members.find((m) => m.id === expense.payer_id);
    const hasForeignCurrency =
        expense.original_currency &&
        expense.original_currency !== "SGD" &&
        expense.original_amount !== undefined &&
        expense.original_amount !== null;

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            setErrorMessage(null);
            onDeleted?.(expense.id);
            await financeService.deleteExpense(expense.id);
            onClose();
        } catch (err) {
            console.error("Failed to delete expense:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to delete expense.");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Delete Expense?"
                    subtitle="This transaction will be permanently removed."
                    icon={<Trash2 className="h-4.5 w-4.5 stroke-[2.2] text-rose-600" />}
                    iconBgColor="bg-(--pastel-coral-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {errorMessage && (
                        <div className="flex items-center gap-2 rounded-xl border-2 border-(--border-ink) bg-(--pastel-coral-light) p-3 text-xs font-bold text-rose-700 shadow-cute-sm">
                            <AlertTriangle className="h-4 w-4 shrink-0" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Expense Summary Card */}
                    <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-cute-sm space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <div>
                                <h3 className="font-bold text-(--text-ink) text-base">
                                    {expense.item}
                                </h3>
                                {expense.remarks && (
                                    <p className="text-xs text-(--text-muted) mt-0.5">
                                        {expense.remarks}
                                    </p>
                                )}
                            </div>
                            <div className="text-right">
                                <div className="text-lg font-mono-num font-black text-(--text-ink)">
                                    {formatSGD(expense.amount)}
                                </div>
                                {hasForeignCurrency && (
                                    <div className="text-[11px] font-mono-num font-semibold text-(--text-muted)">
                                        {formatForeignAmount(expense.original_amount!, expense.original_currency!)}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-(--border-subtle) text-xs">
                            {/* Category */}
                            {category && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-(--border-ink) bg-(--bg-canvas) px-2.5 py-1 font-bold text-(--text-ink)">
                                    <span
                                        className="h-2 w-2 rounded-full border border-black/20"
                                        style={{ backgroundColor: category.color || "#dfc2ff" }}
                                    />
                                    <span>{category.name}</span>
                                </span>
                            )}

                            {/* Payer */}
                            <span className="inline-flex items-center gap-1.5 rounded-lg border border-(--border-ink) bg-(--bg-canvas) px-2.5 py-1 font-semibold text-(--text-ink)">
                                <span>{payer?.avatar_url || "👤"}</span>
                                <span>{payer?.display_name || "Unknown"}</span>
                            </span>

                            {/* Date */}
                            <span className="text-(--text-muted) font-mono-num font-semibold">
                                {formatDisplayDate(expense.date)}
                            </span>
                        </div>
                    </div>

                    {/* Warning Alerts */}
                    <div className="space-y-2">
                        {expense.goal_id && (
                            <div className="flex items-start gap-2.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-butter-light) p-3 text-xs font-medium text-(--text-ink) shadow-cute-sm">
                                <Target className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
                                <div>
                                    <span className="font-bold">Savings Goal Balance Restored:</span> Deleting this expense will return{" "}
                                    <span className="font-mono-num font-bold">{formatSGD(expense.amount)}</span> back to the linked savings goal balance.
                                </div>
                            </div>
                        )}

                        {expense.is_shared && (
                            <div className="flex items-start gap-2.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac-light) p-3 text-xs font-medium text-(--text-ink) shadow-cute-sm">
                                <ArrowRightLeft className="h-4 w-4 shrink-0 mt-0.5 text-purple-700" />
                                <div>
                                    <span className="font-bold">Couple Settlement Adjusted:</span> This was logged as a shared expense. Deleting it will recalculate who owes whom in the monthly summary.
                                </div>
                            </div>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        aria-label={`Cancel delete ${expense.item}`}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        aria-label={`Confirm delete ${expense.item}`}
                        className="inline-flex items-center gap-2 rounded-xl border-2 border-(--border-ink) bg-(--pastel-coral) px-5 py-2.5 text-xs font-black text-white shadow-cute-sm hover:bg-rose-700 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4" />
                        <span>{isDeleting ? "Deleting..." : "Delete Expense"}</span>
                    </button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default DeleteExpenseModal;
