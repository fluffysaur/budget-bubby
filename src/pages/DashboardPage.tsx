/**
 * DashboardPage Component
 * Top-level Financial Hub & Settlement Center
 * Adapts dynamically to active perspective:
 * - Mobile Daily Briefing Strip: Spendable Remaining, 4 Category Meters (Food, Lifestyle, Transport, Buffer), Settlement Status
 * - Combined Household: NetWorthHeroCard, SettlementWidget, SharedGoalsOverview, UpcomingBillsWidget
 * - Personal Perspectives: Personal Net Worth, Monthly Budget progress, Personal Accounts & Recent Transactions
 * - Quick Actions: Quick Add Expense, Update Account Balance
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import {
    Plus,
    PieChart,
    Landmark,
    Receipt,
    Loader2,
    Wallet,
    ArrowRightLeft,
    ChevronRight,
} from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import { PageHeader, TruncatedText } from "../components/ui";
import { financeService } from "../services/financeService";
import { formatSGD } from "../lib/currency";
import { getCurrentMonth, formatDisplayDate } from "../lib/dateUtils";
import { mockCategories, mockMembers } from "../data/mockSeedData";
import { isSpendableCategory } from "../lib/financialFormulas";
import { NetWorthHeroCard } from "../components/dashboard/NetWorthHeroCard";
import { DailyCheckinStreakBar } from "../components/dashboard/DailyCheckinStreakBar";
import { SettlementWidget } from "../components/dashboard/SettlementWidget";
import { SharedGoalsOverview } from "../components/dashboard/SharedGoalsOverview";
import { UpcomingBillsWidget } from "../components/dashboard/UpcomingBillsWidget";
import { QuickAddExpenseModal } from "../components/expenses/QuickAddExpenseModal";
import { UpdateBalanceModal } from "../components/accounts/UpdateBalanceModal";
import { AddAccountModal } from "../components/accounts/AddAccountModal";
import { CategoryLimitWarningBanner } from "../components/budget/CategoryLimitWarningBanner";
import type {
    Account,
    Category,
    Expense,
    Loan,
    MonthlyBudgetDetail,
    RecurringPolicy,
    SavingsGoal,
} from "../types/finance";

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
        overview,
        refreshData: refreshHousehold,
    } = useHousehold();

    const members =
        ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;
    const isHousehold = perspective === "household";

    // Data States
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [policies, setPolicies] = useState<RecurringPolicy[]>([]);
    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [monthlyBudget, setMonthlyBudget] =
        useState<MonthlyBudgetDetail | null>(null);
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // Modal States
    const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
    const [isUpdateBalanceOpen, setIsUpdateBalanceOpen] =
        useState<boolean>(false);
    const [isAddAccountOpen, setIsAddAccountOpen] = useState<boolean>(false);
    const [selectedAccountForUpdate, setSelectedAccountForUpdate] =
        useState<Account | null>(null);

    // Perspective Display Name
    const perspectiveDisplayName = useMemo(() => {
        if (isHousehold) return "Combined Household";
        if (activeMember) return activeMember.display_name;
        const clean = perspective.toLowerCase();
        if (clean.includes("yijia")) return "Yi Jia";
        if (clean.includes("rachel")) return "Rachel";
        return perspective;
    }, [isHousehold, activeMember, perspective]);

    // Load all dashboard data
    const loadDashboardData = useCallback(async () => {
        try {
            setIsLoading(true);
            const currentMonth = getCurrentMonth();
            const targetMemberId = activeMember
                ? activeMember.id
                : members[0]?.id;

            const [
                accountsData,
                loansData,
                goalsData,
                policiesData,
                expensesData,
                budgetData,
                categoriesData,
            ] = await Promise.all([
                financeService.getAccounts(perspective),
                financeService.getLoans(),
                financeService.getGoals(),
                financeService.getPolicies(),
                financeService.getExpenses(),
                financeService.getMonthlyBudget(currentMonth, targetMemberId),
                financeService.getCategories(),
            ]);

            setAccounts(accountsData || []);
            setLoans(loansData || []);
            setGoals(goalsData || []);
            setPolicies(policiesData || []);
            setExpenses(expensesData || []);
            setMonthlyBudget(budgetData || null);
            setCategories(categoriesData || []);
        } catch (err) {
            console.error("Failed to load dashboard data:", err);
        } finally {
            setIsLoading(false);
        }
    }, [perspective, activeMember, members]);

    useEffect(() => {
        loadDashboardData();
    }, [loadDashboardData]);

    // Net Worth Calculations
    const totalAssets = useMemo(() => {
        const sum = accounts.reduce((acc, a) => acc + a.balance, 0);
        return Math.round(sum * 100) / 100;
    }, [accounts]);

    const activeLoans = useMemo(() => {
        return loans.filter((l) => {
            if (l.status !== "active") return false;
            if (isHousehold) return true;
            return !l.borrower_id || l.borrower_id === activeMember?.id;
        });
    }, [loans, isHousehold, activeMember]);

    const totalLiabilities = useMemo(() => {
        const sum = activeLoans.reduce((acc, l) => {
            const remaining = l.principal - l.amount_paid;
            if (!isHousehold && !l.borrower_id) {
                return acc + remaining * 0.5; // 50% split for joint household loan in personal view
            }
            return acc + remaining;
        }, 0);
        return Math.round(sum * 100) / 100;
    }, [activeLoans, isHousehold]);

    const trueNetWorth = useMemo(() => {
        return Math.round((totalAssets - totalLiabilities) * 100) / 100;
    }, [totalAssets, totalLiabilities]);

    // Spendable budget remaining for the mobile daily briefing
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

        return {
            totalSpendableAllocated: totalAllocated,
            totalSpent,
            totalRemaining,
            categories: spendableItems,
        };
    }, [monthlyBudget]);

    // Personal perspective transactions
    const personalExpenses = useMemo(() => {
        if (isHousehold || !activeMember) return [];
        return expenses
            .filter((e) => e.payer_id === activeMember.id)
            .slice(0, 5);
    }, [isHousehold, activeMember, expenses]);

    // Modal Handlers
    const handleOpenUpdateBalance = (account?: Account) => {
        if (account) {
            setSelectedAccountForUpdate(account);
            setIsUpdateBalanceOpen(true);
            return;
        }

        // Tapped without specific account (e.g. from top Dashboard header)
        if (accounts.length === 0) {
            // Gracefully handle 0 accounts by opening AddAccountModal with welcome banner
            setIsAddAccountOpen(true);
        } else {
            // Open multi-account selection update modal
            setSelectedAccountForUpdate(null);
            setIsUpdateBalanceOpen(true);
        }
    };

    const handleExpenseAdded = async () => {
        await loadDashboardData();
        await refreshHousehold();
    };

    const handleBalanceUpdated = async () => {
        await loadDashboardData();
        await refreshHousehold();
    };

    const handleSettled = async () => {
        await loadDashboardData();
        await refreshHousehold();
    };

    return (
        <div className={`space-y-5 pb-20 md:pb-12 ${className}`}>
            {/* Top Header */}
            <PageHeader
                title="Home"
            />

            {/* Loading Indicator */}
            {isLoading ? (
                <div className="flex items-center justify-center p-16 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex flex-col items-center gap-3 text-slate-500">
                        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
                        <span className="text-sm font-medium">
                            Loading household overview...
                        </span>
                    </div>
                </div>
            ) : (
                <>
                    {/* GAMIFIED DAILY CHECK-IN STREAK BAR */}
                    <DailyCheckinStreakBar
                        memberId={activeMember?.id}
                        onCheckinSuccess={refreshHousehold}
                    />

                    {/* Category Budget Limit Guardrail Alerts */}
                    <CategoryLimitWarningBanner
                        categories={monthlyBudget?.categories || []}
                        onNavigateCategory={() => onNavigateTab?.("budget")}
                    />

                    {/* DAILY SPEND & CHECK-IN HERO STRIP (Optimized for Fast Mobile Checking) */}
                    <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-(--shadow-cute)">
                        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b-[1.5px] border-(--border-subtle)">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#dfc2ff] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                                    <Wallet className="h-4 w-4 stroke-[2.5]" />
                                </div>
                                <h3 className="text-sm font-black text-(--text-ink) font-display">
                                    Daily Spend &amp; Monthly Limits
                                </h3>
                            </div>

                            {/* Settlement Pill if in household view */}
                            {isHousehold && overview?.settlementSummary && (
                                <div
                                    onClick={() => onNavigateTab?.("expenses")}
                                    className="inline-flex items-center gap-1.5 rounded-full bg-[#dfc2ff]/30 px-3 py-1 text-xs font-bold text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) cursor-pointer hover:bg-[#dfc2ff]/50 transition-colors"
                                >
                                    <ArrowRightLeft className="h-3 w-3 stroke-[2.5]" />
                                    <span>
                                        Settlement:{" "}
                                        {
                                            overview.settlementSummary
                                                .settlementText
                                        }
                                    </span>
                                    <ChevronRight className="h-3 w-3 stroke-[2.5]" />
                                </div>
                            )}
                        </div>

                        {/* Spendable Progress Grid */}
                        <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            {spendableSummary.categories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3 shadow-(--shadow-cute-sm)"
                                >
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-(--text-ink) flex items-center gap-1.5 font-display">
                                            <span
                                                className="h-2.5 w-2.5 rounded-full shrink-0 border border-[#1a1a1a]"
                                                style={{
                                                    backgroundColor: cat.color,
                                                }}
                                            />
                                            <span className="truncate">
                                                {cat.name}
                                            </span>
                                        </span>
                                        <span className="text-[11px] font-black text-(--text-muted) font-mono-num">
                                            {cat.pct}%
                                        </span>
                                    </div>

                                    <div className="mt-2 flex items-baseline justify-between text-xs font-mono-num">
                                        <span className="font-extrabold text-(--text-ink)">
                                            {formatSGD(cat.spent)}
                                        </span>
                                        <span className="text-[10px] font-bold text-(--text-muted)">
                                            / {formatSGD(cat.allocated)}
                                        </span>
                                    </div>

                                    {/* Progress bar */}
                                    <div className="mt-2 h-2 w-full rounded-full bg-(--bg-card) border border-(--border-ink)/30 overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all"
                                            style={{
                                                width: `${cat.pct}%`,
                                                backgroundColor:
                                                    cat.pct > 100
                                                        ? "#f76b57"
                                                        : cat.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Bottom Spendable Remaining */}
                        <div className="mt-4 pt-3 border-t-[1.5px] border-(--border-subtle) flex items-center justify-between text-xs">
                            <span className="text-(--text-muted) font-semibold">
                                Spendable remaining this month:{" "}
                                <strong
                                    className={`font-mono-num text-sm font-black ${
                                        spendableSummary.totalRemaining < 0
                                            ? "text-[#9a1b1b] dark:text-rose-400"
                                            : "text-[#14532d] dark:text-[#86efac]"
                                    }`}
                                >
                                    {formatSGD(spendableSummary.totalRemaining)}
                                </strong>
                            </span>
                        </div>
                    </div>

                    {/* 1. True Net Worth Hero Card */}
                    <NetWorthHeroCard
                        netWorth={trueNetWorth}
                        totalAssets={totalAssets}
                        totalLiabilities={totalLiabilities}
                        perspective={perspective}
                        perspectiveName={perspectiveDisplayName}
                        onUpdateBalance={() => handleOpenUpdateBalance()}
                    />

                    {/* COMBINED HOUSEHOLD PERSPECTIVE VIEW */}
                    {isHousehold ? (
                        <>
                            {/* 2. Splitwise-style Running Settlement Widget */}
                            <SettlementWidget
                                summary={overview?.settlementSummary}
                                members={members}
                                expenses={expenses}
                                onSettled={handleSettled}
                            />

                            {/* 3. Two-Column Grid: Goals Milestones & Upcoming Bills */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <SharedGoalsOverview
                                    goals={goals}
                                    onViewAll={() => onNavigateTab?.("goals")}
                                />
                                <UpcomingBillsWidget
                                    policies={policies}
                                    onViewAll={() =>
                                        onNavigateTab?.("recurring")
                                    }
                                />
                            </div>
                        </>
                    ) : (
                        /* PERSONAL PERSPECTIVE VIEW (Yi Jia / Rachel / Member N) */
                        <div className="space-y-5">
                            {/* Personal Monthly Budget Progress */}
                            <div
                                role="region"
                                aria-label="Personal Budget Progress"
                                className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-(--shadow-cute) transition-colors"
                            >
                                <div className="flex items-center justify-between gap-3 pb-4 border-b-[1.5px] border-(--border-subtle)">
                                    <div className="flex items-center gap-2.5">
                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#dfc2ff] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                                            <PieChart className="h-4 w-4 stroke-[2.5]" />
                                        </div>
                                        <h3 className="text-sm sm:text-base font-black text-(--text-ink) font-display">
                                            Personal Monthly Budget
                                        </h3>
                                    </div>

                                    {onNavigateTab && (
                                        <button
                                            type="button"
                                            onClick={() =>
                                                onNavigateTab("budget")
                                            }
                                            className="text-xs font-bold text-[#7e22ce] dark:text-[#dfc2ff] hover:underline cursor-pointer"
                                        >
                                            View Full Budget
                                        </button>
                                    )}
                                </div>

                                {/* 4 Metric Cards for Personal Budget */}
                                <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
                                    {/* Gross Salary */}
                                    <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-(--shadow-cute-sm)">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                                            Gross Salary
                                        </span>
                                        <div className="mt-1 text-base sm:text-lg font-black text-(--text-ink) font-mono-num">
                                            {formatSGD(
                                                monthlyBudget?.budget
                                                    .gross_salary || 0,
                                            )}
                                        </div>
                                    </div>

                                    {/* CPF Deduction */}
                                    <div className="rounded-2xl border-2 border-(--border-ink) bg-[#fff1ee] dark:bg-[#3d1c1a] p-3.5 shadow-(--shadow-cute-sm)">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#9a1b1b] dark:text-[#fca5a5]">
                                            CPF (20%)
                                        </span>
                                        <div className="mt-1 text-base sm:text-lg font-black text-[#9a1b1b] dark:text-rose-400 font-mono-num">
                                            -
                                            {formatSGD(
                                                monthlyBudget?.budget
                                                    .cpf_deduction || 0,
                                            )}
                                        </div>
                                    </div>

                                    {/* Disposable / Take-Home */}
                                    <div className="rounded-2xl border-2 border-(--border-ink) bg-[#f0fdf4] dark:bg-[#13351d] p-3.5 shadow-(--shadow-cute-sm)">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#14532d] dark:text-[#86efac]">
                                            Take-Home Pay
                                        </span>
                                        <div className="mt-1 text-base sm:text-lg font-black text-[#14532d] dark:text-white font-mono-num">
                                            {formatSGD(
                                                monthlyBudget?.disposablePool ||
                                                    0,
                                            )}
                                        </div>
                                    </div>

                                    {/* Spent & Remaining */}
                                    <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-(--shadow-cute-sm)">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                                            Spent / Left
                                        </span>
                                        <div className="mt-1 flex items-baseline justify-between gap-1 flex-wrap">
                                            <span className="text-base sm:text-lg font-black text-(--text-ink) font-mono-num">
                                                {formatSGD(
                                                    monthlyBudget?.totalSpent ||
                                                        0,
                                                )}
                                            </span>
                                            <span
                                                className={`text-xs font-black font-mono-num ${
                                                    (monthlyBudget?.totalRemaining ||
                                                        0) < 0
                                                        ? "text-[#9a1b1b] dark:text-rose-400"
                                                        : "text-[#14532d] dark:text-[#86efac]"
                                                }`}
                                            >
                                                Left{" "}
                                                {formatSGD(
                                                    monthlyBudget?.totalRemaining ||
                                                        0,
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Personal Accounts & Recent Personal Transactions */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                                {/* Personal Accounts List */}
                                <div
                                    role="region"
                                    aria-label="Personal Accounts"
                                    className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-(--shadow-cute) transition-colors"
                                >
                                    <div className="flex items-center justify-between pb-4 border-b-[1.5px] border-(--border-subtle)">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#fcbffa] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                                                <Landmark className="h-4 w-4 stroke-[2.5]" />
                                            </div>
                                            <h3 className="text-sm sm:text-base font-black text-(--text-ink) font-display">
                                                Personal Accounts
                                            </h3>
                                        </div>
                                        {onNavigateTab && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onNavigateTab("accounts")
                                                }
                                                className="text-xs font-bold text-(--text-muted) hover:text-[#7e22ce] dark:hover:text-[#dfc2ff] transition-colors cursor-pointer"
                                            >
                                                View All
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 space-y-2.5">
                                        {accounts.length === 0 ? (
                                            <div className="py-6 text-center">
                                                <p className="text-xs font-medium text-(--text-muted) mb-3">
                                                    No accounts found for this
                                                    perspective.
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        setIsAddAccountOpen(
                                                            true,
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-[#1a1a1a] bg-[#dfc2ff] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-all cursor-pointer"
                                                >
                                                    <Plus className="h-3.5 w-3.5 stroke-[2.5]" />
                                                    <span>
                                                        Add First Account
                                                    </span>
                                                </button>
                                            </div>
                                        ) : (
                                            accounts.map((acc) => (
                                                <div
                                                    key={acc.id}
                                                    className="flex items-center justify-between gap-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-(--shadow-cute-sm)"
                                                >
                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white dark:bg-[#382f18] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) text-xs font-black text-(--text-ink) font-mono-num shrink-0">
                                                            {acc.institution?.slice(
                                                                0,
                                                                3,
                                                            ) ||
                                                                acc.type.slice(
                                                                    0,
                                                                    3,
                                                                )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <TruncatedText
                                                                    text={
                                                                        acc.name
                                                                    }
                                                                    className="text-sm font-bold text-(--text-ink)"
                                                                />
                                                                {acc.is_joint && (
                                                                    <span className="rounded-full bg-[#dfc2ff]/50 border border-(--border-ink) px-2 py-0.5 text-[10px] font-black text-[#1a1a1a] shrink-0">
                                                                        Joint
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <span className="text-[11px] font-medium text-(--text-muted) block truncate">
                                                                {acc.type} •{" "}
                                                                {acc.institution ||
                                                                    "Bank"}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    <div className="text-right shrink-0">
                                                        <div className="text-sm font-black text-(--text-ink) font-mono-num">
                                                            {formatSGD(
                                                                acc.balance,
                                                            )}
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleOpenUpdateBalance(
                                                                    acc,
                                                                )
                                                            }
                                                            className="text-[11px] font-bold text-[#7e22ce] dark:text-[#dfc2ff] hover:underline cursor-pointer"
                                                        >
                                                            Update
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>

                                {/* Recent Personal Transactions */}
                                <div
                                    role="region"
                                    aria-label="Recent Transactions"
                                    className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 sm:p-5 shadow-(--shadow-cute) transition-colors"
                                >
                                    <div className="flex items-center justify-between pb-4 border-b-[1.5px] border-(--border-subtle)">
                                        <div className="flex items-center gap-2.5">
                                            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#bbf7d0] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                                                <Receipt className="h-4 w-4 stroke-[2.5]" />
                                            </div>
                                            <h3 className="text-sm sm:text-base font-black text-(--text-ink) font-display">
                                                Recent Expenses
                                            </h3>
                                        </div>
                                        {onNavigateTab && (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    onNavigateTab("expenses")
                                                }
                                                className="text-xs font-bold text-(--text-muted) hover:text-[#7e22ce] dark:hover:text-[#dfc2ff] transition-colors cursor-pointer"
                                            >
                                                View Ledger
                                            </button>
                                        )}
                                    </div>

                                    <div className="mt-4 space-y-2.5">
                                        {personalExpenses.length === 0 ? (
                                            <p className="text-xs font-medium text-(--text-muted) py-6 text-center">
                                                No recent transactions paid by{" "}
                                                {perspectiveDisplayName}.
                                            </p>
                                        ) : (
                                            personalExpenses.map((exp) => (
                                                <div
                                                    key={exp.id}
                                                    className="flex items-center justify-between gap-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-(--shadow-cute-sm)"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <TruncatedText
                                                            text={exp.item}
                                                            className="text-sm font-bold text-(--text-ink)"
                                                        />
                                                        <div className="flex items-center gap-2 mt-0.5 text-xs text-(--text-muted)">
                                                            <span>
                                                                {formatDisplayDate(
                                                                    exp.date,
                                                                )}
                                                            </span>
                                                            {exp.is_shared && (
                                                                <span className="inline-flex items-center gap-0.5 rounded-full bg-[#dfc2ff]/40 border border-(--border-ink) px-2 py-0.5 text-[10px] font-black text-[#1a1a1a] shrink-0">
                                                                    Shared (50%)
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="text-sm font-black text-(--text-ink) font-mono-num text-right shrink-0">
                                                        {formatSGD(exp.amount)}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Quick Add Expense Modal */}
            <QuickAddExpenseModal
                isOpen={isQuickAddOpen}
                onClose={() => setIsQuickAddOpen(false)}
                onExpenseAdded={handleExpenseAdded}
                defaultPayerId={activeMember?.id}
                categories={categories.length > 0 ? categories : mockCategories}
                members={members}
            />

            {/* Update Balance Modal (Supports both single target and multi-account batch update) */}
            <UpdateBalanceModal
                isOpen={isUpdateBalanceOpen}
                account={selectedAccountForUpdate}
                accounts={accounts}
                onClose={() => {
                    setIsUpdateBalanceOpen(false);
                    setSelectedAccountForUpdate(null);
                }}
                onBalanceUpdated={handleBalanceUpdated}
                onBalancesUpdated={handleBalanceUpdated}
                onOpenAddAccount={() => setIsAddAccountOpen(true)}
            />

            {/* Add Account Modal */}
            <AddAccountModal
                isOpen={isAddAccountOpen}
                onClose={() => setIsAddAccountOpen(false)}
                members={members}
                defaultOwnerId={activeMember?.id}
                isInitialSetup={accounts.length === 0}
                onAccountCreated={async () => {
                    await loadDashboardData();
                    await refreshHousehold();
                }}
            />
        </div>
    );
}

export default DashboardPage;
