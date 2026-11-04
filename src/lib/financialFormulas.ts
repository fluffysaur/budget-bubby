/**
 * Mathematical Calculation & Business Logic Engines for Budget Bubby.
 * Covers:
 * 1. Singapore CPF (20%) & Net Take-Home Pay
 * 2. Disposable Budget Allocation Pool
 * 3. Category Target Allocations
 * 4. Couple Shared Expense Settlement ("Who Owes Whom")
 * 5. Savings Goal Pacing Indicator
 */

import type {
    Account,
    AccountSnapshot,
    BonusAllocationResult,
    Category,
    Expense,
    ExpenseTrendsSummary,
    MonthlyBalancePoint,
    MonthlyExpenseTrendPoint,
    Perspective,
    RecurringItem,
    CPFAndNetPayResult,
    CategoryAllocationTarget,
    CategoryAllocation,
    SettlementSummary,
    GoalPacingResult,
    GoalStatus,
    MonthlySurplusPoint,
    CumulativeSurplusSummary,
    CategoryLimitAlert,
    MonthlyBudgetCategoryDetail,
    SpendablePacingResult,
    BaseBudgetProfile,
    BaseProfileAllocation,
    MonthlyBudgetDetail,
} from "../types/finance";
import {
    addMonths,
    monthsBetween,
    getTodayDateString,
    getCurrentMonth,
    formatShortMonth,
} from "./dateUtils";
import { formatSGD } from "./currency";
import { calculateRecurringCategorySpend } from "./recurringItems";

/**
 * 1. Calculates Singapore CPF deduction (default 20% employee rate) and net take-home pay.
 * Formula:
 *   CPF Deduction = round(Gross Salary * CPF Rate)
 *   Take-Home Pay = Gross Salary - CPF Deduction + Bonus
 */
export function calculateCPFAndNetPay(
    grossSalary: number,
    cpfRate: number = 0.2,
    bonus: number = 0,
): CPFAndNetPayResult {
    if (grossSalary <= 0) {
        return {
            cpfDeduction: 0,
            takeHomePay: Math.round(bonus * 100) / 100,
        };
    }

    const cpfDeduction = Math.round(grossSalary * cpfRate * 100) / 100;
    const takeHomePay =
        Math.round((grossSalary - cpfDeduction + bonus) * 100) / 100;

    return {
        cpfDeduction,
        takeHomePay,
    };
}

/**
 * 2. Calculates after-deductions disposable budget pool.
 * Formula:
 *   Disposable = Take-Home Pay - (Taxes Monthly + Insurance Monthly)
 */
export function calculateDisposableBudget(
    takeHomePay: number,
    taxesMonthly: number = 0,
    insuranceMonthly: number = 0,
): number {
    const result = takeHomePay - taxesMonthly - insuranceMonthly;
    return Math.round(result * 100) / 100;
}

/**
 * 3. Allocates the disposable budget across budget categories according to target percentages.
 * Formula:
 *   Budget(C_i) = round(After Deductions * TargetPercentage(C_i))
 */
export function calculateCategoryAllocations(
    afterDeductions: number,
    targets: CategoryAllocationTarget[],
): CategoryAllocation[] {
    if (!targets || targets.length === 0) {
        return [];
    }

    return targets.map((target) => ({
        categoryId: target.categoryId,
        allocatedAmount:
            Math.round(afterDeductions * target.percentage * 100) / 100,
    }));
}

/**
 * 5. Calculates couple shared expense settlement ("Who owes whom").
 * Only considers unsettled (`settled: false`) expenses where `is_shared: true`.
 * Default split ratio is 50/50 (0.50), or uses custom split_ratio.
 */
