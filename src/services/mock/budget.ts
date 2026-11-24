/** In-memory mock of the budget domain. */

import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    MonthlyBudget,
    MonthlyBudgetCategoryDetail,
    MonthlyBudgetDetail,
    MonthlyBudgetHistoryRow,
} from "../../types/finance";
import {
    calculateCPFAndNetPay,
    calculateMemberRecurringDeductions,
    getExpenseCategoryForMember,
    getMemberExpenseShare,
    isSpendableCategory,
} from "../../lib/financialFormulas";
import { calculateRecurringCategorySpend } from "../../lib/recurringItems";
import { getCurrentMonth } from "../../lib/dateUtils";
import { summarizeBonusesForMonth } from "../../lib/bonusFormulas";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class BudgetStore {
    constructor(private readonly ctx: MockContext) {}

    async getBaseProfiles(): Promise<BaseBudgetProfile[]> {
        return cloneDeep(this.ctx.state.baseProfiles);
    }

    async getBaseAllocations(
        profileId?: string,
    ): Promise<BaseProfileAllocation[]> {
        if (profileId) {
            return cloneDeep(
                this.ctx.state.baseAllocations.filter(
                    (a) => a.profile_id === profileId,
                ),
            );
        }
        return cloneDeep(this.ctx.state.baseAllocations);
    }

    async updateBaseProfile(
        profile: BaseBudgetProfile,
        allocations: BaseProfileAllocation[],
    ): Promise<void> {
        const idx = this.ctx.state.baseProfiles.findIndex(
            (p) => p.id === profile.id,
        );
        if (idx >= 0) {
            this.ctx.state.baseProfiles[idx] = {
                ...profile,
                updated_at: new Date().toISOString(),
            };
        } else {
            this.ctx.state.baseProfiles.push({
                ...profile,
                updated_at: new Date().toISOString(),
            });
        }

        // Replace allocations for this profile
        this.ctx.state.baseAllocations = this.ctx.state.baseAllocations.filter(
            (a) => a.profile_id !== profile.id,
        );
        this.ctx.state.baseAllocations.push(...cloneDeep(allocations));

        // Sync unlocked monthly budgets & category allocations for this member
        this.ctx.syncUnlockedBudgetsForOwner(profile.owner_id);

        this.ctx.persist();
    }

    async getMonthlyBudgetHistory(
        months: string[],
    ): Promise<MonthlyBudgetHistoryRow[]> {
        const wanted = new Set(months);
        return this.ctx.state.monthlyBudgets
            .filter((b) => wanted.has(b.month))
            .map((budget) => ({
                budget: cloneDeep(budget),
                categories: cloneDeep(
                    this.ctx.state.monthlyBudgetCategories.filter(
                        (c) => c.monthly_budget_id === budget.id,
                    ),
                ),
            }));
    }

    async getMonthlyBudget(
        month: string,
        memberId?: string,
    ): Promise<MonthlyBudgetDetail> {
        const currentMonth = getCurrentMonth();
        const isPast = month < currentMonth;

        let targetOwnerId = memberId;
        if (!targetOwnerId && this.ctx.state.members.length > 0) {
            targetOwnerId = this.ctx.state.members[0].id;
        }

        let budget = this.ctx.state.monthlyBudgets.find(
            (b) =>
                b.month === month &&
                (!targetOwnerId || b.owner_id === targetOwnerId),
        );

        if (budget && isPast && !budget.is_locked) {
            budget.is_locked = true;
            this.ctx.persist();
        }

        const baseProfile = this.ctx.state.baseProfiles.find(
            (p) => p.owner_id === targetOwnerId,
        );

        // If budget does not exist for this month, dynamically generate from base profile & recurring items
        if (!budget) {
            const ownerId = targetOwnerId || this.ctx.state.members[0].id;

            if (!baseProfile) {
                // Partner with no base profile gets an empty "no profile" budget, not the other partner's profile
                budget = {
                    id: `mb-dyn-${month}-${ownerId || "empty"}`,
                    household_id: this.ctx.state.household.id,
                    owner_id: ownerId,
                    month,
                    gross_salary: 0,
                    bonus: 0,
                    cpf_deduction: 0,
                    taxes_deduction: 0,
                    insurance_deduction: 0,
                    after_deductions: 0,
                    notes: "No base budget profile configured",
                    is_locked: isPast,
                    created_at: new Date().toISOString(),
                };
            } else {
                const gross = baseProfile.gross_salary;
                const rate = baseProfile.cpf_employee_rate ?? 0.2;
                const cpf = calculateCPFAndNetPay(gross, rate).cpfDeduction;

                const {
                    taxesMonthly: taxesDeduction,
                    insuranceMonthly: insuranceDeduction,
                } = calculateMemberRecurringDeductions(
                    this.ctx.state.recurringItems,
                    ownerId,
                    month,
                );

                const afterDeductions =
                    Math.round(
                        (gross - cpf - taxesDeduction - insuranceDeduction) *
                            100,
                    ) / 100;

                budget = {
                    id: `mb-${month}-${ownerId}`,
                    household_id: this.ctx.state.household.id,
                    owner_id: ownerId,
                    month,
                    gross_salary: gross,
                    bonus: 0,
                    cpf_deduction: cpf,
                    taxes_deduction: taxesDeduction,
                    insurance_deduction: insuranceDeduction,
                    after_deductions: afterDeductions,
                    notes: "Generated monthly budget",
                    is_locked: isPast,
                    created_at: new Date().toISOString(),
                };
                this.ctx.state.monthlyBudgets.push(budget);
                this.ctx.persist();
            }
        }

        let budgetCategories = this.ctx.state.monthlyBudgetCategories.filter(
            (c) => c.monthly_budget_id === budget!.id,
        );

        // Ensure categories are populated from baseAllocations if missing for dynamically generated month
        if (budgetCategories.length === 0 && baseProfile) {
            const profAllocs = this.ctx.state.baseAllocations.filter(
                (a) => a.profile_id === baseProfile.id,
            );
            const generated = profAllocs.map((alloc, idx) => ({
                id: `mbc-${budget!.id}-${idx}`,
                monthly_budget_id: budget!.id,
                category_id: alloc.category_id,
                percentage: alloc.target_percentage,
                allocated_amount:
                    Math.round(
                        budget!.after_deductions *
                            alloc.target_percentage *
                            100,
                    ) / 100,
            }));
            this.ctx.state.monthlyBudgetCategories.push(...generated);
            this.ctx.persist();
            budgetCategories = generated;
        }

        // Bonus is income, not budget: it never feeds after_deductions or category caps.
        const legacyBonus = Number(budget.bonus || 0);
        const bonusSummary = summarizeBonusesForMonth(
            this.ctx.state.bonusEvents ?? [],
            month,
            budget.owner_id,
            legacyBonus,
        );
        // Legacy rows that stored the bonus inside after_deductions: normalize unlocked months.
        let effectiveAfter = budget.after_deductions;
        if (!budget.is_locked && legacyBonus > 0) {
            effectiveAfter =
                Math.round(
                    (budget.gross_salary -
                        budget.cpf_deduction -
                        (budget.taxes_deduction || 0) -
                        (budget.insurance_deduction || 0)) *
                        100,
                ) / 100;
            budgetCategories = budgetCategories.map((bc) => ({
                ...bc,
                allocated_amount:
                    Math.round(effectiveAfter * bc.percentage * 100) / 100,
            }));
        }

        // Recurring subscription/bill/other spend for this member and month, by category
        const recurringSpend = calculateRecurringCategorySpend(
            this.ctx.state.recurringItems,
            month,
            {
                ownerId: budget!.owner_id,
                knownCategoryIds: budgetCategories.map((bc) => bc.category_id),
            },
        );

        // Calculate actual spent per category for this owner and month (including 50% share of shared expenses)
        const categoryDetails: MonthlyBudgetCategoryDetail[] =
            budgetCategories.map((bc) => {
                const category = this.ctx.state.categories.find(
                    (cat) => cat.id === bc.category_id,
                );

                // Exclude goal-funded expenses from normal monthly spendable category caps
                const expenseShareSum = this.ctx.state.expenses
                    .filter(
                        (e) =>
                            getExpenseCategoryForMember(e, budget!.owner_id) ===
                                bc.category_id &&
                            e.date.startsWith(month) &&
                            !e.goal_id,
                    )
                    .reduce(
                        (sum, e) =>
                            sum +
                            getMemberExpenseShare(
                                e,
                                budget!.owner_id,
                                "personal",
                            ),
                        0,
                    );

                const recurring = recurringSpend.byCategory[bc.category_id];
                const recurringSpent = recurring?.total ?? 0;
                const actualSpent =
                    Math.round((expenseShareSum + recurringSpent) * 100) / 100;
                const remaining =
                    Math.round((bc.allocated_amount - actualSpent) * 100) / 100;

                return {
                    ...cloneDeep(bc),
                    category: category ? cloneDeep(category) : undefined,
                    actualSpent,
                    remaining,
                    recurringSpent,
                    recurringItems: recurring
                        ? cloneDeep(recurring.items)
                        : undefined,
                };
            });

        const uncategorizedRecurringSpent = recurringSpend.uncategorized.total;

        const totalSpent =
            Math.round(
                (categoryDetails.reduce(
                    (sum, c) => sum + (c.actualSpent || 0),
                    0,
                ) +
                    uncategorizedRecurringSpent) *
                    100,
            ) / 100;

        const disposablePool = effectiveAfter;
        const totalRemaining =
            Math.round((disposablePool - totalSpent) * 100) / 100;

        // Spendable vs Allocation breakdown
        const spendableCats = categoryDetails.filter((c) =>
            isSpendableCategory(c.category),
        );
        const allocationCats = categoryDetails.filter(
            (c) => !isSpendableCategory(c.category),
        );

        const spendableAllocated =
            Math.round(
                spendableCats.reduce((sum, c) => sum + c.allocated_amount, 0) *
                    100,
            ) / 100;
        const spendableSpent =
            Math.round(
                spendableCats.reduce(
                    (sum, c) => sum + (c.actualSpent || 0),
                    0,
                ) * 100,
            ) / 100;
        const spendableRemaining =
            Math.round((spendableAllocated - spendableSpent) * 100) / 100;
        const allocationTotal =
            Math.round(
                allocationCats.reduce((sum, c) => sum + c.allocated_amount, 0) *
                    100,
            ) / 100;

        return {
            budget: {
                ...cloneDeep(budget),
                after_deductions: effectiveAfter,
                bonus: bonusSummary.gross,
            },
            categories: categoryDetails,
            disposablePool,
            totalSpent,
            totalRemaining,
            spendableAllocated,
            spendableSpent,
            spendableRemaining,
            allocationTotal,
            uncategorizedRecurringSpent,
            uncategorizedRecurringItems: cloneDeep(
                recurringSpend.uncategorized.items,
            ),
            bonusSummary,
        };
    }

    async updateMonthlyBudget(
        budgetUpdates: Partial<MonthlyBudget> & { id?: string },
    ): Promise<void> {
        if (!budgetUpdates.id) {
            throw new Error("Monthly budget ID is required for update");
        }
        const budget = this.ctx.state.monthlyBudgets.find(
            (b) => b.id === budgetUpdates.id,
        );
        if (!budget) {
            throw new Error(
                `Monthly budget with id "${budgetUpdates.id}" not found`,
            );
        }

        // bonus is derived from bonus events at read time; never write it back.
        const { bonus: _derivedBonus, ...writable } = budgetUpdates;
        void _derivedBonus;
        Object.assign(budget, writable);

        // Recalculate after_deductions (salary take-home only) if not explicitly provided
        if (budgetUpdates.after_deductions === undefined) {
            budget.after_deductions =
                Math.round(
                    (budget.gross_salary -
                        budget.cpf_deduction -
                        budget.taxes_deduction -
                        budget.insurance_deduction) *
                        100,
                ) / 100;
        }

        this.ctx.persist();
    }
}
