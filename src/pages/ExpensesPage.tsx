/**
 * Expenses Page
 * Minimal, Ledger-First Spend Hub:
 * - PageHeader with '+ Bulk Add' and 'Add Expense'
 * - Compact summary strip: Spendable, Total Spent, Shared Spending, and Unsettled (with Settle Up)
 * - Mobile-friendly collapsible filter bar & responsive transaction ledger table right at the top
 * - Collapsible Spend Trends & Tags drawers below the ledger
 */

import { useState, useEffect, useMemo } from "react";
import {
    Receipt,
    Plus,
    ArrowRightLeft,
    Scale,
    CheckCircle2,
    Tag,
    ListPlus,
    BarChart3,
    PiggyBank,
} from "lucide-react";
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
    useExpensesQuery,
    useAllExpensesQuery,
    useRecurringItemsQuery,
    useCategoriesQuery,
    useGoalsQuery,
    useBaseProfilesQuery,
    useBaseAllocationsQuery,
    useBudgetDetailQuery,
    useInvalidateFinance,
    useAddExpenseMutation,
    useDeleteExpenseMutation,
    useUpdateGoalMutation,
} from "../hooks/useFinanceQueries";
import { useSubmitLock } from "../hooks/useSubmitLock";
import { financeService } from "../services/financeService";
import { formatSGD } from "../lib/currency";
import { addMonths, getCurrentMonth } from "../lib/dateUtils";
import { useFollowCurrentMonth } from "../hooks/useCurrentMonth";
import {
    calculateSharedExpenseSettlement,
    calculateExpenseTrendsSummary,
    calculateSpendablePacing,
    detectUnspentMonthEndSurplus,
} from "../lib/financialFormulas";
import {
    mockCategories,
    mockMembers,
    mockBaseProfiles,
    mockBaseAllocations,
} from "../data/mockSeedData";
import { ExpenseFormModal } from "../components/expenses/ExpenseFormModal";
import { BulkAddExpenseModal } from "../components/expenses/BulkAddExpenseModal";
import { ExpenseListTable } from "../components/expenses/ExpenseListTable";
import { ExpenseTrendsCard } from "../components/expenses/ExpenseTrendsCard";
import { SpendTagsOverviewCard } from "../components/expenses/SpendTagsOverviewCard";
import { MonthEndSweepBanner } from "../components/budget/MonthEndSweepBanner";
import {
    SurplusSweepModal,
    type SurplusSweepAllocation,
} from "../components/budget/SurplusSweepModal";
import { BankSurplusModal } from "../components/budget/BankSurplusModal";
import type { ExpenseFilter } from "../types/finance";
import { CurrencyText } from "../components/ui/CurrencyText";

