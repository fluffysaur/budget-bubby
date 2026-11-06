/**
 * Combines each member's monthly budget into one household budget for the
 * Combined perspective. Allocations, spend and deductions are summed; category
 * percentages are recomputed against the combined take-home pool.
 */

import type {
    BonusMonthSummary,
    MonthlyBudget,
    MonthlyBudgetCategoryDetail,
    MonthlyBudgetDetail,
} from "../types/finance";

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Sums an optional field only when every member budget provides it. */
function sumOptional(
    budgets: MonthlyBudgetDetail[],
    pick: (b: MonthlyBudgetDetail) => number | undefined,
): number | undefined {
    const values = budgets.map(pick);
    if (values.some((v) => v === undefined)) return undefined;
    return round2(values.reduce<number>((s, v) => s + (v as number), 0));
}

/** Field-wise sum of member bonus summaries; undefined when no member has one. */
function combineBonusSummaries(budgets: MonthlyBudgetDetail[]): BonusMonthSummary | undefined {
    const summaries = budgets
        .map((b) => b.bonusSummary)
        .filter((s): s is BonusMonthSummary => Boolean(s));
    if (summaries.length === 0) return undefined;
    const source: BonusMonthSummary["source"] = summaries.some((s) => s.source === "events")
        ? "events"
        : summaries.some((s) => s.source === "legacy")
          ? "legacy"
          : "none";
    return {
        gross: round2(summaries.reduce((s, b) => s + b.gross, 0)),
        cpf: round2(summaries.reduce((s, b) => s + b.cpf, 0)),
        net: round2(summaries.reduce((s, b) => s + b.net, 0)),
        count: summaries.reduce((s, b) => s + b.count, 0),
        source,
    };
}

export function combineMonthlyBudgets(
    memberBudgets: MonthlyBudgetDetail[],
    month: string,
): MonthlyBudgetDetail | null {
    if (memberBudgets.length === 0) return null;

    const sum = (pick: (b: MonthlyBudgetDetail) => number | null | undefined) =>
        memberBudgets.reduce((s, b) => s + (pick(b) || 0), 0);

    const combinedAfter = round2(sum((b) => b.budget.after_deductions));

    const budget: MonthlyBudget = {
        id: `mb-combined-${month}`,
        household_id: memberBudgets[0].budget.household_id,
        owner_id: "household",
        month,
        gross_salary: sum((b) => b.budget.gross_salary),
        bonus: sum((b) => b.budget.bonus),
        cpf_deduction: sum((b) => b.budget.cpf_deduction),
        taxes_deduction: round2(sum((b) => b.budget.taxes_deduction)),
        insurance_deduction: round2(sum((b) => b.budget.insurance_deduction)),
        after_deductions: combinedAfter,
        notes: "Combined household monthly budget",
        is_locked: memberBudgets.every((b) => b.budget.is_locked),
    };

    // Merge categories across all members
    const categoryMap = new Map<string, MonthlyBudgetCategoryDetail>();
    for (const mb of memberBudgets) {
        for (const item of mb.categories) {
            const existing = categoryMap.get(item.category_id);
            if (existing) {
                const allocated = round2(existing.allocated_amount + item.allocated_amount);
                const spent = round2((existing.actualSpent || 0) + (item.actualSpent || 0));
                categoryMap.set(item.category_id, {
                    ...existing,
                    allocated_amount: allocated,
                    actualSpent: spent,
                    remaining: round2(allocated - spent),
                    percentage: combinedAfter > 0 ? allocated / combinedAfter : 0,
                    recurringSpent: round2(
                        (existing.recurringSpent || 0) + (item.recurringSpent || 0),
                    ),
                    recurringItems: [
                        ...(existing.recurringItems || []),
                        ...(item.recurringItems || []),
                    ],
                });
            } else {
                categoryMap.set(item.category_id, {
                    ...item,
                    percentage:
                        combinedAfter > 0
                            ? item.allocated_amount / combinedAfter
                            : item.percentage,
                });
            }
        }
    }

    const categories = Array.from(categoryMap.values());
    const uncategorizedRecurringSpent = round2(sum((b) => b.uncategorizedRecurringSpent));
    const uncategorizedRecurringItems = memberBudgets.flatMap(
        (mb) => mb.uncategorizedRecurringItems || [],
    );
    const totalSpent = round2(
        categories.reduce((s, c) => s + (c.actualSpent || 0), 0) +
            uncategorizedRecurringSpent,
    );

    return {
        budget,
        categories,
        disposablePool: combinedAfter,
        totalSpent,
        totalRemaining: round2(combinedAfter - totalSpent),
        spendableAllocated: sumOptional(memberBudgets, (b) => b.spendableAllocated),
        spendableSpent: sumOptional(memberBudgets, (b) => b.spendableSpent),
        spendableRemaining: sumOptional(memberBudgets, (b) => b.spendableRemaining),
        uncategorizedRecurringSpent,
        uncategorizedRecurringItems,
        bonusSummary: combineBonusSummaries(memberBudgets),
    };
}
