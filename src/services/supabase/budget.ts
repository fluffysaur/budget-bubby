/** Supabase queries for the budget domain. */

import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    Category,
    Expense,
    MonthlyBudget,
    MonthlyBudgetCategory,
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
import { addMonths, getCurrentMonth } from "../../lib/dateUtils";
import { isValidUuid } from "../../lib/uuid";
import { summarizeBonusesForMonth } from "../../lib/bonusFormulas";

import type { SupabaseContext, StorePeers } from "./context";

export class BudgetStore {
    constructor(
        private readonly ctx: SupabaseContext,
        private readonly peers: () => StorePeers,
    ) {}

    async getBaseProfiles(): Promise<BaseBudgetProfile[]> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("base_budget_profiles")
            .select("*");
        if (error) throw error;
        return (data || []) as BaseBudgetProfile[];
    }

    async getBaseAllocations(
        profileId?: string,
    ): Promise<BaseProfileAllocation[]> {
        const client = this.ctx.getClient();
        let query = client.from("base_profile_allocations").select("*");
        if (profileId) {
            query = query.eq("profile_id", profileId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as BaseProfileAllocation[];
    }

    async updateBaseProfile(
        profile: BaseBudgetProfile,
        allocations: BaseProfileAllocation[],
    ): Promise<void> {
        const client = this.ctx.getClient();

        // 1. Resolve household_id safely (prevent invalid syntax for type uuid like "hh-00000000-0001")
        let householdId = profile.household_id;
        if (!isValidUuid(householdId)) {
            householdId = await this.ctx.getHouseholdId();
        }

        // 2. Reject non-UUID owner_id in Supabase mode
        const ownerId = profile.owner_id;
        if (!isValidUuid(ownerId)) {
            throw new Error(`Invalid member ID for base profile: "${ownerId}"`);
        }

        // Validate all allocation category IDs upfront before mutating anything
        for (const alloc of allocations) {
            if (!isValidUuid(alloc.category_id)) {
                throw new Error(
                    `Invalid category ID in base profile allocation: "${alloc.category_id}"`,
                );
            }
        }

        // 3. Resolve profile.id: reuse existing row ID for (household_id, owner_id) if one exists
        const { data: existingProf } = await client
            .from("base_budget_profiles")
            .select("id")
            .eq("household_id", householdId)
            .eq("owner_id", ownerId)
            .maybeSingle();

        let profileId: string | undefined;
        if (existingProf?.id) {
            profileId = existingProf.id;
        } else if (isValidUuid(profile.id)) {
            profileId = profile.id;
        } else if (typeof crypto !== "undefined" && crypto.randomUUID) {
            profileId = crypto.randomUUID();
        }

        const parsedCpfRate = Number(profile.cpf_employee_rate);
        const cpfEmployeeRate = Number.isFinite(parsedCpfRate)
            ? parsedCpfRate
            : 0.2;

        const profileUpsertPayload: Record<string, unknown> = {
            household_id: householdId,
            owner_id: ownerId,
            gross_salary: Number(profile.gross_salary) || 0,
            cpf_employee_rate: cpfEmployeeRate,
            tithing_enabled: profile.tithing_enabled ?? true,
            updated_at: new Date().toISOString(),
        };
        if (profileId) {
            profileUpsertPayload.id = profileId;
        }

        const { data: savedProfile, error: profError } = await client
            .from("base_budget_profiles")
            .upsert(profileUpsertPayload, {
                onConflict: "household_id,owner_id",
            })
            .select("id")
            .single();
        if (profError) throw profError;

        const finalProfileId = savedProfile?.id || profileId;
        if (!finalProfileId) {
            throw new Error("Failed to resolve base budget profile ID");
        }

        // 4. Upsert new allocations first, then delete stale rows so a failed write never wipes existing allocations
        if (allocations.length > 0) {
            const sanitizedAllocations = allocations.map((alloc) => {
                const catId = alloc.category_id;
                const allocRow: Record<string, unknown> = {
                    profile_id: finalProfileId,
                    category_id: catId,
                    target_percentage: Number(alloc.target_percentage) || 0,
                };

                if (isValidUuid(alloc.id)) {
                    allocRow.id = alloc.id;
                } else if (typeof crypto !== "undefined" && crypto.randomUUID) {
                    allocRow.id = crypto.randomUUID();
                }

                return allocRow;
            });

            const { error: upsertError } = await client
                .from("base_profile_allocations")
                .upsert(sanitizedAllocations, {
                    onConflict: "profile_id,category_id",
                });
            if (upsertError) throw upsertError;

            const keepCategoryIds = sanitizedAllocations.map(
                (a) => a.category_id as string,
            );
            const deleteChain = client
                .from("base_profile_allocations")
                .delete()
                .eq("profile_id", finalProfileId) as unknown as {
                not?: (
                    column: string,
                    operator: string,
                    value: string,
                ) => PromiseLike<{ error: unknown }>;
            } & PromiseLike<{ error: unknown }>;

            const { error: delError } =
                typeof deleteChain.not === "function"
                    ? await deleteChain.not(
                          "category_id",
                          "in",
                          `(${keepCategoryIds.join(",")})`,
                      )
                    : await deleteChain;
            if (delError) throw delError;
        } else {
            const { error: delError } = await client
                .from("base_profile_allocations")
                .delete()
                .eq("profile_id", finalProfileId);
            if (delError) throw delError;
        }

        // 5. Synchronize unlocked monthly budgets for current and future months for this member.
        // Past months (month < currentMonth) and locked months are frozen and never modified.
        const currentMonth = getCurrentMonth();
        const { data: unlockedBudgets, error: fetchBudgetError } = await client
            .from("monthly_budgets")
            .select("*")
            .eq("owner_id", ownerId)
            .gte("month", currentMonth)
            .eq("is_locked", false);

        if (
            !fetchBudgetError &&
            unlockedBudgets &&
            unlockedBudgets.length > 0
        ) {
            const recurringItems =
                await this.peers().service.getRecurringItems();
            const newGross = Number(profile.gross_salary) || 0;
            const newCpf = calculateCPFAndNetPay(
                newGross,
                cpfEmployeeRate,
            ).cpfDeduction;

            for (const mb of unlockedBudgets) {
                const { taxesMonthly, insuranceMonthly } =
                    calculateMemberRecurringDeductions(
                        recurringItems,
                        ownerId,
                        mb.month,
                    );
                const newAfterDeductions =
                    Math.round(
                        (newGross - newCpf - taxesMonthly - insuranceMonthly) *
                            100,
                    ) / 100;

                const { error: updateBudgetError } = await client
                    .from("monthly_budgets")
                    .update({
                        gross_salary: newGross,
                        cpf_deduction: newCpf,
                        taxes_deduction: taxesMonthly,
                        insurance_deduction: insuranceMonthly,
                        after_deductions: newAfterDeductions,
                    })
                    .eq("id", mb.id);
                if (updateBudgetError) throw updateBudgetError;

                // Re-sync monthly_budget_categories for this unlocked budget
                const { error: delCatError } = await client
                    .from("monthly_budget_categories")
                    .delete()
                    .eq("monthly_budget_id", mb.id);
                if (delCatError) throw delCatError;

                if (allocations.length > 0) {
                    const catAllocInserts = allocations.map((alloc) => {
                        const allocId =
                            typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : undefined;
                        const targetPct = Number(alloc.target_percentage) || 0;
                        return {
                            ...(allocId ? { id: allocId } : {}),
                            monthly_budget_id: mb.id,
                            category_id: alloc.category_id,
                            percentage: targetPct,
                            allocated_amount:
                                Math.round(
                                    newAfterDeductions * targetPct * 100,
                                ) / 100,
                        };
                    });
                    const { error: insertCatError } = await client
                        .from("monthly_budget_categories")
                        .insert(catAllocInserts);
                    if (insertCatError) throw insertCatError;
                }
            }
        }
    }

    async getMonthlyBudget(
        month: string,
        memberId?: string,
    ): Promise<MonthlyBudgetDetail> {
        const client = this.ctx.getClient();
        const currentMonth = getCurrentMonth();
        const isPastMonth = month < currentMonth;

        let targetMemberId = memberId;
        if (!targetMemberId) {
            const { data: membersData } = await client
                .from("household_members")
                .select("id")
                .limit(1);
            if (membersData && membersData.length > 0) {
                targetMemberId = membersData[0].id;
            }
        }

        let query = client
            .from("monthly_budgets")
            .select("*")
            .eq("month", month);
        if (targetMemberId) {
            query = query.eq("owner_id", targetMemberId);
        }

        const { data: budgetData, error: budgetError } = await query
            .limit(1)
            .maybeSingle();
        if (budgetError) throw budgetError;

        type CategoryAllocRow = {
            id: string;
            monthly_budget_id: string;
            category_id: string;
            percentage: number;
            allocated_amount: number;
            categories?: Category;
        };

        let budget: MonthlyBudget;
        let catAllocData: CategoryAllocRow[];

        if (budgetData) {
            budget = budgetData as MonthlyBudget;
            if (isPastMonth && !budget.is_locked) {
                const { error: lockError } = await client
                    .from("monthly_budgets")
                    .update({ is_locked: true })
                    .eq("id", budget.id);
                if (!lockError) {
                    budget = { ...budget, is_locked: true };
                }
            }
            const { data: allocRows, error: catAllocError } = await client
                .from("monthly_budget_categories")
                .select("*, categories(*)")
                .eq("monthly_budget_id", budget.id);
            if (catAllocError) throw catAllocError;
            catAllocData = (allocRows as unknown as CategoryAllocRow[]) || [];
        } else {
            const [profs, _allCats, recurringItems, householdId] =
                await Promise.all([
                    this.getBaseProfiles(),
                    this.peers().service.getCategories(),
                    this.peers().service.getRecurringItems(),
                    this.ctx.getHouseholdId(),
                ]);

            const baseProfile = profs.find(
                (p) => p.owner_id === targetMemberId,
            );
            const ownerId = targetMemberId || "";

            if (!baseProfile) {
                // Partner with no base profile gets an empty "no profile" budget, not the other partner's profile
                budget = {
                    id: `mb-dyn-${month}-${ownerId || "empty"}`,
                    household_id: householdId || "",
                    owner_id: ownerId,
                    month,
                    gross_salary: 0,
                    bonus: 0,
                    cpf_deduction: 0,
                    taxes_deduction: 0,
                    insurance_deduction: 0,
                    after_deductions: 0,
                    notes: "No base budget profile configured",
                    is_locked: isPastMonth,
                };
                catAllocData = [];
            } else {
                const gross = Number(baseProfile.gross_salary) || 0;
                const rate = Number(baseProfile.cpf_employee_rate) || 0.2;
                const cpf = calculateCPFAndNetPay(gross, rate).cpfDeduction;

                const {
                    taxesMonthly: taxesDeduction,
                    insuranceMonthly: insuranceDeduction,
                } = calculateMemberRecurringDeductions(
                    recurringItems,
                    ownerId,
                    month,
                );
                const afterDeductions =
                    Math.round(
                        (gross - cpf - taxesDeduction - insuranceDeduction) *
                            100,
                    ) / 100;

                const newBudgetId =
                    typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : undefined;

                const budgetInsertPayload: Record<string, unknown> = {
                    household_id: baseProfile.household_id || householdId,
                    owner_id: ownerId,
                    month,
                    gross_salary: gross,
                    bonus: 0,
                    cpf_deduction: cpf,
                    taxes_deduction: taxesDeduction,
                    insurance_deduction: insuranceDeduction,
                    after_deductions: afterDeductions,
                    notes: "Generated monthly budget",
                    is_locked: isPastMonth,
                };
                if (newBudgetId) {
                    budgetInsertPayload.id = newBudgetId;
                }

                const { data: insertedBudget, error: insertError } =
                    await client
                        .from("monthly_budgets")
                        .insert(budgetInsertPayload)
                        .select("*")
                        .single();

                if (insertError) {
                    // If conflict (e.g. concurrent creation), retry select
                    const { data: existingData, error: selectError } =
                        await client
                            .from("monthly_budgets")
                            .select("*")
                            .eq("month", month)
                            .eq("owner_id", ownerId)
                            .maybeSingle();
                    if (selectError || !existingData) {
                        throw insertError;
                    }
                    budget = existingData as MonthlyBudget;
                } else {
                    budget = insertedBudget as MonthlyBudget;
                }

                const baseAllocs = await this.getBaseAllocations(
                    baseProfile.id,
                );
                if (baseAllocs.length > 0) {
                    const catAllocInserts = baseAllocs.map((alloc) => {
                        const allocId =
                            typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : undefined;
                        const targetPct = Number(alloc.target_percentage) || 0;
                        return {
                            ...(allocId ? { id: allocId } : {}),
                            monthly_budget_id: budget.id,
                            category_id: alloc.category_id,
                            percentage: targetPct,
                            allocated_amount:
                                Math.round(afterDeductions * targetPct * 100) /
                                100,
                        };
                    });

                    const { error: catInsertError } = await client
                        .from("monthly_budget_categories")
                        .insert(catAllocInserts);
                    if (catInsertError) {
                        console.warn(
                            "Failed to insert monthly_budget_categories:",
                            catInsertError,
                        );
                    }
                }

                const { data: allocRows, error: catAllocError } = await client
                    .from("monthly_budget_categories")
                    .select("*, categories(*)")
                    .eq("monthly_budget_id", budget.id);
                if (catAllocError) throw catAllocError;
                catAllocData =
                    (allocRows as unknown as CategoryAllocRow[]) || [];
            }
        }

        const nextMonth = addMonths(month, 1);
        const [
            { data: expensesData, error: expError },
            recurringItems,
            monthBonusEvents,
        ] = await Promise.all([
            client
                .from("expenses")
                .select("*")
                .gte("date", `${month}-01`)
                .lt("date", `${nextMonth}-01`),
            this.peers().service.getRecurringItems(),
            this.peers().bonus.getMonthBonusEvents(month, budget.owner_id),
        ]);
        if (expError) throw expError;

        // Bonus is income, not budget: it never feeds after_deductions or category caps.
        const legacyBonus = Number(budgetData?.bonus || 0);
        const bonusSummary = summarizeBonusesForMonth(
            monthBonusEvents ?? [],
            month,
            budget.owner_id,
            legacyBonus,
        );

        const expenses = (expensesData || []) as Expense[];
        if (
            budgetData &&
            !budget.is_locked &&
            recurringItems &&
            recurringItems.length > 0
        ) {
            const hasTaxOrInsItems = recurringItems.some(
                (p) =>
                    (p.type === "tax" || p.type === "insurance") &&
                    (!budget.owner_id ||
                        p.owner_id === budget.owner_id ||
                        p.owner_id === "joint"),
            );
            if (hasTaxOrInsItems) {
                const { taxesMonthly, insuranceMonthly } =
                    calculateMemberRecurringDeductions(
                        recurringItems,
                        budget.owner_id,
                        month,
                    );
                budget = {
                    ...budget,
                    taxes_deduction: taxesMonthly,
                    insurance_deduction: insuranceMonthly,
                    after_deductions:
                        Math.round(
                            (Number(budget.gross_salary) -
                                Number(budget.cpf_deduction) -
                                taxesMonthly -
                                insuranceMonthly) *
                                100,
                        ) / 100,
                };
                catAllocData = catAllocData.map((row) => ({
                    ...row,
                    allocated_amount:
                        Math.round(
                            budget.after_deductions *
                                Number(row.percentage) *
                                100,
                        ) / 100,
                }));
            }
        }
        // Legacy rows stored after_deductions with the hand-entered bonus added.
        // Unlocked months are normalized to salary take-home; locked months stay frozen.
        if (budgetData && !budget.is_locked && legacyBonus > 0) {
            budget = {
                ...budget,
                after_deductions:
                    Math.round(
                        (Number(budget.gross_salary) -
                            Number(budget.cpf_deduction) -
                            Number(budget.taxes_deduction || 0) -
                            Number(budget.insurance_deduction || 0)) *
                            100,
                    ) / 100,
            };
            catAllocData = catAllocData.map((row) => ({
                ...row,
                allocated_amount:
                    Math.round(
                        budget.after_deductions * Number(row.percentage) * 100,
                    ) / 100,
            }));
        }
        budget = { ...budget, bonus: bonusSummary.gross };

        // Recurring subscription/bill/other spend for this member and month, by category
        const recurringSpend = calculateRecurringCategorySpend(
            recurringItems || [],
            month,
            {
                ownerId: budget.owner_id,
                knownCategoryIds: (catAllocData || []).map(
                    (row) => row.category_id,
                ),
            },
        );

        const categories: MonthlyBudgetCategoryDetail[] = (
            catAllocData || []
        ).map((row) => {
            const catObj: Category | undefined = row.categories;

            // Exclude goal-funded expenses from normal monthly spendable category caps
            const expenseShareSum = expenses
                .filter(
                    (e) =>
                        getExpenseCategoryForMember(e, budget.owner_id) ===
                            row.category_id && !e.goal_id,
                )
                .reduce(
                    (sum, e) =>
                        sum +
                        getMemberExpenseShare(e, budget.owner_id, "personal"),
                    0,
                );

            const recurring = recurringSpend.byCategory[row.category_id];
            const recurringSpent = recurring?.total ?? 0;
            const roundedSpent =
                Math.round((expenseShareSum + recurringSpent) * 100) / 100;
            const remaining =
                Math.round(
                    (Number(row.allocated_amount) - roundedSpent) * 100,
                ) / 100;

            return {
                id: row.id,
                monthly_budget_id: row.monthly_budget_id,
                category_id: row.category_id,
                percentage: Number(row.percentage),
                allocated_amount: Number(row.allocated_amount),
                category: catObj,
                actualSpent: roundedSpent,
                remaining,
                recurringSpent,
                recurringItems: recurring?.items,
            };
        });

        const uncategorizedRecurringSpent = recurringSpend.uncategorized.total;

        const totalSpent =
            Math.round(
                (categories.reduce((sum, c) => sum + (c.actualSpent || 0), 0) +
                    uncategorizedRecurringSpent) *
                    100,
            ) / 100;
        const disposablePool = Number(budget.after_deductions);
        const totalRemaining =
            Math.round((disposablePool - totalSpent) * 100) / 100;

        const spendableCats = categories.filter((c) =>
            isSpendableCategory(c.category),
        );
        const allocationCats = categories.filter(
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
            budget,
            categories,
            disposablePool,
            totalSpent,
            totalRemaining,
            spendableAllocated,
            spendableSpent,
            spendableRemaining,
            allocationTotal,
            uncategorizedRecurringSpent,
            uncategorizedRecurringItems: recurringSpend.uncategorized.items,
            bonusSummary,
        };
    }

    async getMonthlyBudgetHistory(
        months: string[],
    ): Promise<MonthlyBudgetHistoryRow[]> {
        if (months.length === 0) return [];
        const client = this.ctx.getClient();
        const { data: budgets, error } = await client
            .from("monthly_budgets")
            .select("*")
            .in("month", months);
        if (error) throw error;
        const rows = (budgets || []) as MonthlyBudget[];
        if (rows.length === 0) return [];
        const { data: cats, error: catError } = await client
            .from("monthly_budget_categories")
            .select("*")
            .in(
                "monthly_budget_id",
                rows.map((b) => b.id),
            );
        if (catError) throw catError;
        const byBudget = new Map<string, MonthlyBudgetCategory[]>();
        for (const c of (cats || []) as MonthlyBudgetCategory[]) {
            const list = byBudget.get(c.monthly_budget_id) ?? [];
            list.push(c);
            byBudget.set(c.monthly_budget_id, list);
        }
        return rows.map((budget) => ({
            budget,
            categories: byBudget.get(budget.id) ?? [],
        }));
    }

    async updateMonthlyBudget(
        budgetUpdates: Partial<MonthlyBudget> & { id?: string },
    ): Promise<void> {
        const client = this.ctx.getClient();
        if (!budgetUpdates.id) {
            throw new Error("Monthly budget ID is required for update");
        }
        // Dynamic synthetic budget IDs (e.g. mb-dyn-*) are not yet persisted in monthly_budgets
        if (!isValidUuid(budgetUpdates.id)) {
            throw new Error(
                `Invalid monthly budget ID: "${budgetUpdates.id}". Budget must be persisted with a valid UUID before update.`,
            );
        }

        // bonus is derived from bonus_events at read time; never write it back.
        const { bonus: _derivedBonus, ...writable } = budgetUpdates;
        void _derivedBonus;
        const { error } = await client
            .from("monthly_budgets")
            .update(writable)
            .eq("id", budgetUpdates.id);
        if (error) throw error;
    }
}