export function calculateSharedExpenseSettlement(
    expenses: Expense[],
    member1Id: string,
    member2Id: string,
    member1Name?: string,
    member2Name?: string,
): SettlementSummary {
    let member2OwesMember1 = 0;
    let member1OwesMember2 = 0;

    const relevantExpenses = expenses.filter(
        (e) =>
            e.is_shared &&
            !e.settled &&
            (e.payer_id === member1Id || e.payer_id === member2Id),
    );

    for (const exp of relevantExpenses) {
        const partnerRatio = exp.split_ratio ?? 0.5;
        const partnerShare = Math.round(exp.amount * partnerRatio * 100) / 100;

        if (exp.payer_id === member1Id) {
            member2OwesMember1 += partnerShare;
        } else if (exp.payer_id === member2Id) {
            member1OwesMember2 += partnerShare;
        }
    }

    member2OwesMember1 = Math.round(member2OwesMember1 * 100) / 100;
    member1OwesMember2 = Math.round(member1OwesMember2 * 100) / 100;

    const netDiff =
        Math.round((member2OwesMember1 - member1OwesMember2) * 100) / 100;

    const m1Display = member1Name || "Member 1";
    const m2Display = member2Name || "Member 2";

    if (netDiff > 0) {
        // member2 owes member1
        return {
            netBalance: netDiff,
            debtorId: member2Id,
            creditorId: member1Id,
            debtorName: m2Display,
            creditorName: m1Display,
            settlementText: `${m2Display} owes ${m1Display} ${formatSGD(netDiff)}`,
            member1OwesMember2,
            member2OwesMember1,
        };
    } else if (netDiff < 0) {
        // member1 owes member2
        const absNet = Math.abs(netDiff);
        return {
            netBalance: absNet,
            debtorId: member1Id,
            creditorId: member2Id,
            debtorName: m1Display,
            creditorName: m2Display,
            settlementText: `${m1Display} owes ${m2Display} ${formatSGD(absNet)}`,
            member1OwesMember2,
            member2OwesMember1,
        };
    } else {
        // Zero balance
        return {
            netBalance: 0,
            debtorId: null,
            creditorId: null,
            debtorName: undefined,
            creditorName: undefined,
            settlementText: "All settled up",
            member1OwesMember2,
            member2OwesMember1,
        };
    }
}

/**
 * 6. Calculates savings goal pacing status and required monthly contribution.
 * Formula:
 *   Months Remaining = max(monthsBetween(today, targetDate), 1)
 *   Needed Per Month = max(targetAmount - savedSoFar, 0) / Months Remaining
 * Status:
 *   - 'achieved': savedSoFar >= targetAmount
 *   - 'on_track': monthlyContribution >= neededPerMonth
 *   - 'behind': monthlyContribution < neededPerMonth
 */
export function calculateGoalPacing(
    targetAmount: number,
    savedSoFar: number,
    targetDate: string,
    monthlyContribution: number,
    referenceDate?: string | Date,
): GoalPacingResult {
    if (savedSoFar >= targetAmount) {
        return {
            status: "achieved",
            monthsRemaining: 0,
            neededPerMonth: 0,
        };
    }

    const ref = referenceDate || getTodayDateString();
    const rawMonths = monthsBetween(ref, targetDate);
    const monthsRemaining = Math.max(rawMonths, 1);
    const remainingNeeded = Math.max(targetAmount - savedSoFar, 0);
    const neededPerMonth =
        Math.round((remainingNeeded / monthsRemaining) * 100) / 100;

    const status: GoalStatus =
        monthlyContribution >= neededPerMonth ? "on_track" : "behind";

    return {
        status,
        monthsRemaining,
        neededPerMonth,
    };
}

/**
 * 7. Determines whether a category belongs to day-to-day Spendable Budget
 * ('Food', 'Lifestyle', 'Transport', 'Buffer') vs. Wealth/Fixed Allocations
 * ('Investments', 'Savings', 'Tithing').
 */
export function isSpendableCategory(
    categoryOrName?: Category | string | null,
): boolean {
    if (!categoryOrName) return true;
    if (typeof categoryOrName === "object") {
        if (categoryOrName.group) {
            return categoryOrName.group === "spendable";
        }
        return isSpendableCategory(categoryOrName.name);
    }

    const clean = categoryOrName.toLowerCase().trim();
    if (
        clean.includes("invest") ||
        clean.includes("saving") ||
        clean.includes("tith")
    ) {
        return false;
    }
    return true;
}

/**
 * 8. Computes a member's effective share of an expense based on perspective and 50/50 split.
 * - In 'household' perspective: returns full expense amount.
 * - In personal perspective:
 *   - Personal expense (!is_shared): 100% if payer_id === memberId, else 0.
 *   - Shared expense (is_shared): (1 - split_ratio) if payer_id === memberId, else split_ratio.
 */
export function getMemberExpenseShare(
    expense: Expense,
    memberId?: string,
    perspective: Perspective = "household",
): number {
    if (perspective === "household" || !memberId) {
        return Math.round(Number(expense.amount) * 100) / 100;
    }

    const amount = Number(expense.amount) || 0;
    const partnerRatio = expense.split_ratio ?? 0.5;

    if (!expense.is_shared) {
        return expense.payer_id === memberId
            ? Math.round(amount * 100) / 100
            : 0;
    }

    if (expense.payer_id === memberId) {
        return Math.round(amount * (1 - partnerRatio) * 100) / 100;
    }

    // Partner paid a shared household expense -> this member's share is partnerRatio (default 50%)
    return Math.round(amount * partnerRatio * 100) / 100;
}

