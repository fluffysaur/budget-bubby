/**
 * CreditCardTrackerSection Component
 * Full Credit Card Statements & Due Date Tracker:
 * - List configured credit cards (name, bank, last4, statement day, due day, limit, color)
 * - Select month (e.g. '2026-10') to see and log monthly statement balances
 * - Statement status: statement amount, due date ('Due in 4 days' or 'Overdue by 2 days'), and 1-tap Paid / Unpaid toggle with timestamp
 * - Summary cards: Total CC Bill Due this Month, Total Paid, Total Unpaid
 * - Add / Edit Credit Card modal to configure new cards or update billing/due days
 */

import {
    useState,
    useEffect,
    useCallback,
    useRef,
    useMemo,
    useContext,
    type FormEvent,
} from "react";
import { QueryClientContext, useQueryClient } from "@tanstack/react-query";
import { queryClient as defaultQueryClient } from "../../lib/queryClient";
import {
    CreditCard as CreditCardIcon,
    Plus,
    Calendar,
    CheckCircle2,
    AlertTriangle,
    Clock,
    Pencil,
    Trash2,
    ChevronLeft,
    ChevronRight,
    ReceiptText,
    DollarSign,
    FileCheck2,
} from "lucide-react";
import { Button } from "../ui/Button";
import { StatCard } from "../ui/StatCard";
import { CreditCardListSkeleton } from "../ui/PageSkeletons";
import { TruncatedText } from "../ui/TruncatedText";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { ConfirmModal } from "../ui/ConfirmModal";
import { financeService } from "../../services/financeService";
import { formatSGD } from "../../lib/currency";
import {
    getCurrentMonth,
    getTodayDateString,
    formatDisplayMonth,
    formatDisplayDate,
    addMonths,
} from "../../lib/dateUtils";
import { useFollowCurrentMonth } from "../../hooks/useCurrentMonth";
import { AddEditCreditCardModal } from "./AddEditCreditCardModal";
import type {
    CreditCard,
    CreditCardStatement,
    HouseholdMember,
    UpsertCreditCardStatementInput,
} from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface CreditCardTrackerSectionProps {
    members: HouseholdMember[];
    perspective?: string;
    activeMemberId?: string;
    className?: string;
}

// eslint-disable-next-line react-refresh/only-export-components
export function getRelativeDueLabel(
    dueDateStr: string,
    isPaid: boolean,
    paidAt?: string | null,
): {
    label: string;
    isOverdue: boolean;
    isDueToday: boolean;
    daysDiff: number;
} {
    if (isPaid) {
        const formatted = paidAt ? formatDisplayDate(paidAt.slice(0, 10)) : "";
        return {
            label: formatted ? `Paid on ${formatted}` : "Paid",
            isOverdue: false,
            isDueToday: false,
            daysDiff: 0,
        };
    }

    const todayStr = getTodayDateString();
    const todayParts = todayStr.split("-").map(Number);
    const dueParts = dueDateStr.split("-").map(Number);
    const today = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
    const due = new Date(dueParts[0], dueParts[1] - 1, dueParts[2]);

    const diffMs = due.getTime() - today.getTime();
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        const overdue = Math.abs(diffDays);
        return {
            label: `Overdue by ${overdue} day${overdue === 1 ? "" : "s"}`,
            isOverdue: true,
            isDueToday: false,
            daysDiff: diffDays,
        };
    } else if (diffDays === 0) {
        return {
            label: "Due today",
            isOverdue: false,
            isDueToday: true,
            daysDiff: 0,
        };
    } else {
        return {
            label: `Due in ${diffDays} day${diffDays === 1 ? "" : "s"}`,
            isOverdue: false,
            isDueToday: false,
            daysDiff: diffDays,
        };
    }
}

