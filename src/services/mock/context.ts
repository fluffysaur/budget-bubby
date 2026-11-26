/** Shared state and helpers for the mock finance domain stores. */

import type { RecurringItem } from "../../types/finance";
import {
    mockSeedData,
    mockHistoricalAccountSnapshots,
    mockSubscriptionItems,
    mockCreditCards,
    mockCreditCardStatements,
    mockDailyCheckins,
    type MockSeedDataset,
} from "../../data/mockSeedData";
import {
    calculateCPFAndNetPay,
    calculateMemberRecurringDeductions,
} from "../../lib/financialFormulas";
import { findDefaultRecurringCategoryId } from "../../lib/recurringItems";
import { getCurrentMonth } from "../../lib/dateUtils";
import { backfillSortOrder } from "../../lib/accountOrder";

export const STORAGE_KEY = "budget_buddy_mock_dataset_v1";

export function cloneDeep<T>(data: T): T {
    return JSON.parse(JSON.stringify(data));
}

export function loadInitialData(): MockSeedDataset {
    let dataset: MockSeedDataset;
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (stored) {
                dataset = JSON.parse(stored);
            } else {
                dataset = cloneDeep(mockSeedData);
            }
        } catch {
            dataset = cloneDeep(mockSeedData);
        }
    } else {
        dataset = cloneDeep(mockSeedData);
    }

    // Ensure multi-month historical snapshots and subscription recurring items are available
    if (!dataset.accountSnapshots || dataset.accountSnapshots.length <= 18) {
        dataset.accountSnapshots = cloneDeep(mockHistoricalAccountSnapshots);
    }
    // Migrate datasets persisted before `cpf_kind`: match CPF accounts by name,
    // mirroring the Phase 3 SQL migration. Unmatched ones stay null.
    for (const acc of dataset.accounts ?? []) {
        if (acc.type !== "CPF" || acc.cpf_kind) continue;
        if (/\bOA\b|ordinary/i.test(acc.name)) acc.cpf_kind = "OA";
        else if (/\bMA\b|medi/i.test(acc.name)) acc.cpf_kind = "MA";
        else if (/\bSA\b|special/i.test(acc.name)) acc.cpf_kind = "SA";
    }
    // Mirrors the account `sort_order` migration's backfill
    backfillSortOrder(dataset.accounts ?? []);
    // Migrate datasets persisted before the policies -> recurring items rename
    const legacy = dataset as MockSeedDataset & {
        recurringPolicies?: RecurringItem[];
    };
    if (!dataset.recurringItems) {
        dataset.recurringItems =
            legacy.recurringPolicies ?? cloneDeep(mockSeedData.recurringItems);
        delete legacy.recurringPolicies;
    }
    if (!dataset.recurringItems.some((p) => p.type === "subscription")) {
        dataset.recurringItems = [
            ...dataset.recurringItems,
            ...cloneDeep(mockSubscriptionItems),
        ];
    }
    // Backfill spend categories for subscriptions persisted before category_id existed
    const defaultRecurringCategoryId = findDefaultRecurringCategoryId(
        dataset.categories,
    );
    for (const item of dataset.recurringItems) {
        if (item.category_id === undefined) {
            item.category_id =
                item.type === "subscription"
                    ? defaultRecurringCategoryId
                    : null;
        }
    }

    if (!dataset.creditCards) {
        dataset.creditCards = cloneDeep(mockCreditCards);
    }
    if (!dataset.creditCardStatements) {
        dataset.creditCardStatements = cloneDeep(mockCreditCardStatements);
    }
    if (!dataset.dailyCheckins) {
        dataset.dailyCheckins = cloneDeep(mockDailyCheckins);
    }
    if (!dataset.notificationPreferences) {
        dataset.notificationPreferences = {};
    }
    if (!dataset.bonusEvents) {
        dataset.bonusEvents = [];
    }
    if (!dataset.bonusSplitDefaults) {
        dataset.bonusSplitDefaults = {};
    }

    return dataset;
}

export function roundCpfCap(cap: number | null | undefined): number | null {
    return typeof cap === "number" && Number.isFinite(cap) && cap > 0
        ? Math.round(cap * 100) / 100
        : null;
}

/** Shared in-memory dataset for the mock domain stores. */
export class MockContext {
    state: MockSeedDataset = loadInitialData();

    persist(): void {
        if (typeof window !== "undefined" && window.localStorage) {
            try {
                window.localStorage.setItem(
                    STORAGE_KEY,
                    JSON.stringify(this.state),
                );
            } catch {
                // Ignore quota / serialization errors in sandbox environments
            }
        }
    }

    /** Drop persisted data and reload the seed dataset. */
    reset(): void {
        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.removeItem(STORAGE_KEY);
        }
        this.state = loadInitialData();
        this.persist();
    }

    syncUnlockedBudgetsForOwner(ownerId?: string): void {
        const currentMonth = getCurrentMonth();
        for (const budget of this.state.monthlyBudgets) {
            if (budget.is_locked || budget.month < currentMonth) continue;
            if (ownerId && ownerId !== "joint" && budget.owner_id !== ownerId)
                continue;

            const baseProfile = this.state.baseProfiles.find(
                (p) => p.owner_id === budget.owner_id,
            );
            if (baseProfile) {
                budget.gross_salary = baseProfile.gross_salary;
                budget.cpf_deduction = calculateCPFAndNetPay(
                    baseProfile.gross_salary,
                    baseProfile.cpf_employee_rate,
                ).cpfDeduction;
            }

            const { taxesMonthly, insuranceMonthly } =
                calculateMemberRecurringDeductions(
                    this.state.recurringItems,
                    budget.owner_id,
                    budget.month,
                );
            budget.taxes_deduction = taxesMonthly;
            budget.insurance_deduction = insuranceMonthly;
            budget.after_deductions =
                Math.round(
                    (budget.gross_salary -
                        budget.cpf_deduction -
                        budget.taxes_deduction -
                        budget.insurance_deduction) *
                        100,
                ) / 100;

            if (baseProfile) {
                const profAllocs = this.state.baseAllocations.filter(
                    (a) => a.profile_id === baseProfile.id,
                );
                if (profAllocs.length > 0) {
                    this.state.monthlyBudgetCategories =
                        this.state.monthlyBudgetCategories.filter(
                            (c) => c.monthly_budget_id !== budget.id,
                        );
                    const regenerated = profAllocs.map((alloc, idx) => ({
                        id: `mbc-${budget.id}-${idx}`,
                        monthly_budget_id: budget.id,
                        category_id: alloc.category_id,
                        percentage: alloc.target_percentage,
                        allocated_amount:
                            Math.round(
                                budget.after_deductions *
                                    alloc.target_percentage *
                                    100,
                            ) / 100,
                    }));
                    this.state.monthlyBudgetCategories.push(...regenerated);
                }
            }
        }
    }
}