/**
 * 9. Calculates the end-of-month balance & Net Worth series from real AccountSnapshots.
 * Nothing is invented:
 * - The series starts at the month of the earliest snapshot (or `monthsCount` months back, if later).
 * - An account counts from the month of its first snapshot onwards, at its latest
 *   snapshot on or before that month's end. Accounts added later step in when added.
 * - The current month uses live account balances, so it matches the Net Worth card.
 */
export function calculateMonthlyBalanceTrends(
    accounts: Account[],
    snapshots: AccountSnapshot[],
    monthsCount: number = 6,
    referenceMonth?: string,
): MonthlyBalancePoint[] {
    const currentM = referenceMonth || getCurrentMonth();

    const snapsByAccount = new Map<string, AccountSnapshot[]>();
    for (const snap of snapshots) {
        const list = snapsByAccount.get(snap.account_id) ?? [];
        list.push(snap);
        snapsByAccount.set(snap.account_id, list);
    }
    for (const list of snapsByAccount.values()) {
        list.sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    }

    const accountIds = new Set(accounts.map((a) => a.id));
    const snapshotMonths = snapshots
        .filter((s) => accountIds.has(s.account_id))
        .map((s) => s.snapshot_date.slice(0, 7));
    const firstMonth = snapshotMonths.length > 0 ? snapshotMonths.sort()[0] : currentM;

    const windowStart = addMonths(currentM, -(monthsCount - 1));
    const startMonth = firstMonth > windowStart ? firstMonth : windowStart;

    const months: string[] = [];
    for (let m = startMonth; m <= currentM; m = addMonths(m, 1)) {
        months.push(m);
    }

    const round2 = (n: number) => Math.round(n * 100) / 100;
    const points: MonthlyBalancePoint[] = [];

    for (const month of months) {
        const isCurrent = month === currentM;
        let cash = 0;
        let investments = 0;
        let cpf = 0;
        let other = 0;

        for (const acc of accounts) {
            let bal: number | null = null;
            if (isCurrent) {
                bal = Number(acc.balance);
            } else {
                const accSnaps = snapsByAccount.get(acc.id) ?? [];
                for (const snap of accSnaps) {
                    if (snap.snapshot_date.slice(0, 7) <= month) bal = Number(snap.balance);
                    else break;
                }
            }
            if (bal === null) continue; // Not tracked yet in this month

            if (acc.type === "Cash") cash += bal;
            else if (acc.type === "Investment") investments += bal;
            else if (acc.type === "CPF") cpf += bal;
            else other += bal;
        }

        cash = round2(cash);
        investments = round2(investments);
        cpf = round2(cpf);
        other = round2(other);

        const totalAssets = round2(cash + investments + cpf + other);
        const nonCpfAssets = round2(cash + investments + other);

        const prevPoint = points.length > 0 ? points[points.length - 1] : null;
        const momChange = prevPoint ? round2(totalAssets - prevPoint.totalAssets) : 0;
        const momChangePct =
            prevPoint && prevPoint.totalAssets > 0
                ? Math.round(((totalAssets - prevPoint.totalAssets) / prevPoint.totalAssets) * 1000) / 10
                : 0;

        points.push({
            month,
            label: formatShortMonth(month),
            cash,
            investments,
            cpf,
            other,
            totalAssets,
            nonCpfAssets,
            netWorth: totalAssets,
            nonCpfNetWorth: nonCpfAssets,
            momChange,
            momChangePct,
        });
    }

    return points;
}

/**
 * 10. Calculates Monthly Expense Trends, 3/6-month rolling averages, and Per-Category Monthly Averages.
 * Includes recurring subscription/bill/other spend under each item's own category.
 */