export function CreditCardTrackerSection({
    members,
    perspective = "household",
    activeMemberId,
    className = "",
}: CreditCardTrackerSectionProps) {
    const contextQueryClient = useContext(QueryClientContext);
    const queryClient = useQueryClient(contextQueryClient ?? defaultQueryClient);

    const [selectedMonth, setSelectedMonth] =
        useState<string>(getCurrentMonth);
    useFollowCurrentMonth(selectedMonth, setSelectedMonth);

    const [cards, setCards] = useState<CreditCard[]>([]);
    const [statements, setStatements] = useState<CreditCardStatement[]>([]);
    // Month whose data is currently loaded; skeletons show until it matches selectedMonth
    const [loadedMonth, setLoadedMonth] = useState<string | null>(null);
    const isLoading = loadedMonth !== selectedMonth;
    const latestMonthRef = useRef<string>(selectedMonth);

    // Card modal states
    const [isAddEditCardOpen, setIsAddEditCardOpen] = useState<boolean>(false);
    const [cardToEdit, setCardToEdit] = useState<CreditCard | null>(null);

    // Statement modal states
    const [isLogStatementOpen, setIsLogStatementOpen] =
        useState<boolean>(false);
    const [statementCard, setStatementCard] = useState<CreditCard | null>(null);
    const [existingStatement, setExistingStatement] =
        useState<CreditCardStatement | null>(null);
    const [stmtAmountInput, setStmtAmountInput] = useState<string>("");
    const [stmtDueDateInput, setStmtDueDateInput] = useState<string>("");
    const [stmtNotesInput, setStmtNotesInput] = useState<string>("");
    const [stmtError, setStmtError] = useState<string | null>(null);
    const [isSavingStmt, setIsSavingStmt] = useState<boolean>(false);

    // Delete card confirmation
    const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

    const loadData = useCallback(async () => {
        latestMonthRef.current = selectedMonth;
        try {
            const [allCards, monthStatements] = await Promise.all([
                financeService.getCreditCards(),
                financeService.getCreditCardStatements(selectedMonth),
            ]);
            // Ignore responses for a month the user has already switched away from
            if (latestMonthRef.current !== selectedMonth) return;
            setCards(allCards || []);
            setStatements(monthStatements || []);
        } catch (err) {
            console.error("Failed to load credit cards or statements:", err);
        } finally {
            if (latestMonthRef.current === selectedMonth) {
                setLoadedMonth(selectedMonth);
            }
        }
    }, [selectedMonth]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // Filter cards by perspective
    const filteredCards = useMemo(() => {
        return cards.filter((c) => {
            if (perspective === "household") return true;
            return !c.owner_id || c.owner_id === activeMemberId;
        });
    }, [cards, perspective, activeMemberId]);

    // Map card_id to statement for current month
    const statementMap = useMemo(() => {
        const map = new Map<string, CreditCardStatement>();
        for (const stmt of statements) {
            map.set(stmt.card_id, stmt);
        }
        return map;
    }, [statements]);

    // Financial Summaries for the selected month
    const { totalBillDue, totalPaid, totalUnpaid } = useMemo(() => {
        let dueSum = 0;
        let paidSum = 0;
        let unpaidSum = 0;

        for (const card of filteredCards) {
            const stmt = statementMap.get(card.id);
            if (stmt) {
                dueSum += stmt.statement_amount;
                if (stmt.is_paid) {
                    paidSum += stmt.statement_amount;
                } else {
                    unpaidSum += stmt.statement_amount;
                }
            }
        }

        return {
            totalBillDue: Math.round(dueSum * 100) / 100,
            totalPaid: Math.round(paidSum * 100) / 100,
            totalUnpaid: Math.round(unpaidSum * 100) / 100,
        };
    }, [filteredCards, statementMap]);

    // 1-Tap Toggle Paid / Unpaid
    const handleTogglePaid = async (stmt: CreditCardStatement) => {
        try {
            const nextPaid = !stmt.is_paid;
            const input: UpsertCreditCardStatementInput = {
                card_id: stmt.card_id,
                month: stmt.month,
                statement_amount: stmt.statement_amount,
                due_date: stmt.due_date,
                is_paid: nextPaid,
                paid_at: nextPaid ? new Date().toISOString() : null,
                notes: stmt.notes,
            };
            await financeService.upsertCreditCardStatement(input);
            queryClient.invalidateQueries({
                queryKey: ["finance", "credit-card-statements"],
            });
            await loadData();
        } catch (err) {
            console.error("Failed to toggle statement paid status:", err);
        }
    };

    // Open Log/Edit Statement Modal
    const handleOpenLogStatement = (card: CreditCard) => {
        const stmt = statementMap.get(card.id);
        setStatementCard(card);
        setExistingStatement(stmt || null);
        if (stmt) {
            setStmtAmountInput(String(stmt.statement_amount));
            setStmtDueDateInput(stmt.due_date);
            setStmtNotesInput(stmt.notes || "");
        } else {
            setStmtAmountInput("");
            // Calculate sensible default due date: next month on card's due_day
            const nextMonthStr = addMonths(selectedMonth, 1);
            const safeDay = String(Math.min(28, card.due_day || 5)).padStart(
                2,
                "0",
            );
            setStmtDueDateInput(`${nextMonthStr}-${safeDay}`);
            setStmtNotesInput("");
        }
        setStmtError(null);
        setIsLogStatementOpen(true);
    };

    const handleSaveStatement = async (e: FormEvent) => {
        e.preventDefault();
        if (!statementCard) return;
        setStmtError(null);

        const amount = parseFloat(stmtAmountInput);
        if (isNaN(amount) || amount < 0) {
            setStmtError(
                "Enter an amount",
            );
            return;
        }

        if (!stmtDueDateInput) {
            setStmtError("Please choose a due date");
            return;
        }

        try {
            setIsSavingStmt(true);
            await financeService.upsertCreditCardStatement({
                card_id: statementCard.id,
                month: selectedMonth,
                statement_amount: Math.round(amount * 100) / 100,
                due_date: stmtDueDateInput,
                notes: stmtNotesInput.trim() ? stmtNotesInput.trim() : null,
                is_paid: existingStatement ? existingStatement.is_paid : false,
                paid_at: existingStatement ? existingStatement.paid_at : null,
            });
            queryClient.invalidateQueries({
                queryKey: ["finance", "credit-card-statements"],
            });
            await loadData();
            setIsLogStatementOpen(false);
        } catch (err: unknown) {
            setStmtError(
                err instanceof Error ? err.message : "Failed to save statement",
            );
        } finally {
            setIsSavingStmt(false);
        }
    };

    const handleDeleteCard = async (cardId: string) => {
        try {
            await financeService.deleteCreditCard(cardId);
            setCardToDelete(null);
            queryClient.invalidateQueries({
                queryKey: ["finance", "credit-card-statements"],
            });
            await loadData();
        } catch (err) {
            console.error("Failed to delete credit card:", err);
        }
    };

    return (
        <div
            className={`space-y-5 ${className}`}
            data-testid="credit-card-tracker-section"
        >
            {/* Month Navigation & Add Card Action */}
            <div className="p-4 rounded-2xl bg-(--bg-card) border-2 border-(--border-ink) shadow-cute">
                <div
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    data-testid="credit-card-header-actions"
                >
                    {/* Month Stepper */}
                    <div className="flex w-full sm:w-auto items-center justify-between gap-1 rounded-xl border border-(--border-ink) bg-(--bg-canvas) p-1 shadow-cute-sm">
                        <button
                            type="button"
                            aria-label="Previous Month"
                            onClick={() =>
                                setSelectedMonth((m) => addMonths(m, -1))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-(--text-ink) hover:bg-(--pastel-butter-light) transition-colors cursor-pointer"
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </button>
                        <div className="px-2 text-xs font-mono-num font-bold text-(--text-ink) min-w-24 text-center">
                            {formatDisplayMonth(selectedMonth)}
                        </div>
                        <button
                            type="button"
                            aria-label="Next Month"
                            onClick={() =>
                                setSelectedMonth((m) => addMonths(m, 1))
                            }
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-(--text-ink) hover:bg-(--pastel-butter-light) transition-colors cursor-pointer"
                        >
                            <ChevronRight className="h-4 w-4" />
                        </button>
                    </div>

                    <Button
                        variant="primary"
                        size="sm"
                        aria-label="Add Credit Card"
                        className="w-full sm:w-auto min-h-11 sm:min-h-0 justify-center"
                        leftIcon={<Plus className="h-4 w-4 stroke-3" />}
                        onClick={() => {
                            setCardToEdit(null);
                            setIsAddEditCardOpen(true);
                        }}
                    >
                        Add Card
                    </Button>
                </div>
            </div>

            {/* 3 Summary Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatCard
                    title="Due"
                    loading={isLoading}
                    value={formatSGD(totalBillDue)}
                    subtitle={`${filteredCards.length} card${filteredCards.length === 1 ? "" : "s"}`}
                    icon={<ReceiptText className="h-4 w-4" />}
                    iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
                />

                <StatCard
                    title="Paid"
                    loading={isLoading}
                    value={formatSGD(totalPaid)}
                    icon={<FileCheck2 className="h-4 w-4" />}
                    iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                />

                <StatCard
                    title="Unpaid"
                    loading={isLoading}
                    value={formatSGD(totalUnpaid)}
                    subtitle={totalUnpaid > 0 ? "Pending" : "All paid"}
                    icon={<AlertTriangle className="h-4 w-4" />}
                    iconBg={
                        totalUnpaid > 0
                            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                    }
                />
            </div>

            {/* Card Listing */}
            {isLoading ? (
                <CreditCardListSkeleton />
            ) : filteredCards.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
                    <CreditCardIcon className="h-10 w-10 text-(--text-faint) mb-3" />
                    <h3 className="text-sm font-bold text-slate-800 dark:text-white">
                        No Cards
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-(--text-faint) max-w-sm mt-1">
                        Add a card to track statements.
                    </p>
                    <Button
                        variant="primary"
                        size="sm"
                        className="mt-4"
                        leftIcon={<Plus className="h-4 w-4" />}
                        onClick={() => {
                            setCardToEdit(null);
                            setIsAddEditCardOpen(true);
                        }}
                    >
                        Add Card
                    </Button>
                </div>
            ) : (
                <div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
                    data-testid="credit-card-list"
                >
                    {filteredCards.map((card) => {
                        const stmt = statementMap.get(card.id);
                        const owner = members.find(
                            (m) => m.id === card.owner_id,
                        );
                        const dueStatus = stmt
                            ? getRelativeDueLabel(
                                  stmt.due_date,
                                  stmt.is_paid,
                                  stmt.paid_at,
                              )
                            : null;

                        return (
                            <div
                                key={card.id}
                                data-testid={`credit-card-card-${card.id}`}
                                className="flex flex-col justify-between rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-5 shadow-cute-sm hover:shadow-cute transition-press relative overflow-hidden"
                            >
                                {/* Color Top Stripe */}
                                <div
                                    className="absolute top-0 left-0 right-0 h-1.5"
                                    style={{
                                        backgroundColor:
                                            card.color || "#dfc2ff",
                                    }}
                                />

                                <div>
                                    {/* Card Header */}
                                    <div className="flex items-start justify-between gap-2 mt-1">
                                        <div className="flex items-center gap-2.5">
                                            <div
                                                className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-black text-xs shadow-cute-sm shrink-0 border border-(--border-ink)"
                                                style={{
                                                    backgroundColor:
                                                        card.color || "#dfc2ff",
                                                }}
                                            >
                                                {card.bank.slice(0, 4)}
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <h4 className="font-display font-black text-sm text-(--text-ink) truncate">
                                                    <TruncatedText text={card.name} />
                                                </h4>
                                                <div className="flex items-center gap-2 text-xs text-(--text-muted) mt-0.5">
                                                    {card.last4 && (
                                                        <span className="font-mono-num font-bold text-xs bg-(--bg-canvas) text-(--text-ink) border border-(--border-ink) px-1.5 py-0.5 rounded-md">
                                                            •••• {card.last4}
                                                        </span>
                                                    )}
                                                    <span className="font-semibold">
                                                        {card.bank}
                                                    </span>
                                                    {owner && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="font-semibold">
                                                                {
                                                                    owner.display_name
                                                                }
                                                            </span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                            <button
                                                type="button"
                                                aria-label={`Edit ${card.name}`}
                                                onClick={() => {
                                                    setCardToEdit(card);
                                                    setIsAddEditCardOpen(true);
                                                }}
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-ink) text-(--text-ink) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-colors cursor-pointer"
                                            >
                                                <Pencil className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                aria-label={`Delete ${card.name}`}
                                                onClick={() =>
                                                    setCardToDelete(card)
                                                }
                                                className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-ink) text-(--text-ink) hover:bg-(--pastel-coral-light) hover:text-rose-600 shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-colors cursor-pointer"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Card Configuration Specs */}
                                    <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) p-2.5 text-center text-xs shadow-cute-sm">
                                        <div>
                                            <span className="text-xs uppercase font-bold text-(--text-muted) block">
                                                Statement Day
                                            </span>
                                            <span className="font-mono-num font-bold text-(--text-ink)">
                                                {card.billing_day}th
                                            </span>
                                        </div>
                                        <div className="border-x border-(--border-subtle)">
                                            <span className="text-xs uppercase font-bold text-(--text-muted) block">
                                                Due Day
                                            </span>
                                            <span className="font-mono-num font-bold text-(--text-ink)">
                                                {card.due_day}th
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-xs uppercase font-bold text-(--text-muted) block">
                                                Limit
                                            </span>
                                            <span className="font-mono-num font-bold text-(--text-ink)">
                                                {card.credit_limit
                                                    ? formatSGD(
                                                          card.credit_limit,
                                                      )
                                                    : "No limit"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Statement Information for Selected Month */}
                                    <div className="mt-4 border-t border-(--border-subtle) pt-3">
                                        {stmt ? (
                                            <div className="space-y-2.5">
                                                <div className="flex items-baseline justify-between">
                                                    <span className="text-xs font-bold text-(--text-muted)">
                                                        Statement Amount
                                                    </span>
                                                    <span className="text-(--text-ink)">
                                                        <CurrencyText amount={stmt.statement_amount} size="md" />
                                                    </span>
                                                </div>

                                                {/* Due Date & Relative Status */}
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1.5 font-mono-num font-medium text-(--text-muted)">
                                                        <Calendar className="h-3.5 w-3.5" />
                                                        <span>
                                                            Due{" "}
                                                            {formatDisplayDate(
                                                                stmt.due_date,
                                                            )}
                                                        </span>
                                                    </div>

                                                    {dueStatus && (
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border border-(--border-ink) shadow-cute-sm ${
                                                                stmt.is_paid
                                                                    ? "bg-(--pastel-mint) text-(--text-ink)"
                                                                    : dueStatus.isOverdue
                                                                      ? "bg-(--pastel-coral-light) text-rose-800"
                                                                      : dueStatus.isDueToday
                                                                        ? "bg-(--pastel-butter) text-(--text-ink)"
                                                                        : "bg-(--pastel-lilac-light) text-(--text-ink)"
                                                            }`}
                                                        >
                                                            {stmt.is_paid ? (
                                                                <CheckCircle2 className="h-3 w-3" />
                                                            ) : dueStatus.isOverdue ? (
                                                                <AlertTriangle className="h-3 w-3" />
                                                            ) : (
                                                                <Clock className="h-3 w-3" />
                                                            )}
                                                            <span>
                                                                {
                                                                    dueStatus.label
                                                                }
                                                            </span>
                                                        </span>
                                                    )}
                                                </div>

                                                {stmt.notes && (
                                                    <p className="text-xs text-(--text-muted) italic line-clamp-1">
                                                        &ldquo;{stmt.notes}
                                                        &rdquo;
                                                    </p>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="py-2 text-center text-xs text-(--text-muted)">
                                                No statement
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Footer Actions: 1-Tap Paid / Unpaid Toggle & Log Statement */}
                                <div className="mt-4 border-t border-(--border-subtle) pt-3 flex items-center justify-between gap-2">
                                    {stmt ? (
                                        <>
                                            <button
                                                type="button"
                                                aria-label={
                                                    stmt.is_paid
                                                        ? `Mark ${card.name} statement as Unpaid`
                                                        : `Mark ${card.name} statement as Paid`
                                                }
                                                onClick={() =>
                                                    handleTogglePaid(stmt)
                                                }
                                                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border border-(--border-ink) shadow-cute-sm transition-press cursor-pointer ${
                                                    stmt.is_paid
                                                        ? "bg-(--pastel-mint) text-(--text-ink) hover:opacity-90"
                                                        : "bg-(--bg-card) hover:bg-(--pastel-mint-light) text-(--text-ink)"
                                                }`}
                                            >
                                                <CheckCircle2 className="h-3.5 w-3.5 text-(--text-ink)" />
                                                <span>
                                                    {stmt.is_paid
                                                        ? "Paid"
                                                        : "Mark as Paid"}
                                                </span>
                                            </button>

                                            <button
                                                type="button"
                                                aria-label={`Edit ${card.name} statement`}
                                                onClick={() =>
                                                    handleOpenLogStatement(card)
                                                }
                                                className="py-1.5 px-2.5 rounded-xl text-xs font-bold text-(--text-ink) bg-(--bg-canvas) hover:bg-(--pastel-butter-light) border border-(--border-ink) shadow-cute-sm transition-colors cursor-pointer shrink-0"
                                            >
                                                Edit
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            aria-label={`Log statement for ${card.name}`}
                                            onClick={() =>
                                                handleOpenLogStatement(card)
                                            }
                                            className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold text-(--text-ink) bg-(--pastel-lilac-light) hover:bg-(--pastel-lilac) border border-(--border-ink) shadow-cute-sm transition-colors cursor-pointer"
                                        >
                                            <Plus className="h-3.5 w-3.5 stroke-3" />
                                            <span>Log</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Add / Edit Card Modal */}
            <AddEditCreditCardModal
                isOpen={isAddEditCardOpen}
                onClose={() => setIsAddEditCardOpen(false)}
                card={cardToEdit}
                members={members}
                defaultOwnerId={activeMemberId}
                onCardSaved={loadData}
            />

            {/* Log / Edit Statement Modal */}
            <AnimatedModal
                isOpen={isLogStatementOpen}
                onClose={() => setIsLogStatementOpen(false)}
                maxWidth="max-w-md"
            >
                <form
                    onSubmit={handleSaveStatement}
                    className="flex flex-col min-h-0 flex-1 overflow-hidden"
                >
                    <ModalHeader
                        title={existingStatement ? "Edit Statement" : "Log Monthly Statement"}
                        subtitle={`${statementCard?.name || ""} • ${formatDisplayMonth(selectedMonth)}`}
                        icon={<ReceiptText className="h-5 w-5" strokeWidth={2.5} />}
                        iconBgColor="bg-(--pastel-lilac)"
                        onClose={() => setIsLogStatementOpen(false)}
                    />

                    <ModalBody className="p-5 space-y-4">
                        {stmtError && (
                            <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                                {stmtError}
                            </div>
                        )}

                        <div>
                            <label
                                htmlFor="stmt-amount"
                                className="flex items-center gap-1 text-xs font-bold text-(--text-ink) mb-1"
                            >
                                <DollarSign className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Balance *</span>
                            </label>
                            <input
                                id="stmt-amount"
                                type="number"
                                step="0.01"
                                min="0"
                                value={stmtAmountInput}
                                onChange={(e) =>
                                    setStmtAmountInput(e.target.value)
                                }
                                placeholder="e.g. 842.50"
                                className="w-full rounded-xl border border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2.5 text-base font-bold text-(--text-ink) focus:border-purple-700 focus:outline-hidden"
                                required
                                autoFocus
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="stmt-due-date"
                                className="flex items-center gap-1 text-xs font-bold text-(--text-ink) mb-1"
                            >
                                <Calendar className="h-3.5 w-3.5 text-(--text-muted)" />
                                <span>Payment Due Date *</span>
                            </label>
                            <input
                                id="stmt-due-date"
                                type="date"
                                value={stmtDueDateInput}
                                onChange={(e) =>
                                    setStmtDueDateInput(e.target.value)
                                }
                                className="w-full rounded-xl border border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-base sm:text-sm text-(--text-ink) focus:border-purple-700 focus:outline-hidden"
                                required
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="stmt-notes"
                                className="block text-xs font-bold text-(--text-ink) mb-1"
                            >
                                Notes
                            </label>
                            <input
                                id="stmt-notes"
                                type="text"
                                value={stmtNotesInput}
                                onChange={(e) =>
                                    setStmtNotesInput(e.target.value)
                                }
                                placeholder="e.g. Miles & dining, Shopee rebate"
                                className="w-full rounded-xl border border-(--border-ink) bg-(--bg-canvas) px-3 py-2 text-base sm:text-sm text-(--text-ink) focus:border-purple-700 focus:outline-hidden"
                            />
                        </div>
                    </ModalBody>

                    <ModalFooter className="justify-end gap-2">
                        <Button
                            variant="secondary"
                            type="button"
                            onClick={() => setIsLogStatementOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="primary"
                            type="submit"
                            disabled={isSavingStmt}
                        >
                            {isSavingStmt ? "Saving..." : "Save Statement"}
                        </Button>
                    </ModalFooter>
                </form>
            </AnimatedModal>

            {/* Delete Card Confirmation Modal */}
            {cardToDelete && (
                <ConfirmModal
                    isOpen={true}
                    onClose={() => setCardToDelete(null)}
                    onConfirm={() => handleDeleteCard(cardToDelete.id)}
                    title={`Delete ${cardToDelete.name}?`}
                    confirmLabel="Delete"
                    variant="danger"
                    maxWidth="max-w-sm"
                >
                    <p className="text-xs text-(--text-muted) leading-relaxed">
                        Removes its statement history.
                    </p>
                </ConfirmModal>
            )}
        </div>
    );
}
