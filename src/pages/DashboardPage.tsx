/**
 * DashboardPage Component
 * Home screen focused on the daily question "how much can I still spend?":
 * - At most one category limit alert
 * - Left to Spend hero with per-category meters
 * - Upcoming bills
 *
 * - Bubby's daily quests
 *
 * Net worth lives on Accounts, goals on Plan, settlement on Spend > Expenses,
 * and the live Bubby in the header.
 */

import { lazy, Suspense, useCallback, useMemo, useState } from "react";
import { useHousehold } from "../context/HouseholdContext";
import { PageHeader, DashboardSkeleton } from "../components/ui";
import {
    useRecurringItemsQuery,
    useBudgetDetailQuery,
} from "../hooks/useFinanceQueries";
import { useCurrentMonth } from "../hooks/useCurrentMonth";
import { mockMembers } from "../data/mockSeedData";
import { isSpendableCategory } from "../lib/financialFormulas";
import { UpcomingBillsWidget } from "../components/dashboard/UpcomingBillsWidget";
import { CategoryLimitWarningBanner } from "../components/budget/CategoryLimitWarningBanner";
import { InboxHomeCard } from "../components/inbox/InboxHomeCard";
import { BubbyGreeting } from "../components/bubby/BubbyGreeting";
import { QuestCard } from "../components/dashboard/QuestCard";
import { LeftToSpendHero } from "../components/dashboard/LeftToSpendHero";
import { recapWeekFor } from "../lib/bubby/recap";
import { readBubbyStore } from "../lib/bubby/storage";
import { daysInMonthOf, toSgtDateString } from "../lib/bubby/dates";

// Only loaded Monday to Wednesday, when a recap is due
const WeeklyRecapCard = lazy(
    () => import("../components/dashboard/WeeklyRecapCard"),
);

export interface DashboardPageProps {
    className?: string;
    onNavigateTab?: (tab: string) => void;
}

export function DashboardPage({
    className = "",
    onNavigateTab,
}: DashboardPageProps) {
    const {
        perspective,
        activeMember,
        members: ctxMembers,
        isMockMode,
    } = useHousehold();

    const members = useMemo(
        () =>
            ctxMembers && ctxMembers.length > 0
                ? ctxMembers
                : isMockMode
                  ? mockMembers
                  : [],
        [ctxMembers, isMockMode],
    );

    const currentMonth = useCurrentMonth();
    const memberIds = useMemo(() => members.map((m) => m.id), [members]);

    // TanStack Query Cached Data Hooks
    const { data: recurringItemsData } = useRecurringItemsQuery();
    // Combined view shows the household total, same as Budget
    const {
        data: budgetData,
        isLoading: budgetLoading,
        isPlaceholderData: budgetPlaceholder,
    } = useBudgetDetailQuery(
        currentMonth,
        perspective,
        activeMember?.id,
        memberIds,
    );

    const recurringItems = useMemo(
        () => recurringItemsData || [],
        [recurringItemsData],
    );
    const monthlyBudget = budgetData || null;

    const isLoading = budgetLoading && !budgetData;

    // Spendable budget: total left plus a meter per spendable category
    const spendableSummary = useMemo(() => {
        const budgetCategories = monthlyBudget?.categories || [];
        const spendable = budgetCategories.filter((bc) =>
            bc.category ? isSpendableCategory(bc.category) : false,
        );

        const spendableItems = spendable.map((bc) => {
            const allocated = bc.allocated_amount || 0;
            const spent = bc.actualSpent || 0;
            const remaining =
                bc.remaining !== undefined ? bc.remaining : allocated - spent;
            const pct =
                allocated > 0
                    ? Math.min(100, Math.round((spent / allocated) * 100))
                    : 0;
            return {
                id: bc.category_id,
                name: bc.category?.name || "Category",
                color: bc.category?.color || "#10b981",
                spent: Math.round(spent * 100) / 100,
                allocated: Math.round(allocated * 100) / 100,
                remaining: Math.round(remaining * 100) / 100,
                pct,
            };
        });

        const totalAllocated =
            monthlyBudget?.spendableAllocated ??
            spendableItems.reduce((s, c) => s + c.allocated, 0);
        const totalSpent =
            monthlyBudget?.spendableSpent ??
            spendableItems.reduce((s, c) => s + c.spent, 0);
        const totalRemaining =
            monthlyBudget?.spendableRemaining ?? totalAllocated - totalSpent;
        const totalPct =
            totalAllocated > 0
                ? Math.min(100, Math.round((totalSpent / totalAllocated) * 100))
                : 0;

        return {
            totalAllocated,
            totalSpent,
            totalRemaining,
            totalPct,
            categories: spendableItems,
        };
    }, [monthlyBudget]);

    // Weekly recap: decided once per visit (Mon-Wed, until acknowledged)
    const [recapWeek] = useState(() =>
        recapWeekFor(toSgtDateString(), readBubbyStore().recapSeenWeek),
    );
    const weeklyBudget =
        perspective === "household" && spendableSummary.totalAllocated > 0
            ? (spendableSummary.totalAllocated * 7) /
              daysInMonthOf(toSgtDateString())
            : null;

    const handleOpenInbox = useCallback(
        () => onNavigateTab?.("inbox"),
        [onNavigateTab],
    );
    const handleNavigateBudget = useCallback(
        () => onNavigateTab?.("budget"),
        [onNavigateTab],
    );
    const handleNavigateExpenses = useCallback(
        () => onNavigateTab?.("expenses"),
        [onNavigateTab],
    );
    const handleNavigateRecurring = useCallback(
        () => onNavigateTab?.("recurring"),
        [onNavigateTab],
    );

    const categoriesList = useMemo(
        () => monthlyBudget?.categories || [],
        [monthlyBudget?.categories],
    );

    return (
        <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
            <PageHeader
                title="Home"
                badge={<BubbyGreeting onOpenInbox={handleOpenInbox} />}
            />

            {isLoading ? (
                <DashboardSkeleton />
            ) : (
                <div
                    className={
                        budgetPlaceholder
                            ? "space-y-5 opacity-60 transition-opacity"
                            : "space-y-5 transition-opacity"
                    }
                >
                    {/* Left to Spend hero */}
                    <LeftToSpendHero
                        summary={spendableSummary}
                        onNavigateBudget={
                            onNavigateTab ? handleNavigateBudget : undefined
                        }
                    />

                    {/* Most urgent category limit alert (rendered below hero) */}
                    <CategoryLimitWarningBanner
                        single
                        categories={categoriesList}
                        onNavigateCategory={handleNavigateBudget}
                    />

                    {/* Unsorted captures (rendered below hero) */}
                    <InboxHomeCard />

                    {/* Bubby's quests for today */}
                    <QuestCard />

                    {/* Last week's recap (temporary, Mon-Wed) */}
                    {recapWeek && (
                        <Suspense fallback={null}>
                            <WeeklyRecapCard
                                week={recapWeek}
                                weeklyBudget={weeklyBudget}
                                onSeeSpend={handleNavigateExpenses}
                            />
                        </Suspense>
                    )}

                    {/* Upcoming bills */}
                    <UpcomingBillsWidget
                        recurringItems={recurringItems}
                        onViewAll={handleNavigateRecurring}
                    />
                </div>
            )}
        </div>
    );
}

export default DashboardPage;