export function calculateExpenseTrends(
    expenses: Expense[],
    categories: Category[],
    recurringItems: RecurringItem[] = [],
    perspective: Perspective = "household",
    memberId?: string,
    currentMonth?: string,
    monthsCount: number = 6,
): ExpenseTrendsSummary {
    const refMonth = currentMonth || getCurrentMonth();
    const months: string[] = [];
    for (let i = -(monthsCount - 1); i <= 0; i++) {
        months.push(addMonths(refMonth, i));
    }

    // Spendable categories
    const spendableCats = categories.filter((c) => isSpendableCategory(c));
    const spendableIds = new Set(spendableCats.map((c) => c.id));
    const recurringOwnerId =
        perspective === "household" || !memberId ? undefined : memberId;

    const monthlySeries: MonthlyExpenseTrendPoint[] = months.map((m) => {
        const byCategory: Record<string, number> = {};
        for (const cat of spendableCats) {
            byCategory[cat.id] = 0;
        }

        // Exclude goal-funded expenses from regular monthly trends
        const monthExpenses = expenses.filter(
            (e) => e.date.startsWith(m) && !e.goal_id,
        );
        for (const exp of monthExpenses) {
            const cat = categories.find((c) => c.id === exp.category_id);
            if (cat && !isSpendableCategory(cat)) {
                continue;
            }
            const share = getMemberExpenseShare(exp, memberId, perspective);
            if (share <= 0) continue;

            const catKey =
                exp.category_id && byCategory[exp.category_id] !== undefined
                    ? exp.category_id
                    : spendableCats[0]?.id || "uncategorized";

            byCategory[catKey] =
                Math.round(((byCategory[catKey] || 0) + share) * 100) / 100;
        }

        // Add recurring subscription/bill/other spend to its own spendable category
        // (uncategorized items fall back like uncategorized expenses)
        const recurring = calculateRecurringCategorySpend(recurringItems, m, {
            ownerId: recurringOwnerId,
            knownCategoryIds: categories.map((c) => c.id),
        });
        let recurringSpent = 0;
        const addRecurring = (catKey: string, amount: number) => {
            byCategory[catKey] =
                Math.round(((byCategory[catKey] || 0) + amount) * 100) / 100;
            recurringSpent += amount;
        };
        for (const [catId, bucket] of Object.entries(recurring.byCategory)) {
            if (spendableIds.has(catId)) addRecurring(catId, bucket.total);
        }
        if (recurring.uncategorized.total > 0) {
            addRecurring(
                spendableCats[0]?.id || "uncategorized",
                recurring.uncategorized.total,
            );
        }

        const totalSpent =
            Math.round(
                Object.values(byCategory).reduce((sum, val) => sum + val, 0) *
                    100,
            ) / 100;

        return {
            month: m,
            label: formatShortMonth(m),
            totalSpent,
            recurringSpent: Math.round(recurringSpent * 100) / 100,
            byCategory,
        };
    });

    // Compute averages across months that have activity (or all months in window)
    const nonZeroSeries = monthlySeries.filter((pt) => pt.totalSpent > 0);
    const denomAll = nonZeroSeries.length > 0 ? nonZeroSeries.length : 1;
    const averageMonthlyTotal =
        Math.round(
            (nonZeroSeries.reduce((s, pt) => s + pt.totalSpent, 0) / denomAll) *
                100,
        ) / 100;

    const last3 = monthlySeries.slice(-3).filter((pt) => pt.totalSpent > 0);
    const rolling3MonthAvg =
        Math.round(
            (last3.reduce((s, pt) => s + pt.totalSpent, 0) /
                (last3.length || 1)) *
                100,
        ) / 100;

    const last6 = monthlySeries.slice(-6).filter((pt) => pt.totalSpent > 0);
    const rolling6MonthAvg =
        Math.round(
            (last6.reduce((s, pt) => s + pt.totalSpent, 0) /
                (last6.length || 1)) *
                100,
        ) / 100;

    const currentPoint = monthlySeries[monthlySeries.length - 1];
    const currentMonthTotal = currentPoint ? currentPoint.totalSpent : 0;
    const vsAverageDelta =
        Math.round((currentMonthTotal - rolling3MonthAvg) * 100) / 100;

    const categoryAverages = spendableCats.map((cat) => {
        const totalForCat = nonZeroSeries.reduce(
            (sum, pt) => sum + (pt.byCategory[cat.id] || 0),
            0,
        );
        const avg = Math.round((totalForCat / denomAll) * 100) / 100;
        const curr = currentPoint ? currentPoint.byCategory[cat.id] || 0 : 0;

        return {
            categoryId: cat.id,
            categoryName: cat.name,
            color: cat.color,
            averageMonthly: avg,
            currentMonth: curr,
        };
    });

    return {
        monthlySeries,
        averageMonthlyTotal,
        rolling3MonthAvg,
        rolling6MonthAvg,
        currentMonthTotal,
        vsAverageDelta,
        categoryAverages,
    };
}

export const calculateExpenseTrendsSummary = calculateExpenseTrends;

/**
 * 11. Calculates Bonus Allocation breakdown matching Notion's Bonus helper:
 * Default splits after 20% CPF:
 * - Tithing: 10%
 * - Goals: 40%
 * - Savings: 10%
 * - Investments: 20%
 * - Lifestyle: 20%
 */
