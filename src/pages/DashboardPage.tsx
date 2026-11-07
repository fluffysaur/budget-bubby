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

import { lazy, Suspense, useMemo, useState } from "react";
import { useHousehold } from "../context/HouseholdContext";
import { Card, PageHeader, TruncatedText, DashboardSkeleton, MeterBar, ProgressRing } from "../components/ui";
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
import { CurrencyText } from "../components/ui/CurrencyText";
import { BubbyGreeting } from "../components/bubby/BubbyGreeting";
import { QuestCard } from "../components/dashboard/QuestCard";
import { recapWeekFor } from "../lib/bubby/recap";
import { readBubbyStore } from "../lib/bubby/storage";
import { daysInMonthOf, toSgtDateString } from "../lib/bubby/dates";

// Only loaded Monday to Wednesday, when a recap is due
const WeeklyRecapCard = lazy(() => import("../components/dashboard/WeeklyRecapCard"));

export interface DashboardPageProps {
    className?: string;
    onNavigateTab?: (tab: string) => void;
}

export function DashboardPage({
    className = "",
    onNavigateTab,
}: DashboardPageProps) {
    const { perspective, activeMember, members: ctxMembers } = useHousehold();

    const members =
        ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;

    const currentMonth = useCurrentMonth();
    const memberIds = useMemo(() => members.map((m) => m.id), [members]);

    // TanStack Query Cached Data Hooks
    const { data: recurringItemsData } = useRecurringItemsQuery();
    // Combined view shows the household total, same as Budget
    const { data: budgetData, isLoading: budgetLoading } = useBudgetDetailQuery(
        currentMonth,
        perspective,
        activeMember?.id,
        memberIds,
    );

    const recurringItems = useMemo(() => recurringItemsData || [], [recurringItemsData]);
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

    const isOverspent = spendableSummary.totalRemaining < 0;

    // Weekly recap: decided once per visit (Mon-Wed, until acknowledged)
    const [recapWeek] = useState(() =>
        recapWeekFor(toSgtDateString(), readBubbyStore().recapSeenWeek),
    );
    const [showAllCategories, setShowAllCategories] = useState(false);
    const weeklyBudget =
        perspective === "household" && spendableSummary.totalAllocated > 0
            ? (spendableSummary.totalAllocated * 7) / daysInMonthOf(toSgtDateString())
            : null;

    const displayedCategories = showAllCategories
        ? spendableSummary.categories
        : spendableSummary.categories.slice(0, 4);
    const hasMore = spendableSummary.categories.length > 4;

    return (
        <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
            <PageHeader title="Home" badge={<BubbyGreeting onOpenInbox={() => onNavigateTab?.("inbox")} />} />

            {isLoading ? (
                <DashboardSkeleton />
            ) : (
                <>
                    {/* Most urgent category limit alert */}
                    <CategoryLimitWarningBanner
                        single
                        categories={monthlyBudget?.categories || []}
                        onNavigateCategory={() => onNavigateTab?.("budget")}
                    />

                    {/* Unsorted captures */}
                    <InboxHomeCard />

                    {/* Left to Spend hero */}
                    <Card
                        role="region"
                        aria-label="Left to Spend"
                        padding="lg"
                    >
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                    Left to Spend
                                </span>
                                <div
                                    data-testid="left-to-spend-amount"
                                    className={`mt-1 ${
                                        isOverspent
                                            ? "text-(--accent-coral-ink) dark:text-rose-400"
                                            : "text-(--text-ink)"
                                    }`}
                                >
                                    <CurrencyText amount={spendableSummary.totalRemaining} size="hero" />
                                </div>
                                <span className="mt-1 block text-xs font-semibold text-(--text-muted) font-mono-num">
                                    <CurrencyText amount={spendableSummary.totalSpent} /> of{" "}
                                    <CurrencyText amount={spendableSummary.totalAllocated} /> spent
                                </span>
                            </div>
                            {onNavigateTab && (
                                <button
                                    type="button"
                                    onClick={() => onNavigateTab("budget")}
                                    className="shrink-0 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-press cursor-pointer"
                                >
                                    Budget
                                </button>
                            )}
                        </div>

                        {/* Overall progress meter */}
                        <div className="mt-3">
                            <MeterBar
                                value={spendableSummary.totalSpent}
                                max={spendableSummary.totalAllocated}
                                size="md"
                                aria-label="Spendable budget progress"
                            />
                        </div>

                        {/* Per-category meters */}
                        {spendableSummary.categories.length > 0 && (
                            <div className="mt-4">
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                                    {displayedCategories.map((cat) => (
                                        <div
                                            key={cat.id}
                                            className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-2.5 shadow-cute-sm flex items-center gap-2.5"
                                        >
                                            <ProgressRing
                                                value={cat.pct}
                                                size={36}
                                                strokeWidth={3.5}
                                                tone={
                                                    cat.remaining < 0
                                                        ? "over"
                                                        : cat.pct >= 80
                                                          ? "near"
                                                          : "ok"
                                                }
                                                centerContent={
                                                    <span
                                                        className="h-2 w-2 rounded-full border border-(--border-ink) shrink-0"
                                                        style={{
                                                            backgroundColor: cat.color,
                                                        }}
                                                    />
                                                }
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="text-xs font-bold text-(--text-ink) truncate font-display">
                                                    <TruncatedText text={cat.name} />
                                                </div>
                                                <div
                                                    className={`text-xs font-extrabold font-mono-num ${
                                                        cat.remaining < 0
                                                            ? "text-(--accent-coral-ink) dark:text-rose-400"
                                                            : "text-(--text-ink)"
                                                    }`}
                                                >
                                                    <CurrencyText amount={cat.remaining} />
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                {hasMore && (
                                    <div className="mt-2 text-center">
                                        <button
                                            type="button"
                                            onClick={() => setShowAllCategories((prev) => !prev)}
                                            className="text-xs font-bold text-(--text-muted) hover:text-(--text-ink) py-1 px-3 rounded-lg hover:bg-(--bg-cream) cursor-pointer transition-colors"
                                        >
                                            {showAllCategories
                                                ? "Show Less"
                                                : `+${spendableSummary.categories.length - 4} More`}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </Card>

                    {/* Bubby's quests for today */}
                    <QuestCard />

                    {/* Last week's recap (temporary, Mon-Wed) */}
                    {recapWeek && (
                        <Suspense fallback={null}>
                            <WeeklyRecapCard
                                week={recapWeek}
                                weeklyBudget={weeklyBudget}
                                onSeeSpend={() => onNavigateTab?.("expenses")}
                            />
                        </Suspense>
                    )}

                    {/* Upcoming bills */}
                    <UpcomingBillsWidget
                        recurringItems={recurringItems}
                        onViewAll={() => onNavigateTab?.("recurring")}
                    />
                </>
            )}
        </div>
    );
}

export default DashboardPage;
