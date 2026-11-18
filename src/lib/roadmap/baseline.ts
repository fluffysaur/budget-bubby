/**
 * Baseline monthly savings: what the household actually puts aside.
 *
 *   savings(month) = savings-type allocation amounts
 *                  + spendable underspend (spendable cap - spendable spend)
 *
 * Averaged over the last 3-6 complete months. Category caps come from salary
 * only, so bonuses are excluded. With fewer than 3 months of history, the
 * budgeted savings (allocations only) are used and labelled "Estimate".
 *
 * The underspend alone is not savings: it is only what was left of the
 * spending budget.
 */

import { addMonths, getPastMonthsList } from "../dateUtils";
import { isSpendableCategory } from "../financialFormulas";
import { calculateRecurringCategorySpend } from "../recurringItems";
import type {
    Category,
    Expense,
    MonthlyBudgetHistoryRow,
    RecurringItem,
} from "../../types/finance";

export const BASELINE_WINDOW_MONTHS = 6;
export const BASELINE_MIN_MONTHS = 3;

/**
 * Allocation categories that are money leaving the household rather than
 * savings: giving and personal allowances.
 */
const NON_SAVING_HINTS = ["tith", "giv", "donat", "charit", "allowance"];

/** One member's stored budget for a month, with its category rows. */
export type BudgetHistoryRow = MonthlyBudgetHistoryRow;

export type BaselineSource = "actual" | "estimate" | "none";

export interface BaselineResult {
    monthlySavings: number;
    source: BaselineSource;
    /** Months averaged (actual) or the budget month used (estimate). */
    months: string[];
    perMonth: Array<{ month: string; savings: number }>;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Allocation categories that count as savings (investments, savings, funds). */
export function isSavingAllocation(category?: Category): boolean {
    if (!category || isSpendableCategory(category)) return false;
    const name = (category.name || "").toLowerCase();
    return !NON_SAVING_HINTS.some((hint) => name.includes(hint));
}

function rowsByMonth(
    rows: BudgetHistoryRow[],
): Map<string, BudgetHistoryRow[]> {
    const map = new Map<string, BudgetHistoryRow[]>();
    for (const row of rows) {
        const list = map.get(row.budget.month) ?? [];
        list.push(row);
        map.set(row.budget.month, list);
    }
    return map;
}

/**
 * Each member's budget for `month`: their row for that month, or their latest
 * earlier one when it is missing (budgets are created per member as viewed).
 */
function memberRowsFor(
    rows: BudgetHistoryRow[],
    month: string,
): BudgetHistoryRow[] {
    const latest = new Map<string, BudgetHistoryRow>();
    for (const row of rows) {
        if (row.budget.month > month) continue;
        const prev = latest.get(row.budget.owner_id);
        if (!prev || row.budget.month > prev.budget.month) {
            latest.set(row.budget.owner_id, row);
        }
    }
    return [...latest.values()];
}

/** Budgeted allocations and spendable cap for a month, across members. */
function budgetedFor(
    rows: BudgetHistoryRow[],
    categoryById: Map<string, Category>,
): { savings: number; spendableCap: number } {
    let savings = 0;
    let spendableCap = 0;
    for (const row of rows) {
        for (const c of row.categories) {
            const cat = categoryById.get(c.category_id);
            const amount = Number(c.allocated_amount) || 0;
            if (isSavingAllocation(cat)) savings += amount;
            else if (!cat || isSpendableCategory(cat)) spendableCap += amount;
        }
    }
    return { savings, spendableCap };
}

/** Household spendable spend for a month: logged expenses plus recurring bills. */
function spendableSpendFor(
    month: string,
    expenses: Expense[],
    recurringItems: RecurringItem[],
    categoryById: Map<string, Category>,
): number {
    const spendable = (categoryId?: string | null) => {
        const cat = categoryId ? categoryById.get(categoryId) : undefined;
        return !cat || isSpendableCategory(cat);
    };
    let spent = 0;
    for (const e of expenses) {
        if (!e.date?.startsWith(month) || e.goal_id) continue;
        if (spendable(e.category_id)) spent += Number(e.amount) || 0;
    }
    const recurring = calculateRecurringCategorySpend(recurringItems, month);
    for (const [categoryId, bucket] of Object.entries(recurring.byCategory)) {
        if (spendable(categoryId)) spent += bucket.total;
    }
    spent += recurring.uncategorized.total;
    return spent;
}

export interface BaselineInput {
    /** 'YYYY-MM-DD' */
    today: string;
    rows: BudgetHistoryRow[];
    categories: Category[];
    expenses: Expense[];
    recurringItems: RecurringItem[];
}

/** The months the baseline reads: the last 6 complete months plus this one. */
export function baselineMonths(today: string): string[] {
    const current = today.slice(0, 7);
    return [
        ...getPastMonthsList(addMonths(current, -1), BASELINE_WINDOW_MONTHS),
        current,
    ];
}

export function computeBaseline({
    today,
    rows,
    categories,
    expenses,
    recurringItems,
}: BaselineInput): BaselineResult {
    const categoryById = new Map(categories.map((c) => [c.id, c]));
    const byMonth = rowsByMonth(rows);
    const current = today.slice(0, 7);
    const window = getPastMonthsList(
        addMonths(current, -1),
        BASELINE_WINDOW_MONTHS,
    );
    const loggedMonths = new Set(expenses.map((e) => e.date?.slice(0, 7)));

    const perMonth = window
        .filter((m) => byMonth.has(m) && loggedMonths.has(m))
        .map((m) => {
            const { savings, spendableCap } = budgetedFor(
                memberRowsFor(rows, m),
                categoryById,
            );
            const spent = spendableSpendFor(
                m,
                expenses,
                recurringItems,
                categoryById,
            );
            return {
                month: m,
                savings: round2(savings + spendableCap - spent),
            };
        });

    if (perMonth.length >= BASELINE_MIN_MONTHS) {
        const total = perMonth.reduce((s, p) => s + p.savings, 0);
        return {
            monthlySavings: round2(total / perMonth.length),
            source: "actual",
            months: perMonth.map((p) => p.month),
            perMonth,
        };
    }

    const budgetMonth = [...byMonth.keys()]
        .filter((m) => m <= current)
        .sort()
        .pop();
    if (!budgetMonth) {
        return { monthlySavings: 0, source: "none", months: [], perMonth };
    }
    const { savings } = budgetedFor(
        memberRowsFor(rows, budgetMonth),
        categoryById,
    );
    return {
        monthlySavings: round2(savings),
        source: "estimate",
        months: [budgetMonth],
        perMonth,
    };
}