export function calculateBonusAllocation(
    grossBonus: number,
    cpfRate: number = 0.2,
    customSplits?: Array<{ name: string; percentage: number; color: string }>,
): BonusAllocationResult {
    const safeGross = Math.max(0, Number(grossBonus) || 0);
    const cpfDeduction = Math.round(safeGross * cpfRate * 100) / 100;
    const afterCpf = Math.round((safeGross - cpfDeduction) * 100) / 100;

    const splits = customSplits || [
        { name: "Tithing", percentage: 0.1, color: "#8B5CF6" },
        { name: "Goals", percentage: 0.4, color: "#3B82F6" },
        { name: "Savings", percentage: 0.1, color: "#6366F1" },
        { name: "Investments", percentage: 0.2, color: "#10B981" },
        { name: "Lifestyle", percentage: 0.2, color: "#EC4899" },
    ];

    return {
        grossBonus: safeGross,
        cpfDeduction,
        afterCpf,
        allocations: splits.map((s) => ({
            name: s.name,
            percentage: s.percentage,
            amount: Math.round(afterCpf * s.percentage * 100) / 100,
            color: s.color,
        })),
    };
}

/**
 * 12. Evaluates category spending limit alerts for spendable categories.
 * Returns alerts for categories at or above 80% (warning) or 100% (exceeded).
 */
export function evaluateCategoryLimitAlerts(
    categories: MonthlyBudgetCategoryDetail[] = [],
): CategoryLimitAlert[] {
    const alerts: CategoryLimitAlert[] = [];
    for (const c of categories) {
        if (!isSpendableCategory(c.category || c.category_id)) continue;
        const allocated = c.allocated_amount || 0;
        if (allocated <= 0) continue;
        const spent = c.actualSpent || 0;
        const percentage = (spent / allocated) * 100;
        const roundedPercentage = Math.round(percentage);
        if (percentage >= 100) {
            alerts.push({
                categoryId: c.category_id,
                categoryName: c.category?.name || "Category",
                color: c.category?.color || "#EF4444",
                spent,
                allocated,
                percentage: roundedPercentage,
                severity: "exceeded",
            });
        } else if (percentage >= 80) {
            alerts.push({
                categoryId: c.category_id,
                categoryName: c.category?.name || "Category",
                color: c.category?.color || "#F59E0B",
                spent,
                allocated,
                percentage: roundedPercentage,
                severity: "warning",
            });
        }
    }
    return alerts;
}

export interface CalculateSurplusOptions {
    months: string[]; // List of 'YYYY-MM'
    monthlyCap: number | Record<string, number>;
    expenses: Expense[];
    categories?: Category[];
    memberId?: string;
    perspective?: Perspective;
}

/**
 * 13. Calculates Cumulative Spending Surplus / Deficit across months.
 * Formula:
 *   Monthly Delta = Monthly Spendable Cap - Spendable Expenses (excluding goal-funded expenses)
 *   Cumulative Surplus = Sum of Deltas across chronological history
 */
export function calculateCumulativeSurplus({
    months,
    monthlyCap,
    expenses,
    categories = [],
    memberId,
    perspective = "household",
}: CalculateSurplusOptions): CumulativeSurplusSummary {
    let runningCumulative = 0;
    const history: MonthlySurplusPoint[] = [];

    const categoryMap = new Map<string, Category>();
    for (const cat of categories) {
        categoryMap.set(cat.id, cat);
    }

    for (const m of months) {
        const cap =
            typeof monthlyCap === "number" ? monthlyCap : (monthlyCap[m] ?? 0);
        const monthExpenses = expenses.filter(
            (e) => e.date && e.date.startsWith(m),
        );

        let spent = 0;
        let goalSpent = 0;

        for (const exp of monthExpenses) {
            const cat = exp.category_id
                ? categoryMap.get(exp.category_id)
                : undefined;
            // If category is known and not spendable, exclude
            if (cat && !isSpendableCategory(cat)) {
                continue;
            }
            const share = getMemberExpenseShare(exp, memberId, perspective);
            if (share <= 0) continue;

            if (exp.goal_id) {
                // Goal-funded expense: tracked separately so it does not count against spendable budget
                goalSpent += share;
            } else {
                spent += share;
            }
        }

        const roundedCap = Math.round(cap * 100) / 100;
        const roundedSpent = Math.round(spent * 100) / 100;
        const roundedGoalSpent = Math.round(goalSpent * 100) / 100;
        const delta = Math.round((roundedCap - roundedSpent) * 100) / 100;
        runningCumulative = Math.round((runningCumulative + delta) * 100) / 100;

        history.push({
            month: m,
            cap: roundedCap,
            spent: roundedSpent,
            goalSpent: roundedGoalSpent,
            delta,
            cumulative: runningCumulative,
        });
    }

    const currentMonth = months[months.length - 1];
    const currentPoint =
        history.find((h) => h.month === currentMonth) ||
        history[history.length - 1];

    return {
        currentMonthSurplus: currentPoint ? currentPoint.delta : 0,
        cumulativeSurplus: runningCumulative,
        monthlyHistory: history,
    };
}

