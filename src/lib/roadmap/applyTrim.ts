/**
 * Applies a "Trim category" trade-off to the household's Base Budget Profiles
 * and unlocked current-month budgets: reduces the trimmed spendable category
 * by `monthlyAmount` (proportionally across members with allocations in that
 * category) and shifts that amount into a Savings allocation category.
 */

import { getCurrentMonth } from "../dateUtils";
import {
    calculateCPFAndNetPay,
    calculateMemberRecurringDeductions,
} from "../financialFormulas";
import { isSavingAllocation } from "./baseline";
import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    Category,
    MonthlyBudgetDetail,
    RecurringItem,
} from "../../types/finance";

const round2 = (n: number) => Math.round(n * 100) / 100;
const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;

export interface ApplyTrimDependencies {
    categoryId: string;
    monthlyAmount: number;
    categories: Category[];
    baseProfiles: BaseBudgetProfile[];
    recurringItems?: RecurringItem[];
    currentMonth?: string;
    getBaseAllocations: (profileId: string) => Promise<BaseProfileAllocation[]>;
    getMonthlyBudget?: (
        month: string,
        memberId: string,
    ) => Promise<MonthlyBudgetDetail>;
    updateBaseProfile: (
        profile: BaseBudgetProfile,
        allocations: BaseProfileAllocation[],
    ) => Promise<void>;
}

export function findSavingsAllocationCategory(
    categories: Category[],
): Category | undefined {
    const savingCats = categories.filter((c) => isSavingAllocation(c));
    return (
        savingCats.find((c) => c.name.toLowerCase().includes("saving")) ??
        savingCats[0]
    );
}

export async function applyTrimTradeOff({
    categoryId,
    monthlyAmount,
    categories,
    baseProfiles,
    recurringItems = [],
    currentMonth = getCurrentMonth(),
    getBaseAllocations,
    getMonthlyBudget,
    updateBaseProfile,
}: ApplyTrimDependencies): Promise<void> {
    if (monthlyAmount <= 0 || baseProfiles.length === 0) return;

    const savingsCategory = findSavingsAllocationCategory(categories);
    if (!savingsCategory) {
        throw new Error("No savings allocation category found.");
    }

    interface EligibleMember {
        profile: BaseBudgetProfile;
        allocations: BaseProfileAllocation[];
        afterDeductions: number;
        memberCategoryAmount: number;
    }

    const eligible: EligibleMember[] = [];
    for (const profile of baseProfiles) {
        const allocations = await getBaseAllocations(profile.id);
        const trimmed = allocations.find((a) => a.category_id === categoryId);
        if (!trimmed || trimmed.target_percentage <= 0) continue;

        let afterDeductions = 0;
        if (getMonthlyBudget) {
            try {
                const detail = await getMonthlyBudget(
                    currentMonth,
                    profile.owner_id,
                );
                afterDeductions = Number(detail.budget.after_deductions) || 0;
            } catch {
                afterDeductions = 0;
            }
        }
        if (afterDeductions <= 0) {
            const { takeHomePay } = calculateCPFAndNetPay(
                profile.gross_salary,
                profile.cpf_employee_rate,
            );
            const { taxesMonthly, insuranceMonthly } =
                calculateMemberRecurringDeductions(
                    recurringItems,
                    profile.owner_id,
                    currentMonth,
                );
            afterDeductions = Math.max(
                0,
                round2(takeHomePay - taxesMonthly - insuranceMonthly),
            );
        }
        if (afterDeductions <= 0) continue;

        const memberCategoryAmount =
            afterDeductions * trimmed.target_percentage;
        if (memberCategoryAmount > 0) {
            eligible.push({
                profile,
                allocations,
                afterDeductions,
                memberCategoryAmount,
            });
        }
    }

    if (eligible.length === 0) return;

    const totalCategoryAmount = eligible.reduce(
        (sum, e) => sum + e.memberCategoryAmount,
        0,
    );
    const totalTrim = Math.min(monthlyAmount, totalCategoryAmount);
    let remainingTrim = totalTrim;

    for (let i = 0; i < eligible.length; i++) {
        const entry = eligible[i];
        const isLast = i === eligible.length - 1;
        const memberTrim = isLast
            ? round2(remainingTrim)
            : round2(
                  totalTrim *
                      (entry.memberCategoryAmount / totalCategoryAmount),
              );
        remainingTrim = round2(remainingTrim - memberTrim);
        if (memberTrim <= 0) continue;

        const trimmedAlloc = entry.allocations.find(
            (a) => a.category_id === categoryId,
        )!;
        const pctDelta = Math.min(
            trimmedAlloc.target_percentage,
            round6(memberTrim / entry.afterDeductions),
        );
        if (pctDelta <= 0) continue;

        const hasSavingsRow = entry.allocations.some(
            (a) => a.category_id === savingsCategory.id,
        );
        const updatedAllocations: BaseProfileAllocation[] =
            entry.allocations.map((a) => {
                if (a.category_id === categoryId) {
                    return {
                        ...a,
                        target_percentage: Math.max(
                            0,
                            round6(a.target_percentage - pctDelta),
                        ),
                    };
                }
                if (a.category_id === savingsCategory.id) {
                    return {
                        ...a,
                        target_percentage: round6(
                            a.target_percentage + pctDelta,
                        ),
                    };
                }
                return a;
            });

        if (!hasSavingsRow) {
            updatedAllocations.push({
                id:
                    typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : `alloc-trim-${Date.now()}`,
                profile_id: entry.profile.id,
                category_id: savingsCategory.id,
                target_percentage: pctDelta,
            });
        }

        await updateBaseProfile(entry.profile, updatedAllocations);
    }
}
