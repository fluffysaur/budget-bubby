/**
 * GoalsPage Component
 * Milestone savings goals and pacing tracker:
 * - 4 Summary metric cards: Total Target, Total Saved, Overall Progress, Monthly Savings Pace
 * - Filter tabs: All Goals, In Progress, Achieved
 * - Responsive grid of GoalCards with status pacing
 * - AddEditGoalModal for creating/updating goals
 * - QuickDepositModal for instant incremental savings
 * - Auto-refresh on data mutation
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
    Target,
    Plus,
    PiggyBank,
    Sparkles,
    Calendar,
    AlertCircle,
} from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    Button,
    StatCard,
    LoadingCard,
    EmptyStateCard,
} from "../components/ui";
import {
    useGoalsQuery,
    useExpensesQuery,
    useCategoriesQuery,
} from "../hooks/useFinanceQueries";
import { formatSGD } from "../lib/currency";
import { GoalCard } from "../components/goals/GoalCard";
import { AddEditGoalModal } from "../components/goals/AddEditGoalModal";
import { QuickDepositModal } from "../components/goals/QuickDepositModal";
import { SpendFromGoalModal } from "../components/goals/SpendFromGoalModal";
import type { SavingsGoal, Expense } from "../types/finance";

export interface GoalsPageProps {
    className?: string;
    embedded?: boolean;
}

type GoalFilterTab = "all" | "in_progress" | "achieved";

export function GoalsPage({
    className = "",
    embedded = false,
}: GoalsPageProps) {
    const {
        perspective,
        setPerspective,
        activeMember,
        overview,
        members: ctxMembers,
        refreshData: refreshHousehold,
    } = useHousehold();

    // Cached TanStack Queries
    const {
        data: goalsData,
        isLoading: goalsLoading,
        error: goalsError,
    } = useGoalsQuery();
    const { data: expensesData } = useExpensesQuery();
    const { data: categoriesData } = useCategoriesQuery();

    const [searchParams, setSearchParams] = useSearchParams();
    const targetGoalId = searchParams.get("goalId");

    const goals = useMemo(() => goalsData || [], [goalsData]);
    const expenses = useMemo(() => expensesData || [], [expensesData]);
    const categories = useMemo(() => categoriesData || [], [categoriesData]);
    const isLoading = goalsLoading && !goalsData;
    const errorMessage = goalsError ? (goalsError as Error).message : null;
    const [activeTab, setActiveTab] = useState<GoalFilterTab>("all");
    const [highlightedGoalId, setHighlightedGoalId] = useState<string | null>(null);

    const processedGoalIdRef = useRef<string | null>(null);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Modal states
    const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
    const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
    const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
    const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);
    const [isSpendOpen, setIsSpendOpen] = useState<boolean>(false);
    const [spendGoal, setSpendGoal] = useState<SavingsGoal | null>(null);

    // Map expenses linked to each goal
    const goalExpensesMap = useMemo(() => {
        const map = new Map<string, Expense[]>();
        for (const exp of expenses) {
            if (!exp.goal_id) continue;
            const list = map.get(exp.goal_id) || [];
            list.push(exp);
            map.set(exp.goal_id, list);
        }
        return map;
    }, [expenses]);

    // Perspective-filtered goals if applicable
    const perspectiveGoals = useMemo(() => {
        return goals.filter((g) => {
            if (perspective === "household") return true;
            // Joint or assigned to active member
            return !g.owner_id || g.owner_id === activeMember?.id;
        });
    }, [goals, perspective, activeMember]);

    // High-Level Summary Metrics
    const {
        totalTarget,
        totalSaved,
        overallProgress,
        totalMonthlyContributions,
    } = useMemo(() => {
        const target = perspectiveGoals.reduce(
            (sum, g) => sum + (g.target_amount || 0),
            0,
        );
        const saved = perspectiveGoals.reduce(
            (sum, g) => sum + (g.saved_so_far || 0),
            0,
        );
        const monthly = perspectiveGoals.reduce(
            (sum, g) => sum + (g.monthly_contribution || 0),
            0,
        );
        const progress =
            target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

        return {
            totalTarget: target,
            totalSaved: saved,
            overallProgress: progress,
            totalMonthlyContributions: monthly,
        };
    }, [perspectiveGoals]);

    // Filtered by Active Tab
    const inProgressGoals = useMemo(() => {
        return perspectiveGoals.filter(
            (g) => g.saved_so_far < g.target_amount && g.status !== "achieved",
        );
    }, [perspectiveGoals]);

    const achievedGoals = useMemo(() => {
        return perspectiveGoals.filter(
            (g) => g.saved_so_far >= g.target_amount || g.status === "achieved",
        );
    }, [perspectiveGoals]);

    const displayedGoals = useMemo(() => {
        if (activeTab === "in_progress") return inProgressGoals;
        if (activeTab === "achieved") return achievedGoals;
        return perspectiveGoals;
    }, [perspectiveGoals, activeTab, inProgressGoals, achievedGoals]);

    // Handle deep-link scrolling and highlighting from notifications (?goalId=...)
    useEffect(() => {
        if (!targetGoalId || goalsLoading || !goalsData) return;
        if (processedGoalIdRef.current === targetGoalId) return;

        const targetGoal = goals.find((g) => g.id === targetGoalId);
        if (!targetGoal) {
            processedGoalIdRef.current = targetGoalId;
            const newParams = new URLSearchParams(searchParams);
            newParams.delete("goalId");
            setSearchParams(newParams, { replace: true });
            return;
        }

        processedGoalIdRef.current = targetGoalId;

        // 1. Perspective check: if target goal is hidden by member perspective, switch to household
        if (
            perspective !== "household" &&
            targetGoal.owner_id &&
            targetGoal.owner_id !== activeMember?.id
        ) {
            setPerspective("household");
        }

        // 2. Filter check: if target goal is hidden by active filter tab, switch to 'all'
        const isGoalAchieved =
            targetGoal.saved_so_far >= targetGoal.target_amount ||
            targetGoal.status === "achieved";
        if (
            (activeTab === "in_progress" && isGoalAchieved) ||
            (activeTab === "achieved" && !isGoalAchieved)
        ) {
            setActiveTab("all");
        }

        // 3. Highlight the goal card
        setHighlightedGoalId(targetGoalId);

        // 4. Clean up query param from URL so page refreshes don't re-trigger it
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("goalId");
        setSearchParams(newParams, { replace: true });

        // 5. Scroll into view after DOM paint
        if (scrollTimerRef.current) {
            clearTimeout(scrollTimerRef.current);
        }
        scrollTimerRef.current = setTimeout(() => {
            const el = document.getElementById(`goal-card-${targetGoalId}`);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
            scrollTimerRef.current = null;
        }, 100);

        // 6. Gracefully fade out highlight after 3 seconds
        if (highlightTimerRef.current) {
            clearTimeout(highlightTimerRef.current);
        }
        highlightTimerRef.current = setTimeout(() => {
            setHighlightedGoalId((curr) => (curr === targetGoalId ? null : curr));
            highlightTimerRef.current = null;
        }, 3000);
    }, [
        targetGoalId,
        goals,
        goalsLoading,
        goalsData,
        perspective,
        activeMember,
        activeTab,
        searchParams,
        setSearchParams,
        setPerspective,
    ]);

    // Reset processed ref when query param is cleared, allowing re-navigation later
    useEffect(() => {
        if (!targetGoalId) {
            processedGoalIdRef.current = null;
        }
    }, [targetGoalId]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => {
            if (scrollTimerRef.current) {
                clearTimeout(scrollTimerRef.current);
            }
            if (highlightTimerRef.current) {
                clearTimeout(highlightTimerRef.current);
            }
        };
    }, []);

    // Handlers
    const handleOpenCreateModal = () => {
        setEditingGoal(null);
        setIsAddEditOpen(true);
    };

    const handleOpenEditModal = (goal: SavingsGoal) => {
        setEditingGoal(goal);
        setIsAddEditOpen(true);
    };

    const handleOpenDepositModal = (goal: SavingsGoal) => {
        setDepositGoal(goal);
        setIsDepositOpen(true);
    };

    const handleOpenSpendModal = (goal: SavingsGoal) => {
        setSpendGoal(goal);
        setIsSpendOpen(true);
    };

    const handleGoalSaved = async () => {
        await refreshHousehold();
    };

    const handleDepositSaved = async () => {
        await refreshHousehold();
    };

    const handleSpendSaved = async () => {
        await refreshHousehold();
    };

    return (
        <div className={`space-y-5 ${!embedded ? "pb-20 md:pb-12" : ""} ${className}`.trim()}>
            {/* Page Header (Compact if embedded) */}
            {!embedded ? (
                <PageHeader
                    title="Savings Goals & Milestones"
                    actions={
                        <Button
                            variant="primary"
                            aria-label="+ New Goal"
                            className="w-full sm:w-auto"
                            leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
                            onClick={handleOpenCreateModal}
                        >
                            New Goal
                        </Button>
                    }
                />
            ) : (
                <div className="flex items-center justify-end">
                    <Button
                        variant="primary"
                        size="sm"
                        aria-label="+ New Goal"
                        className="w-full sm:w-auto"
                        leftIcon={<Plus className="h-3.5 w-3.5 stroke-[2.5]" />}
                        onClick={handleOpenCreateModal}
                    >
                        New Goal
                    </Button>
                </div>
            )}

            {/* Error Alert */}
            {errorMessage && (
                <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                    <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
                    <span>{errorMessage}</span>
                </div>
            )}

            {/* 4 Summary Metric Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                {/* Card 1: Total Target */}
                <StatCard
                    title="Total Target"
                    value={formatSGD(totalTarget)}
                    subtitle={`Across ${perspectiveGoals.length} ${perspectiveGoals.length === 1 ? "goal" : "goals"}`}
                    icon={<Target className="h-4 w-4" />}
                    iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                />

                {/* Card 2: Total Saved */}
                <StatCard
                    title="Total Saved"
                    value={formatSGD(totalSaved)}
                    subtitle={`${formatSGD(Math.max(0, totalTarget - totalSaved))} remaining`}
                    icon={<PiggyBank className="h-4 w-4" />}
                    iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                />

                {/* Card 3: Overall Progress */}
                <StatCard
                    title="Overall Progress"
                    value={`${overallProgress}%`}
                    subtitle={`${perspectiveGoals.filter((g) => g.status === "achieved").length} achieved`}
                    icon={<Sparkles className="h-4 w-4" />}
                    iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                />

                {/* Card 4: Total Monthly Contributions */}
                <StatCard
                    title="Monthly Pace"
                    value={`${formatSGD(totalMonthlyContributions)}/mo`}
                    subtitle="Monthly savings pacing"
                    icon={<Calendar className="h-4 w-4" />}
                    iconBg="bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400"
                />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                <div role="tablist" className="flex items-center gap-2">
                    <button
                        role="tab"
                        aria-selected={activeTab === "all"}
                        aria-controls="goals-tabpanel"
                        onClick={() => setActiveTab("all")}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                            activeTab === "all"
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        }`}
                    >
                        <span>All Goals</span>
                        <span className="rounded-full bg-black/10 dark:bg-white/20 px-1.5 py-0.5 text-[10px]">
                            {perspectiveGoals.length}
                        </span>
                    </button>

                    <button
                        role="tab"
                        aria-selected={activeTab === "in_progress"}
                        aria-controls="goals-tabpanel"
                        onClick={() => setActiveTab("in_progress")}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                            activeTab === "in_progress"
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        }`}
                    >
                        <span>In Progress</span>
                        <span className="rounded-full bg-black/10 dark:bg-white/20 px-1.5 py-0.5 text-[10px]">
                            {inProgressGoals.length}
                        </span>
                    </button>

                    <button
                        role="tab"
                        aria-selected={activeTab === "achieved"}
                        aria-controls="goals-tabpanel"
                        onClick={() => setActiveTab("achieved")}
                        className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
                            activeTab === "achieved"
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
                        }`}
                    >
                        <span>Achieved</span>
                        <span className="rounded-full bg-black/10 dark:bg-white/20 px-1.5 py-0.5 text-[10px]">
                            {achievedGoals.length}
                        </span>
                    </button>
                </div>
            </div>

            {/* Content Area: Loader, Empty State, or Grid */}
            {isLoading ? (
                <LoadingCard message="Loading savings goals..." />
            ) : displayedGoals.length === 0 ? (
                <EmptyStateCard
                    icon={<span className="text-2xl">🎯</span>}
                    title={
                        activeTab === "all"
                            ? "No savings goals found"
                            : activeTab === "in_progress"
                              ? "No goals currently in progress"
                              : "No goals achieved yet"
                    }
                    description={
                        activeTab === "all"
                            ? "Set milestones for your wedding, HDB down payment, renovation, or honeymoon to calculate required monthly pacing."
                            : "Try changing your filter tab to see your other savings goals."
                    }
                    action={
                        <Button
                            variant="primary"
                            onClick={handleOpenCreateModal}
                            leftIcon={<Plus className="h-4 w-4 stroke-3" />}
                        >
                            Create your first goal
                        </Button>
                    }
                />
            ) : (
                <div
                    id="goals-tabpanel"
                    role="tabpanel"
                    className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                    {displayedGoals.map((goal) => (
                        <GoalCard
                            key={goal.id}
                            goal={goal}
                            linkedExpenses={goalExpensesMap.get(goal.id) || []}
                            onEdit={handleOpenEditModal}
                            onQuickDeposit={handleOpenDepositModal}
                            onSpendFromGoal={handleOpenSpendModal}
                            isHighlighted={highlightedGoalId === goal.id}
                        />
                    ))}
                </div>
            )}

            {/* Add / Edit Goal Modal */}
            <AddEditGoalModal
                isOpen={isAddEditOpen}
                onClose={() => setIsAddEditOpen(false)}
                goal={editingGoal}
                onGoalSaved={handleGoalSaved}
                householdId={overview?.household.id}
            />

            {/* Quick Deposit Modal */}
            <QuickDepositModal
                isOpen={isDepositOpen}
                onClose={() => setIsDepositOpen(false)}
                goal={depositGoal}
                onDepositSaved={handleDepositSaved}
            />

            {/* Spend from Goal Modal */}
            <SpendFromGoalModal
                isOpen={isSpendOpen}
                onClose={() => {
                    setIsSpendOpen(false);
                    setSpendGoal(null);
                }}
                goal={spendGoal}
                categories={categories}
                members={overview?.members || ctxMembers}
                defaultPayerId={activeMember?.id}
                onSpendSaved={handleSpendSaved}
            />
        </div>
    );
}