export interface CalculateSpendablePacingOptions {
    month: string;
    todayDate?: string;
    memberId?: string;
    perspective?: Perspective;
    expenses: Expense[];
    categories?: Category[];
    monthlyCap?: number;
    baseProfiles?: BaseBudgetProfile[];
    baseAllocations?: BaseProfileAllocation[];
    monthlyBudget?: MonthlyBudgetDetail | null;
}

export interface DetectSurplusOptions {
    currentMonth?: string;
    lastMonth?: string;
    memberId?: string;
    perspective?: Perspective;
    expenses: Expense[];
    categories?: Category[];
    monthlyCap?: number;
    baseProfiles?: BaseBudgetProfile[];
    baseAllocations?: BaseProfileAllocation[];
}

/**
 * 14. Calculates Spendable Budget Pacing for the month:
 * - Spendable Allocated (Cap)
 * - Spendable Spent (excluding goal-funded expenses, respecting 50/50 shared split)
 * - Spendable Remaining
 * - Dynamic Daily Pace (Remaining ÷ Days remaining in month)
 * - Pacing Status ('safe' | 'warning' | 'exceeded')
 */
export function calculateSpendablePacing({
    month,
    todayDate,
    memberId,
    perspective = "household",
    expenses,
    categories = [],
    monthlyCap,
    baseProfiles = [],
    baseAllocations = [],
    monthlyBudget,
}: CalculateSpendablePacingOptions): SpendablePacingResult {
    // Determine monthly spendable allocated
    let cap: number;
    if (monthlyCap !== undefined && monthlyCap > 0) {
        cap = monthlyCap;
    } else if (
        monthlyBudget?.spendableAllocated &&
        monthlyBudget.spendableAllocated > 0
    ) {
        cap = monthlyBudget.spendableAllocated;
    } else if (baseProfiles.length > 0 && baseAllocations.length > 0) {
        // Derive from base profiles & allocations
        const activeProfiles =
            perspective === "household" || !memberId
                ? baseProfiles
                : baseProfiles.filter(
                      (p) => p.owner_id === memberId || p.id === memberId,
                  );

        let totalCap = 0;
        for (const prof of activeProfiles) {
            const takeHome = Math.max(
                0,
                prof.gross_salary * (1 - (prof.cpf_employee_rate ?? 0.2)),
            );
            const profAllocs = baseAllocations.filter(
                (a) => a.profile_id === prof.id,
            );
            for (const a of profAllocs) {
                const cat = categories.find((c) => c.id === a.category_id);
                if (cat && isSpendableCategory(cat)) {
                    totalCap += takeHome * (a.target_percentage || 0);
                }
            }
        }
        cap = totalCap > 0 ? totalCap : 1500;
    } else {
        cap = 1500;
    }

    // Calculate actual spendable spent this month
    const categoryMap = new Map<string, Category>();
    for (const cat of categories) {
        categoryMap.set(cat.id, cat);
    }

    const monthExpenses = expenses.filter(
        (e) => e.date && e.date.startsWith(month),
    );
    let spent = 0;
    for (const exp of monthExpenses) {
        // Skip goal-funded expenses
        if (exp.goal_id) continue;

        const cat = exp.category_id
            ? categoryMap.get(exp.category_id)
            : undefined;
        if (cat && !isSpendableCategory(cat)) continue;

        const share = getMemberExpenseShare(exp, memberId, perspective);
        if (share > 0) {
            spent += share;
        }
    }

    // A budget's own spent figure also counts recurring items billed to
    // spendable categories, so prefer it to keep Home, Budget and Expenses in step
    if (monthlyBudget?.spendableSpent !== undefined) {
        spent = monthlyBudget.spendableSpent;
    }

    const spendableAllocated = Math.round(cap * 100) / 100;
    const spendableSpent = Math.round(spent * 100) / 100;
    const spendableRemaining =
        Math.round((spendableAllocated - spendableSpent) * 100) / 100;

    // Days in month calculation
    const parts = month.split("-");
    const year = parseInt(parts[0], 10) || 2026;
    const monthNum = parseInt(parts[1], 10) || 10;
    const daysInMonth = new Date(year, monthNum, 0).getDate();

    // Active / current day calculations
    const todayStr = todayDate || getTodayDateString();
    const currentMonthStr = todayStr.slice(0, 7);
    const isCurrentMonth = month === currentMonthStr;

    let dayOfMonth: number;
    let daysRemaining: number;
    let dynamicDailyPace: number;

    if (isCurrentMonth) {
        dayOfMonth = parseInt(todayStr.slice(8, 10), 10) || 1;
        daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);
        dynamicDailyPace =
            spendableRemaining > 0
                ? Math.round((spendableRemaining / daysRemaining) * 100) / 100
                : 0;
    } else if (month < currentMonthStr) {
        // Past month
        dayOfMonth = daysInMonth;
        daysRemaining = 0;
        dynamicDailyPace = 0;
    } else {
        // Future month
        dayOfMonth = 0;
        daysRemaining = daysInMonth;
        dynamicDailyPace =
            spendableRemaining > 0
                ? Math.round((spendableRemaining / daysInMonth) * 100) / 100
                : 0;
    }

    const progressPercent =
        spendableAllocated > 0
            ? Math.round((spendableSpent / spendableAllocated) * 100)
            : 0;

    let pacingStatus: "safe" | "warning" | "exceeded" = "safe";
    if (spendableRemaining < 0) {
        pacingStatus = "exceeded";
    } else if (progressPercent >= 85) {
        pacingStatus = "warning";
    }

    return {
        spendableAllocated,
        spendableSpent,
        spendableRemaining,
        daysInMonth,
        dayOfMonth,
        daysRemaining,
        dynamicDailyPace,
        isCurrentMonth,
        pacingStatus,
        progressPercent,
    };
}

