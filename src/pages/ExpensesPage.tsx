/**
 * Expenses Page
 * Minimal, Ledger-First Spend Hub:
 * - PageHeader with '+ Bulk Add' and 'Add Expense'
 * - Compact summary strip: Spendable, Total Spent, Shared Spending, and Unsettled (with Settle Up)
 * - Trend card and tag chips above the ledger, settle-up history below it
 */

import { useState, useEffect, useMemo } from "react";
import { Plus, Scale, CheckCircle2, ListPlus, PiggyBank } from "lucide-react";
import { InboxShortcutButton } from "../components/inbox/InboxShortcutButton";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    Button,
    StatCard,
    CollapsibleSection,
    ConfirmModal,
    Alert,
    MeterBar,
} from "../components/ui";
import {
    useRecurringItemsQuery,
    useBaseProfilesQuery,
    useBaseAllocationsQuery,
    useBudgetDetailQuery,
} from "../hooks/finance/budget";
import { useCategoriesQuery } from "../hooks/finance/categories";
import {
    useExpensesQuery,
    matchesExpenseFilter,
    useAllExpensesQuery,
    useAddExpenseMutation,
    useDeleteExpenseMutation,
} from "../hooks/finance/expenses";
import { useGoalsQuery } from "../hooks/finance/goals";
import { useSettleUpsQuery } from "../hooks/finance/settleUps";
import { useInvalidateFinance } from "../hooks/finance/shared";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { financeService } from "../services/financeService";
import { formatSGD } from "../lib/currency";
import { normalizeExpenseTag } from "../lib/expenseFormDraft";
import { addMonths, getCurrentMonth } from "../lib/dateUtils";
import { useFollowCurrentMonth } from "../hooks/useCurrentMonth";
import {
    calculateHouseholdSettlement,
    calculateSharedExpenseSettlement,
    calculateExpenseTrendsSummary,
    calculateSpendablePacing,
    detectUnspentMonthEndSurplus,
} from "../lib/financialFormulas";
import { getSettlementMembers } from "../lib/members";
import { useLazyMockDefaults } from "../hooks/useLazyMockDefaults";
import { ExpenseFormModal } from "../components/expenses/ExpenseFormModal";
import { BulkAddExpenseModal } from "../components/expenses/BulkAddExpenseModal";
import { ExpenseListTable } from "../components/expenses/ExpenseListTable";
import { ExpenseTrendsCard } from "../components/expenses/ExpenseTrendsCard";
import { SpendTagChips } from "../components/expenses/SpendTagChips";
import { ActiveTagSummary } from "../components/expenses/ActiveTagSummary";
import { SettleUpHistory } from "../components/expenses/SettleUpHistory";
import { MonthEndSweepBanner } from "../components/budget/MonthEndSweepBanner";
import { BankSurplusModal } from "../components/budget/BankSurplusModal";
import type { ExpenseFilter, SettleUp } from "../types/finance";
import { CurrencyText } from "../components/ui/CurrencyText";

export interface ExpensesPageProps {
    className?: string;
    embedded?: boolean;
}

const EMPTY_SETTLE_UPS: SettleUp[] = [];

