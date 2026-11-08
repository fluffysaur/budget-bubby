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
import { Trash2, ArrowRightLeft, Target } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { CategoryBadge } from "../ui/CategoryBadge";
import { Card } from "../ui/Card";
import { isMockModeActive } from "../../services/financeService";
import { formatForeignAmount } from "../../lib/currencyConverter";
import { formatDisplayDate } from "../../lib/dateUtils";
import { feedback } from "../../lib/delight/feedback";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import { useDeleteExpenseMutation } from "../../hooks/useFinanceQueries";
import type { Expense, Category, HouseholdMember } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface DeleteExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    expense: Expense | null;
    onDeleted?: (deletedId: string) => void;
    categories?: Category[];
    members?: HouseholdMember[];
    deleteMutation?: ReturnType<typeof useDeleteExpenseMutation>;
}

export function DeleteExpenseModal({
    isOpen,
    onClose,
    expense,
    onDeleted,
    categories: propCategories,
    members: propMembers,
    deleteMutation: propDeleteMutation,
}: DeleteExpenseModalProps) {
    const isMock = isMockModeActive();
    const categories = propCategories ?? (isMock ? mockCategories : []);
    const members = propMembers ?? (isMock ? mockMembers : []);
    const defaultDeleteMutation = useDeleteExpenseMutation();
    const deleteMutation = propDeleteMutation ?? defaultDeleteMutation;
    const isDeleting = deleteMutation.isPending;
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
        if (isDeleting) return;
        try {
            setErrorMessage(null);
            feedback.routine("delete");
            onDeleted?.(expense.id);
            await deleteMutation.mutateAsync(expense.id);
            onClose();
        } catch (err) {
            console.error("Failed to delete expense:", err);
            setErrorMessage(
                err instanceof Error
                    ? err.message
                    : "Failed to delete expense.",
            );
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Delete Expense?"
                    icon={
                        <Trash2
                            className="h-4.5 w-4.5 text-rose-600"
                            strokeWidth={2.5}
                        />
                    }
                    iconBgColor="bg-(--pastel-coral-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {errorMessage && (
                        <Alert variant="danger" className="mb-3">
                            {errorMessage}
                        </Alert>
                    )}

                    {/* Expense Summary Card */}
                    <Card elevation="sm" className="p-4 space-y-3 mb-3">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="font-bold text-(--text-ink) text-base truncate">
                                    {expense.item}
                                </h3>
                                {expense.remarks && (
                                    <p className="text-xs text-(--text-muted) mt-0.5">
                                        {expense.remarks}
                                    </p>
                                )}
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-(--text-ink)">
                                    <CurrencyText
                                        amount={expense.amount}
                                        size="md"
                                    />
                                </div>
                                {hasForeignCurrency && (
                                    <div className="text-[11px] font-mono-num font-semibold text-(--text-muted)">
                                        {formatForeignAmount(
                                            expense.original_amount!,
                                            expense.original_currency!,
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-(--border-subtle) text-xs">
                            {/* Category */}
                            {category && (
                                <CategoryBadge
                                    name={category.name}
                                    color={category.color}
                                    icon={category.icon}
                                    size="sm"
                                />
                            )}

                            {/* Payer */}
                            <span className="inline-flex items-center gap-1.5 rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2.5 py-0.5 font-semibold text-(--text-ink)">
                                <span>{payer?.avatar_url || "👤"}</span>
                                <span>{payer?.display_name || "Unknown"}</span>
                            </span>

                            {/* Date */}
                            <span className="text-(--text-muted) font-mono-num font-semibold text-xs ml-auto">
                                {formatDisplayDate(expense.date)}
                            </span>
                        </div>
                    </Card>

                    {/* Warning Alerts */}
                    <div className="space-y-2">
                        {expense.goal_id && (
                            <Alert
                                variant="warning"
                                title="Goal refunded"
                                icon={
                                    <Target
                                        className="h-4 w-4 text-amber-700"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                <CurrencyText amount={expense.amount} /> returns
                                to the goal.
                            </Alert>
                        )}

                        {expense.is_shared && (
                            <Alert
                                variant="info"
                                title="Settlement updates"
                                icon={
                                    <ArrowRightLeft
                                        className="h-4 w-4 text-purple-700"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                Shared total recalculates.
                            </Alert>
                        )}
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isDeleting}
                        aria-label={`Cancel delete ${expense.item}`}
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="danger"
                        onClick={handleDelete}
                        isLoading={isDeleting}
                        leftIcon={<Trash2 className="h-4 w-4" />}
                        aria-label={`Confirm delete ${expense.item}`}
                    >
                        Delete Expense
                    </Button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default DeleteExpenseModal;