/**
 * 15. Detects unspent surplus from the preceding month to prompt month-end sweep.
 */
export function detectUnspentMonthEndSurplus({
    currentMonth,
    lastMonth,
    memberId,
    perspective = "household",
    expenses,
    categories = [],
    monthlyCap,
    baseProfiles,
    baseAllocations,
}: DetectSurplusOptions): {
    hasUnspentSurplus: boolean;
    surplusAmount: number;
    lastMonth: string;
} {
    const activeCurrentMonth = currentMonth || getCurrentMonth();
    const targetLastMonth = lastMonth || addMonths(activeCurrentMonth, -1);

    const pastPacing = calculateSpendablePacing({
        month: targetLastMonth,
        todayDate: `${activeCurrentMonth}-01`,
        memberId,
        perspective,
        expenses,
        categories,
        monthlyCap,
        baseProfiles,
        baseAllocations,
    });

    const hasUnspentSurplus = pastPacing.spendableRemaining > 0;
    const surplusAmount = hasUnspentSurplus ? pastPacing.spendableRemaining : 0;

    return {
        hasUnspentSurplus,
        surplusAmount,
        lastMonth: targetLastMonth,
    };
}

/**
 * 16. Converts a monthly dollar target into a percentage (0-100) of the disposable pool,
 * rounded to 4 decimal places so fixed dollar amounts reconstruct to the exact cent.
 */
export function dollarToPercentage(
    dollarAmount: number,
    disposablePool: number,
): number {
    if (disposablePool <= 0 || dollarAmount <= 0 || isNaN(dollarAmount)) {
        return 0;
    }
    const rawPct = (dollarAmount / disposablePool) * 100;
    return Math.min(100, Math.max(0, Math.round(rawPct * 10000) / 10000));
}

/**
 * 17. Parses an allocation input string that may be a dollar value ("$300", "S$300")
 * or a percentage value ("15", "15.5%").
 */
export function parseAllocationInput(
    rawInput: string,
    disposablePool: number,
): { isDollar: boolean; percentage: number; dollarAmount?: number } {
    const trimmed = (rawInput || "").trim();
    const isDollar = /^(s?\$)/i.test(trimmed) || /\$$/.test(trimmed);
    const cleanNumStr = trimmed.replace(/^(s?\$)/i, "").replace(/[$%,\s]/g, "");
    const parsed = cleanNumStr === "" ? 0 : parseFloat(cleanNumStr);
    const safeVal = isNaN(parsed) ? 0 : Math.max(0, parsed);

    if (isDollar) {
        return {
            isDollar: true,
            dollarAmount: Math.round(safeVal * 100) / 100,
            percentage: dollarToPercentage(safeVal, disposablePool),
        };
    }

    return {
        isDollar: false,
        percentage: Math.min(100, Math.round(safeVal * 10000) / 10000),
    };
}