export interface ExpensesPageProps {
    className?: string;
    embedded?: boolean;
}

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

    const members = useMemo(
        () =>
            ctxMembers && ctxMembers.length > 0
                ? ctxMembers
                : isMockMode
                  ? mockMembers
                  : [],
        [ctxMembers, isMockMode],
    );

    // Filter State
    const [filter, setFilter] = useState<ExpenseFilter>({
        month: getCurrentMonth(),
        search: "",
        categoryId: undefined,
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

    // TanStack Query Cached Data Hooks
    const {
        data: expensesData,
        isLoading: expensesLoading,
        isPlaceholderData: expensesPlaceholder,
        isError: expensesError,
        error: expensesErrorObj,
        refetch: refetchExpenses,
    } = useExpensesQuery(filter);
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
        [categoriesData, isMockMode],
    );
    const goals = useMemo(() => goalsData || [], [goalsData]);
    const baseProfiles = useMemo(
        () =>
            baseProfilesData && baseProfilesData.length > 0
                ? baseProfilesData
                : isMockMode
                  ? mockBaseProfiles
                  : [],
        [baseProfilesData, isMockMode],
    );
    const baseAllocations = useMemo(
        () =>
            baseAllocationsData && baseAllocationsData.length > 0
                ? baseAllocationsData
                : isMockMode
                  ? mockBaseAllocations
                  : [],
        [baseAllocationsData, isMockMode],
    );
    const isLoading = expensesLoading && !expensesData;

    const updateGoalMutation = useUpdateGoalMutation();
    const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
    const [isBulkAddOpen, setIsBulkAddOpen] = useState<boolean>(false);
    const [isSettleOpen, setIsSettleOpen] = useState<boolean>(false);
    const [settleTargetIds, setSettleTargetIds] = useState<
        string[] | undefined
    >(undefined);

    // Month-end Sweep Modal State
    const [isSweepModalOpen, setIsSweepModalOpen] = useState<boolean>(false);
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

    const handleOpenSweep = (month: string, amount: number) => {
        setSweepMonth(month);
        setSweepAmount(amount);
        setIsSweepModalOpen(true);
    };

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

    const handleSweepComplete = async (
        allocations: SurplusSweepAllocation[],
    ) => {
        for (const alloc of allocations) {
            const freshGoal = await financeService.getGoal(alloc.goalId);
            const targetGoal =
                freshGoal ?? goals.find((g) => g.id === alloc.goalId);
            if (targetGoal) {
                await updateGoalMutation.mutateAsync({
                    id: targetGoal.id,
                    updates: {
                        saved_so_far:
                            Math.round(
                                (Number(targetGoal.saved_so_far) +
                                    alloc.amount) *
                                    100,
                            ) / 100,
                    },
                });
            }
        }
        if (sweepMonth) {
            handleDismissSweep(sweepMonth);
        }
    };

    // Handle adding an expense
    const handleExpenseAdded = async () => {
        invalidateExpenses();
    };

    // Handle deleting an expense
    const handleDeleteExpense = async (id: string) => {
        if (deleteExpenseMutation.isPending) return;
        const exists =
            expenses.some((e) => e.id === id) ||
            allExpenses.some((e) => e.id === id);
        if (!exists) return;
        try {
            await deleteExpenseMutation.mutateAsync(id);
        } catch (err) {
            console.error("Failed to delete expense:", err);
        }
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

        const m1 = members[0];
        const m2 = members[1];
        if (!m1 || !m2) {
            return {
                netBalance: 0,
                debtorId: null,
                creditorId: null,
                settlementText: "All settled up",
                member1OwesMember2: 0,
                member2OwesMember1: 0,
            };
        }

        return calculateSharedExpenseSettlement(
            expenses,
            m1.id,
            m2.id,
            m1.display_name,
            m2.display_name,
        );
    }, [overview, expenses, members]);

    // Mark the unsettled shared expenses displayed in the settlement summary as settled
    const handleSettleUp = async () => {
        await runSettleLock(async () => {
            const [m1, m2] = members;
            if (!m1 || !m2) return;
            const idsToSettle = settleTargetIds ?? settlement.expenseIds;
            if (idsToSettle && idsToSettle.length > 0) {
                await financeService.settleSharedExpenses(
                    m1.id,
                    m2.id,
                    idsToSettle,
                );
            } else {
                await financeService.settleSharedExpenses(m1.id, m2.id);
            }
            invalidateExpenses();
            setIsSettleOpen(false);
            setSettleTargetIds(undefined);
        });
    };

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
    const { data: pacingBudget } = useBudgetDetailQuery(
        filter.month || currentMonth,
        perspective,
        activeMember?.id,
        memberIds,
    );

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
                    onSweepClick={() =>
                        handleOpenSweep(
                            unspentSurplusInfo.lastMonth,
                            unspentSurplusInfo.surplusAmount,
                        )
                    }
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
                {/* 4-Metric Summary Strip: Spendable Remaining, Total Spent, Shared Spending, and Unsettled */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {/* Card 1: Spendable Remaining (Primary Card) */}
                    <StatCard
                        title="Spendable"
                        loading={isLoading}
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
                                                handleOpenSweep(
                                                    filter.month ||
                                                        unspentSurplusInfo.lastMonth,
                                                    spendablePacing.spendableRemaining,
                                                )
                                            }
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1 cursor-pointer pt-0.5"
                                        >
                                            <span>
                                                Sweep{" "}
                                                <CurrencyText
                                                    amount={
                                                        spendablePacing.spendableRemaining
                                                    }
                                                />{" "}
                                                →
                                            </span>
                                        </button>
                                    )}
                            </div>
                        }
                    />

                    {/* Card 2: Total Spent */}
                    <StatCard
                        title="Spent"
                        loading={isLoading}
                        value={formatSGD(totalSpent)}
                        subtitle={`${expenses.length} transaction${expenses.length === 1 ? "" : "s"}`}
                        icon={<Receipt className="h-4 w-4" />}
                        iconBg="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                    />

                    {/* Card 3: Shared Spending */}
                    <StatCard
                        title="Shared"
                        loading={isLoading}
                        value={formatSGD(totalShared)}
                        tooltip="Shared couple expenses split 50/50 by default unless a custom ratio is set."
                        icon={<ArrowRightLeft className="h-4 w-4" />}
                        iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
                    />

                    {/* Card 4: Unsettled Balance (Who Owes Whom) */}
                    <StatCard
                        title="Unsettled"
                        loading={isLoading}
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
                            settlement.netBalance > 0 && members.length >= 2 ? (
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
                                    className="mt-1"
                                >
                                    Settle Up
                                </Button>
                            ) : undefined
                        }
                    />
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

                {/* Expense List Table (Ledger-First with integrated Search, Filter, Sort!) */}
                <ExpenseListTable
                    expenses={expenses}
                    categories={categories}
                    members={members}
                    goals={goals}
                    filter={filter}
                    onFilterChange={setFilter}
                    onResetFilters={handleResetFilters}
                    onDeleteExpense={handleDeleteExpense}
                    onExpenseSaved={handleExpenseAdded}
                    isLoading={isLoading}
                />

                {/* Collapsible Secondary Drawers: Spend Trends & Tags */}
                <div className="space-y-3 pt-2">
                    <CollapsibleSection
                        title="Spend Trends"
                        summaryRight={`3-mo avg: ${formatSGD(trendsSummary.rolling3MonthAvg)}`}
                        icon={
                            <BarChart3 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        }
                        defaultOpen={false}
                    >
                        <ExpenseTrendsCard
                            trends={trendsSummary}
                            perspectiveLabel={
                                perspective === "household"
                                    ? "Household"
                                    : activeMember?.display_name || "Personal"
                            }
                        />
                    </CollapsibleSection>

                    <CollapsibleSection
                        title="Tags & Trips"
                        badge={
                            filter.tag ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300">
                                    #{filter.tag}
                                </span>
                            ) : undefined
                        }
                        icon={
                            <Tag className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                        }
                        defaultOpen={Boolean(filter.tag)}
                    >
                        <SpendTagsOverviewCard
                            expenses={
                                allExpenses && allExpenses.length > 0
                                    ? allExpenses
                                    : expenses
                            }
                            categories={categories}
                            activeTag={filter.tag}
                            onSelectTag={(tag) =>
                                setFilter((prev) => ({
                                    ...prev,
                                    tag: prev.tag === tag ? undefined : tag,
                                }))
                            }
                            onClearTag={() =>
                                setFilter((prev) => ({
                                    ...prev,
                                    tag: undefined,
                                }))
                            }
                        />
                    </CollapsibleSection>
                </div>
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

            {/* Month-End Surplus Sweep to Goals Modal */}
            <SurplusSweepModal
                isOpen={isSweepModalOpen}
                onClose={() => setIsSweepModalOpen(false)}
                surplusAmount={sweepAmount}
                month={sweepMonth}
                goals={goals}
                onSweepComplete={handleSweepComplete}
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