export function ExpensesPage({
    className = "",
    embedded = false,
}: ExpensesPageProps) {
    const {
        perspective,
        overview,
        activeMember,
        members: ctxMembers,
        isMockMode,
    } = useHousehold();

    const { invalidateExpenses } = useInvalidateFinance();
    const addExpenseMutation = useAddExpenseMutation();
    const deleteExpenseMutation = useDeleteExpenseMutation();
    const { isPending: isSettling, runWithLock: runSettleLock } =
        useSubmitLock();

    const {
        members: mockMembers,
        categories: mockCategories,
        baseProfiles: mockBaseProfiles,
        baseAllocations: mockBaseAllocations,
    } = useLazyMockDefaults(isMockMode);

    const members = useMemo(
        () =>
            ctxMembers && ctxMembers.length > 0
                ? ctxMembers
                : isMockMode
                  ? mockMembers
                  : [],
        [ctxMembers, isMockMode, mockMembers],
    );

    // Filter State
    const [filter, setFilter] = useState<ExpenseFilter>({
        month: getCurrentMonth(),
        search: "",
        categoryIds: undefined,
        payerId: undefined,
        isShared: undefined,
    });

    // Keep the default month filter on the live calendar month across rollover
    const currentMonth = useFollowCurrentMonth(filter.month, (month) =>
        setFilter((prev) => ({ ...prev, month })),
    );

    // Synchronize perspective filter if active member changes
    useEffect(() => {
        if (activeMember) {
            setFilter((prev) => ({ ...prev, payerId: activeMember.id }));
        } else {
            setFilter((prev) => ({ ...prev, payerId: undefined }));
        }
    }, [activeMember]);

    // Stats, settlement and trends always cover the whole month: the month
    // query carries no list filters (search, category, shared, tag). Only the
    // personal view's active member scopes it, as before. The ledger narrows
    // this same list client-side (see listExpenses).
    const statsMonth = filter.month || currentMonth;
    const statsPayerId = activeMember?.id;
    const monthFilter = useMemo<ExpenseFilter>(
        () => ({ month: statsMonth, payerId: statsPayerId }),
        [statsMonth, statsPayerId],
    );

    // TanStack Query Cached Data Hooks
    const {
        data: expensesData,
        isPending: expensesPending,
        isPlaceholderData: expensesPlaceholder,
        isError: expensesError,
        error: expensesErrorObj,
        refetch: refetchExpenses,
    } = useExpensesQuery(monthFilter);
    const { data: allExpensesData, isSuccess: allExpensesSuccess } =
        useAllExpensesQuery();
    const { data: recurringItemsData } = useRecurringItemsQuery();
    const { data: categoriesData, isSuccess: categoriesSuccess } =
        useCategoriesQuery();
    const { data: goalsData } = useGoalsQuery();
    const { data: baseProfilesData, isSuccess: baseProfilesSuccess } =
        useBaseProfilesQuery();
    const { data: baseAllocationsData, isSuccess: baseAllocationsSuccess } =
        useBaseAllocationsQuery();

    const expenses = useMemo(() => expensesData || [], [expensesData]);
    const allExpenses = useMemo(
        () => allExpensesData || expensesData || [],
        [allExpensesData, expensesData],
    );
    const recurringItems = useMemo(
        () => recurringItemsData || [],
        [recurringItemsData],
    );
    const categories = useMemo(
        () =>
            categoriesData && categoriesData.length > 0
                ? categoriesData
                : isMockMode
                  ? mockCategories
                  : [],
        [categoriesData, isMockMode, mockCategories],
    );
    const goals = useMemo(() => goalsData || [], [goalsData]);
    const baseProfiles = useMemo(
        () =>
            baseProfilesData && baseProfilesData.length > 0
                ? baseProfilesData
                : isMockMode
                  ? mockBaseProfiles
                  : [],
        [baseProfilesData, isMockMode, mockBaseProfiles],
    );
    const baseAllocations = useMemo(
        () =>
            baseAllocationsData && baseAllocationsData.length > 0
                ? baseAllocationsData
                : isMockMode
                  ? mockBaseAllocations
                  : [],
        [baseAllocationsData, isMockMode, mockBaseAllocations],
    );
    const isMembersPending = !isMockMode && members.length === 0;
    const isLoading = isMembersPending || (expensesPending && !expensesData);

    const { data: settleUpsData } = useSettleUpsQuery();
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isBulkAddOpen, setIsBulkAddOpen] = useState<boolean>(false);
    const [isSettleOpen, setIsSettleOpen] = useState<boolean>(false);
    const [settleTargetIds, setSettleTargetIds] = useState<
        string[] | undefined
    >(undefined);

    // Month-end surplus state
    const [sweepMonth, setSweepMonth] = useState<string>("");
    const [sweepAmount, setSweepAmount] = useState<number>(0);
    const [isBankSurplusModalOpen, setIsBankSurplusModalOpen] =
        useState<boolean>(false);
    const [dismissedSweepMonth, setDismissedSweepMonth] = useState<
        string | null
    >(() => {
        try {
            return localStorage.getItem("budget_bubby_dismissed_sweep");
        } catch {
            return null;
        }
    });

    const handleOpenBankSurplus = (month: string, amount: number) => {
        setSweepMonth(month);
        setSweepAmount(amount);
        setIsBankSurplusModalOpen(true);
    };

    const handleDismissSweep = (month: string) => {
        setDismissedSweepMonth(month);
        try {
            localStorage.setItem("budget_bubby_dismissed_sweep", month);
        } catch {
            // Ignore storage errors in restricted contexts
        }
    };

    const handleConfirmBankSurplus = () => {
        if (sweepMonth) {
            handleDismissSweep(sweepMonth);
        }
    };

    // Handle adding an expense
    const handleExpenseAdded = async () => {
        invalidateExpenses();
    };

    // Handle deleting an expense
    const handleDeleteExpense = (id: string) => {
        if (deleteExpenseMutation.isPending) return;
        const exists =
            expenses.some((e) => e.id === id) ||
            allExpenses.some((e) => e.id === id);
        if (!exists) return;
        deleteExpenseMutation.mutate(id);
    };

    // Reset all filters
    const handleResetFilters = () => {
        setFilter({
            month: currentMonth,
            search: "",
            categoryId: undefined,
            payerId: activeMember ? activeMember.id : undefined,
            isShared: undefined,
            tag: undefined,
        });
    };

    // Metrics Calculations
    const totalSpent = useMemo(() => {
        const sum = expenses.reduce((acc, exp) => acc + exp.amount, 0);
        return Math.round(sum * 100) / 100;
    }, [expenses]);
    const expenseCount = expenses.length;

    const totalShared = useMemo(() => {
        const sum = expenses
            .filter((exp) => exp.is_shared)
            .reduce((acc, exp) => acc + exp.amount, 0);
        return Math.round(sum * 100) / 100;
    }, [expenses]);

    // Unsettled Settlement Calculation
    const settlement = useMemo(() => {
        if (overview?.settlementSummary) {
            return overview.settlementSummary;
        }

        return calculateHouseholdSettlement(expenses, members);
    }, [overview, expenses, members]);

    // Mark the unsettled shared expenses displayed in the settlement summary as settled
    const handleSettleUp = async () => {
        await runSettleLock(async () => {
            const pair = getSettlementMembers(members);
            if (!pair) return;
            const [m1, m2] = pair;
            const idsToSettle = settleTargetIds ?? settlement.expenseIds;
            if (idsToSettle && idsToSettle.length > 0) {
                // Net amount and direction of just the expenses being settled
                const covered = calculateSharedExpenseSettlement(
                    allExpenses.filter((e) => idsToSettle.includes(e.id)),
                    m1.id,
                    m2.id,
                );
                const record =
                    covered.debtorId && covered.creditorId
                        ? {
                              payerId: covered.debtorId,
                              payeeId: covered.creditorId,
                              amount: covered.netBalance,
                          }
                        : undefined;
                await financeService.settleSharedExpenses(
                    m1.id,
                    m2.id,
                    idsToSettle,
                    record,
                );
            } else {
                await financeService.settleSharedExpenses(m1.id, m2.id);
            }
            invalidateExpenses();
            setIsSettleOpen(false);
            setSettleTargetIds(undefined);
        });
    };

    const tagSourceExpenses =
        allExpenses && allExpenses.length > 0 ? allExpenses : expenses;

    const handleSelectTag = (tag: string) => {
        const clean = normalizeExpenseTag(tag);
        setFilter((prev) => ({
            ...prev,
            tag:
                prev.tag &&
                normalizeExpenseTag(prev.tag).toLowerCase() ===
                    clean.toLowerCase()
                    ? undefined
                    : clean,
        }));
    };

    const handleClearTag = () =>
        setFilter((prev) => ({ ...prev, tag: undefined }));

    // A selected tag spans every month: the ledger is fed from all-time
    // expenses and shown without a month, while `filter.month` keeps the
    // remembered month for stats, trends and for when the tag is cleared.
    const isTagScope = Boolean(filter.tag);
    const listFilter = useMemo<ExpenseFilter>(
        () => (isTagScope ? { ...filter, month: undefined } : filter),
        [filter, isTagScope],
    );
    // Tag scope and "all months" read all-time expenses; otherwise the
    // whole-month list is narrowed client-side with the same matcher the
    // service filters implement (order is preserved from the query).
    const listExpenses = useMemo(() => {
        if (isTagScope) {
            return tagSourceExpenses
                .filter((e) => matchesExpenseFilter(e, listFilter))
                .sort((a, b) => b.date.localeCompare(a.date));
        }
        const source = listFilter.month ? expenses : tagSourceExpenses;
        return source.filter((e) => matchesExpenseFilter(e, listFilter));
    }, [isTagScope, tagSourceExpenses, listFilter, expenses]);

    const handleListFilterChange = (next: ExpenseFilter) =>
        setFilter((prev) => ({
            ...next,
            // The list is shown month-less while a tag is set; keep the
            // remembered month unless the user explicitly picks one.
            month: next.month ?? (isTagScope ? prev.month : undefined),
        }));

    // Historical Expense Trends Calculation (6-month rolling averages & category benchmarks)
    const trendsSummary = useMemo(() => {
        const trendsSource =
            allExpenses && allExpenses.length > 0 ? allExpenses : expenses;
        return calculateExpenseTrendsSummary(
            trendsSource,
            categories,
            recurringItems,
            perspective,
            activeMember?.id,
            filter.month || currentMonth,
            6,
        );
    }, [
        allExpenses,
        expenses,
        categories,
        recurringItems,
        perspective,
        activeMember,
        filter.month,
        currentMonth,
    ]);

    // Spendable Budget Pacing Calculation (Dynamically adjusts daily pace & tracks monthly limits)
    // Same budget as Home and Budget, so the Spendable card matches them
    const memberIds = useMemo(() => members.map((m) => m.id), [members]);
    const { data: pacingBudget, isPending: pacingBudgetPending } =
        useBudgetDetailQuery(
            filter.month || currentMonth,
            perspective,
            activeMember?.id,
            memberIds,
        );
    const isSpendableLoading =
        isLoading || (pacingBudgetPending && !pacingBudget);

    const lastMonth = useMemo(
        () => addMonths(currentMonth, -1),
        [currentMonth],
    );
    const { data: lastMonthBudget, isSuccess: lastMonthBudgetSuccess } =
        useBudgetDetailQuery(
            lastMonth,
            perspective,
            activeMember?.id,
            memberIds,
        );

    const spendablePacing = useMemo(() => {
        return calculateSpendablePacing({
            month: filter.month || currentMonth,
            memberId: activeMember?.id,
            perspective,
            expenses:
                allExpenses && allExpenses.length > 0 ? allExpenses : expenses,
            categories,
            baseProfiles,
            baseAllocations,
            monthlyBudget: pacingBudget ?? undefined,
        });
    }, [
        filter.month,
        currentMonth,
        activeMember,
        perspective,
        allExpenses,
        expenses,
        categories,
        baseProfiles,
        baseAllocations,
        pacingBudget,
    ]);

    const sweepQueriesReady =
        allExpensesSuccess &&
        categoriesSuccess &&
        baseProfilesSuccess &&
        baseAllocationsSuccess &&
        lastMonthBudgetSuccess &&
        (isMockMode || members.length > 0);

    // Check unspent surplus from the prior month
    const unspentSurplusInfo = useMemo(() => {
        return detectUnspentMonthEndSurplus({
            currentMonth,
            lastMonth,
            memberId: activeMember?.id,
            perspective,
            expenses:
                allExpenses && allExpenses.length > 0 ? allExpenses : expenses,
            categories,
            baseProfiles,
            baseAllocations,
            monthlyBudget: lastMonthBudget ?? undefined,
            queriesReady: sweepQueriesReady,
        });
    }, [
        currentMonth,
        lastMonth,
        activeMember,
        perspective,
        allExpenses,
        expenses,
        categories,
        baseProfiles,
        baseAllocations,
        lastMonthBudget,
        sweepQueriesReady,
    ]);

    const showSweepBanner =
        unspentSurplusInfo.hasUnspentSurplus &&
        dismissedSweepMonth !== unspentSurplusInfo.lastMonth &&
        (!filter.month || filter.month === currentMonth);

    return (
        <div
            className={`space-y-5 ${!embedded ? "pb-20 md:pb-12" : ""} ${className}`.trim()}
        >
            {/* Header Section */}
            {!embedded ? (
                <PageHeader
                    title="Expenses"
                    actions={
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <InboxShortcutButton />
                            <Button
                                variant="secondary"
                                aria-label="+ Bulk Add"
                                className="w-full sm:w-auto"
                                leftIcon={
                                    <ListPlus
                                        className="h-4 w-4 text-emerald-600"
                                        strokeWidth={2.5}
                                    />
                                }
                                onClick={() => setIsBulkAddOpen(true)}
                            >
                                Bulk Add
                            </Button>
                            <Button
                                variant="primary"
                                aria-label="+ Add Expense"
                                className="hidden md:inline-flex"
                                leftIcon={
                                    <Plus
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                                onClick={() => setIsModalOpen(true)}
                            >
                                Add Expense
                            </Button>
                        </div>
                    }
                />
            ) : (
                <div className="flex items-center justify-end gap-2">
                    <InboxShortcutButton />
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label="+ Bulk Add"
                        className="w-full sm:w-auto"
                        leftIcon={
                            <ListPlus
                                className="h-3.5 w-3.5 text-emerald-600"
                                strokeWidth={2.5}
                            />
                        }
                        onClick={() => setIsBulkAddOpen(true)}
                    >
                        Bulk Add
                    </Button>
                    <Button
                        variant="primary"
                        size="sm"
                        aria-label="+ Add Expense"
                        className="hidden md:inline-flex"
                        leftIcon={
                            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
                        }
                        onClick={() => setIsModalOpen(true)}
                    >
                        Add Expense
                    </Button>
                </div>
            )}

            {/* Mutation Error Banners */}
            {addExpenseMutation.isError && (
                <Alert
                    variant="danger"
                    title="Couldn't save expense"
                    action={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => addExpenseMutation.reset()}
                        >
                            Dismiss
                        </Button>
                    }
                >
                    {addExpenseMutation.error?.message ||
                        "Failed to add expense."}
                </Alert>
            )}

            {deleteExpenseMutation.isError && (
                <Alert
                    variant="danger"
                    title="Couldn't delete expense"
                    action={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => deleteExpenseMutation.reset()}
                        >
                            Dismiss
                        </Button>
                    }
                >
                    {deleteExpenseMutation.error?.message ||
                        "Failed to delete expense."}
                </Alert>
            )}

            {/* Expenses Query Error Banner */}
            {expensesError && (
                <Alert
                    variant="danger"
                    title="Couldn't load expenses"
                    action={
                        <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => void refetchExpenses()}
                        >
                            Retry
                        </Button>
                    }
                >
                    {expensesErrorObj instanceof Error
                        ? expensesErrorObj.message
                        : "Check your connection and try again."}
                </Alert>
            )}

            {/* Celebratory Month-End Sweep Notification Banner */}
            {showSweepBanner && (
                <MonthEndSweepBanner
                    month={unspentSurplusInfo.lastMonth}
                    surplusAmount={unspentSurplusInfo.surplusAmount}
                    onBankSurplusClick={() =>
                        handleOpenBankSurplus(
                            unspentSurplusInfo.lastMonth,
                            unspentSurplusInfo.surplusAmount,
                        )
                    }
                />
            )}

            {/* Content Container (dimmed while loading new month or filter data) */}
            <div
                className={
                    expensesPlaceholder
                        ? "space-y-5 opacity-60 transition-opacity"
                        : "space-y-5 transition-opacity"
                }
            >
                {/* 2-Card Summary Strip: Budget (Spendable) and Shared (Unsettled). Whole-month figures, never list filters. */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
                    {/* Card 1: Spendable Remaining (Primary Card) */}
                    <StatCard
                        title="Spendable"
                        loading={isSpendableLoading}
                        value={formatSGD(spendablePacing.spendableRemaining)}
                        subtitle={
                            spendablePacing.isCurrentMonth
                                ? `${spendablePacing.daysRemaining}d left`
                                : spendablePacing.spendableRemaining >= 0
                                  ? `+${formatSGD(spendablePacing.spendableRemaining)}`
                                  : `-${formatSGD(Math.abs(spendablePacing.spendableRemaining))}`
                        }
                        tooltip={
                            <div className="space-y-1.5 text-xs">
                                <p>
                                    Day-to-day categories only. Goal-funded
                                    spends excluded.
                                </p>
                                <p className="text-[11px] text-(--text-muted)">
                                    Limit:{" "}
                                    <CurrencyText
                                        amount={
                                            spendablePacing.spendableAllocated
                                        }
                                    />{" "}
                                    (Spent:{" "}
                                    <CurrencyText
                                        amount={spendablePacing.spendableSpent}
                                    />
                                    )
                                </p>
                                {spendablePacing.isCurrentMonth && (
                                    <p className="text-[11px] text-(--text-muted)">
                                        Daily pace:{" "}
                                        <CurrencyText
                                            amount={
                                                spendablePacing.dynamicDailyPace
                                            }
                                        />
                                        /day
                                    </p>
                                )}
                                <CollapsibleSection
                                    title="Learn more"
                                    defaultOpen={false}
                                    className="mt-1"
                                >
                                    <p className="text-[11px] text-(--text-muted) pt-1">
                                        In personal view, shared expenses count
                                        at your 50% share.
                                    </p>
                                </CollapsibleSection>
                            </div>
                        }
                        icon={<PiggyBank className="h-4 w-4" />}
                        iconBg={
                            spendablePacing.pacingStatus === "safe"
                                ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : spendablePacing.pacingStatus === "warning"
                                  ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                                  : "bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400"
                        }
                        footer={
                            <div className="space-y-1.5 mt-1">
                                <MeterBar
                                    value={spendablePacing.spendableSpent}
                                    max={spendablePacing.spendableAllocated}
                                    size="sm"
                                    aria-label="Spendable spending progress"
                                />
                                {!spendablePacing.isCurrentMonth &&
                                    spendablePacing.spendableRemaining > 0 && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleOpenBankSurplus(
                                                    filter.month ||
                                                        unspentSurplusInfo.lastMonth,
                                                    spendablePacing.spendableRemaining,
                                                )
                                            }
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 cursor-pointer pt-0.5"
                                        >
                                            <span>
                                                Bank{" "}
                                                <CurrencyText
                                                    amount={
                                                        spendablePacing.spendableRemaining
                                                    }
                                                />{" "}
                                                →
                                            </span>
                                        </button>
                                    )}
                                <p className="text-[11px] font-medium text-(--text-muted)">
                                    <CurrencyText amount={totalSpent} /> spent ·{" "}
                                    {expenseCount} expense
                                    {expenseCount === 1 ? "" : "s"}
                                </p>
                            </div>
                        }
                    />

                    {/* Card 2: Unsettled, with shared spending (needs 2+ members) */}
                    {members.length >= 2 && (
                        <StatCard
                            title="Unsettled"
                            loading={isLoading}
                            tooltip="Shared couple expenses split 50/50 by default unless a custom ratio is set."
                            value={formatSGD(settlement.netBalance)}
                            subtitle={
                                settlement.netBalance === 0
                                    ? "All settled"
                                    : settlement.debtorName &&
                                        settlement.creditorName
                                      ? `${settlement.debtorName} → ${settlement.creditorName}`
                                      : settlement.settlementText
                            }
                            icon={
                                settlement.netBalance === 0 ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                ) : (
                                    <Scale className="h-4 w-4" />
                                )
                            }
                            iconBg={
                                settlement.netBalance === 0
                                    ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                    : "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400"
                            }
                            footer={
                                <div className="space-y-1.5 mt-1">
                                    <p className="text-[11px] font-medium text-(--text-muted)">
                                        <CurrencyText amount={totalShared} />{" "}
                                        shared this month
                                    </p>
                                    {settlement.netBalance > 0 && (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => {
                                                setSettleTargetIds(
                                                    settlement.expenseIds,
                                                );
                                                setIsSettleOpen(true);
                                            }}
                                            leftIcon={
                                                <Scale
                                                    className="h-3.5 w-3.5"
                                                    strokeWidth={2.5}
                                                />
                                            }
                                        >
                                            Settle Up
                                        </Button>
                                    )}
                                </div>
                            }
                        />
                    )}
                </div>

                <ConfirmModal
                    isOpen={isSettleOpen}
                    onClose={() => setIsSettleOpen(false)}
                    onConfirm={handleSettleUp}
                    isLoading={isSettling}
                    title="Settle Up"
                    variant="primary"
                    confirmLabel="Settle"
                    icon={
                        <CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />
                    }
                >
                    Mark shared expenses settled?
                </ConfirmModal>

                <ExpenseTrendsCard trends={trendsSummary} />

                <SpendTagChips
                    expenses={tagSourceExpenses}
                    categories={categories}
                    activeTag={filter.tag}
                    onSelectTag={handleSelectTag}
                />

                {filter.tag && (
                    <ActiveTagSummary
                        tag={filter.tag}
                        expenses={tagSourceExpenses}
                        categories={categories}
                        onClear={handleClearTag}
                    />
                )}

                {/* Expense List Table (Ledger-First with integrated Search, Filter, Sort!) */}
                <ExpenseListTable
                    expenses={listExpenses}
                    categories={categories}
                    members={members}
                    goals={goals}
                    perspective={perspective}
                    activeMemberId={activeMember?.id ?? null}
                    filter={listFilter}
                    onFilterChange={handleListFilterChange}
                    onResetFilters={handleResetFilters}
                    onDeleteExpense={handleDeleteExpense}
                    onExpenseSaved={handleExpenseAdded}
                    isLoading={isLoading}
                />

                <SettleUpHistory
                    settleUps={settleUpsData?.settleUps ?? EMPTY_SETTLE_UPS}
                    members={members}
                />
            </div>

            {/* Bulk Add Expense Modal */}
            <BulkAddExpenseModal
                isOpen={isBulkAddOpen}
                onClose={() => setIsBulkAddOpen(false)}
                onExpensesAdded={handleExpenseAdded}
                categories={categories}
                members={members}
                goals={goals}
                defaultPayerId={filter.payerId}
            />

            {/* Quick Add Expense Modal */}
            <ExpenseFormModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                onExpenseAdded={handleExpenseAdded}
                addMutation={addExpenseMutation}
                defaultPayerId={filter.payerId}
                categories={categories}
                members={members}
                goals={goals}
            />

            {/* Bank as Surplus Confirmation Modal */}
            <BankSurplusModal
                isOpen={isBankSurplusModalOpen}
                onClose={() => setIsBankSurplusModalOpen(false)}
                surplusAmount={sweepAmount}
                month={sweepMonth}
                onConfirm={handleConfirmBankSurplus}
            />
        </div>
    );
}

export default ExpensesPage;