/**
 * 18. Formats a percentage value (0-100) cleanly with up to 2 decimal places
 * (e.g., 15 -> "15%", 6.963 -> "6.96%").
 */
export function formatAllocationPercent(pct: number): string {
    const safe = isNaN(pct) ? 0 : Math.round(pct * 100) / 100;
    return `${Number(safe.toFixed(2))}%`;
}

/**
 * 19. Computes a member's monthly amortized Taxes and Insurance deductions from active recurring items.
 */
export function calculateMemberRecurringDeductions(
    recurringItems: RecurringItem[] = [],
    memberId?: string,
): { taxesMonthly: number; insuranceMonthly: number } {
    const inScope = (recurringItems || []).filter((p) => {
        if (!memberId || memberId === "household") return true;
        return p.owner_id === memberId || p.owner_id === "joint";
    });

    const getMonthlyAmount = (p: RecurringItem): number => {
        if (
            p.monthly_amortized_amount !== undefined &&
            p.monthly_amortized_amount !== null
        ) {
            return Number(p.monthly_amortized_amount) || 0;
        }
        const amt = Number(p.amount) || 0;
        return p.frequency === "annually" ? amt / 12 : amt;
    };

    const taxesMonthly =
        Math.round(
            inScope
                .filter((p) => p.type === "tax")
                .reduce((sum, p) => sum + getMonthlyAmount(p), 0) * 100,
        ) / 100;

    const insuranceMonthly =
        Math.round(
            inScope
                .filter((p) => p.type === "insurance")
                .reduce((sum, p) => sum + getMonthlyAmount(p), 0) * 100,
        ) / 100;

    return { taxesMonthly, insuranceMonthly };
}

/**
 * 20. Auto-balances unlocked category percentages proportionally to sum to exactly 100%,
 * keeping locked categories completely unchanged.
 */
export function autoBalanceAllocations<T extends string | number = number>(
    categoryIds: string[],
    currentPercentages: Record<string, number | string>,
    lockedCategories: Record<string, boolean> = {},
    returnAsString: boolean = false,
): { updatedPercentages: Record<string, T>; error?: string } {
    const unlocked = categoryIds.filter((id) => !lockedCategories[id]);
    if (unlocked.length === 0) {
        const fallback: Record<string, string | number> = {};
        categoryIds.forEach((id) => {
            fallback[id] = returnAsString
                ? String(currentPercentages[id] ?? "0")
                : Number(currentPercentages[id]) || 0;
        });
        return {
            updatedPercentages: fallback as Record<string, T>,
            error: "All categories are locked. Please unlock at least one category to auto-balance.",
        };
    }

    const lockedSum = categoryIds
        .filter((id) => lockedCategories[id])
        .reduce(
            (sum, id) =>
                sum + (parseFloat(String(currentPercentages[id] || "0")) || 0),
            0,
        );

    const targetUnlockedSum = Math.max(
        0,
        Math.round((100 - lockedSum) * 10000) / 10000,
    );
    const currentUnlockedSum = unlocked.reduce(
        (sum, id) =>
            sum + (parseFloat(String(currentPercentages[id] || "0")) || 0),
        0,
    );

    const numMap: Record<string, number> = {};
    categoryIds.forEach((id) => {
        numMap[id] = parseFloat(String(currentPercentages[id] || "0")) || 0;
    });

    if (currentUnlockedSum <= 0) {
        const baseShare =
            Math.floor((targetUnlockedSum / unlocked.length) * 100) / 100;
        let runningSum = 0;
        unlocked.forEach((id, idx) => {
            if (idx === unlocked.length - 1) {
                numMap[id] =
                    Math.round((targetUnlockedSum - runningSum) * 100) / 100;
            } else {
                numMap[id] = baseShare;
                runningSum += baseShare;
            }
        });
    } else {
        let runningAllocated = 0;
        unlocked.forEach((id, idx) => {
            if (idx === unlocked.length - 1) {
                const finalShare =
                    Math.round((targetUnlockedSum - runningAllocated) * 100) /
                    100;
                numMap[id] = Math.max(0, finalShare);
            } else {
                const current = numMap[id] || 0;
                const propShare =
                    Math.round(
                        (current / currentUnlockedSum) *
                            targetUnlockedSum *
                            100,
                    ) / 100;
                numMap[id] = Math.max(0, propShare);
                runningAllocated += propShare;
            }
        });
    }

    const finalResult: Record<string, string | number> = {};
    categoryIds.forEach((id) => {
        finalResult[id] = returnAsString ? String(numMap[id]) : numMap[id];
    });

    return { updatedPercentages: finalResult as Record<string, T> };
}
