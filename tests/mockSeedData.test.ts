import { describe, it, expect } from "vitest";
import {
    mockHousehold,
    mockMembers,
    mockCategories,
    mockBaseProfiles,
    mockBaseAllocations,
    mockAccounts,
    mockAccountSnapshots,
    mockSavingsGoals,
    mockRecurringItems,
    mockMonthlyBudgets,
    mockMonthlyBudgetCategories,
    mockExpenses,
    mockSeedData,
} from "../src/data/mockSeedData";

describe("mockSeedData", () => {
    it("exports valid household and members", () => {
        expect(mockHousehold.id).toBeDefined();
        expect(mockHousehold.currency).toBe("SGD");
        expect(mockMembers).toHaveLength(2);
        expect(mockMembers.map((m) => m.display_name)).toEqual([
            "Alex",
            "Sam",
        ]);
        expect(mockMembers.map((m) => m.role)).toEqual(["owner", "member"]);
    });

    it("exports all 7 core financial categories plus seeded personal category", () => {
        expect(mockCategories).toHaveLength(8);
        const categoryNames = mockCategories.map((c) => c.name);
        expect(categoryNames).toContain("Food");
        expect(categoryNames).toContain("Lifestyle");
        expect(categoryNames).toContain("Transport");
        expect(categoryNames).toContain("Investments");
        expect(categoryNames).toContain("Savings");
        expect(categoryNames).toContain("Tithing");
        expect(categoryNames).toContain("Buffer");
    });

    it("allocations for Alex and Sam sum to 100%", () => {
        const partnerOneProfile = mockBaseProfiles.find(
            (p) => p.owner_id === "mem-00000000-0011",
        );
        const partnerTwoProfile = mockBaseProfiles.find(
            (p) => p.owner_id === "mem-00000000-0012",
        );

        expect(partnerOneProfile).toBeDefined();
        expect(partnerTwoProfile).toBeDefined();

        const partnerOneAllocations = mockBaseAllocations.filter(
            (a) => a.profile_id === partnerOneProfile!.id,
        );
        const partnerTwoAllocations = mockBaseAllocations.filter(
            (a) => a.profile_id === partnerTwoProfile!.id,
        );

        expect(partnerOneAllocations).toHaveLength(7);
        expect(partnerTwoAllocations).toHaveLength(7);

        const partnerOneTotalPct = partnerOneAllocations.reduce(
            (sum, a) => sum + a.target_percentage,
            0,
        );
        const partnerTwoTotalPct = partnerTwoAllocations.reduce(
            (sum, a) => sum + a.target_percentage,
            0,
        );

        expect(Math.round(partnerOneTotalPct * 100)).toBe(100);
        expect(Math.round(partnerTwoTotalPct * 100)).toBe(100);
    });

    it("contains 13 accounts for Alex and 5 accounts for Sam", () => {
        const partnerOneAccounts = mockAccounts.filter(
            (a) => a.owner_id === "mem-00000000-0011",
        );
        const partnerTwoAccounts = mockAccounts.filter(
            (a) => a.owner_id === "mem-00000000-0012",
        );

        expect(partnerOneAccounts).toHaveLength(13);
        expect(partnerTwoAccounts).toHaveLength(5);

        const accountTypes = new Set(mockAccounts.map((a) => a.type));
        expect(accountTypes).toContain("Cash");
        expect(accountTypes).toContain("Investment");
        expect(accountTypes).toContain("CPF");
        expect(mockAccountSnapshots).toHaveLength(mockAccounts.length);
    });

    it("contains 6 shared goals with correct status", () => {
        expect(mockSavingsGoals).toHaveLength(6);
        const goalTitles = mockSavingsGoals.map((g) => g.title);
        expect(goalTitles).toEqual([
            "Wedding",
            "Honeymoon",
            "HDB Down Payment",
            "Renovation",
            "Baby Fund",
            "Buffer",
        ]);
        expect(
            mockSavingsGoals.filter((g) => g.goal_type === "buffer"),
        ).toHaveLength(1);

        const wedding = mockSavingsGoals.find((g) => g.title === "Wedding");
        expect(wedding?.status).toBe("on_track");
        expect(wedding?.target_amount).toBe(55000);

        const honeymoon = mockSavingsGoals.find((g) => g.title === "Honeymoon");
        expect(honeymoon?.status).toBe("achieved");

        const hdb = mockSavingsGoals.find(
            (g) => g.title === "HDB Down Payment",
        );
        expect(hdb?.status).toBe("on_track");
    });

    it("contains recurring items for insurance and taxes", () => {
        expect(mockRecurringItems).toHaveLength(4);
        const types = mockRecurringItems.map((p) => p.type);
        expect(types).toContain("insurance");
        expect(types).toContain("tax");
    });

    it("ensures referential integrity across mock datasets", () => {
        const memberIds = new Set(mockMembers.map((m) => m.id));
        const categoryIds = new Set(mockCategories.map((c) => c.id));
        const profileIds = new Set(mockBaseProfiles.map((p) => p.id));
        const budgetIds = new Set(mockMonthlyBudgets.map((b) => b.id));

        // Accounts point to valid members
        mockAccounts.forEach((acc) => {
            expect(memberIds.has(acc.owner_id)).toBe(true);
            expect(acc.household_id).toBe(mockHousehold.id);
        });

        // Base profiles point to valid members
        mockBaseProfiles.forEach((prof) => {
            expect(memberIds.has(prof.owner_id)).toBe(true);
            expect(prof.household_id).toBe(mockHousehold.id);
        });

        // Base allocations point to valid profiles & categories
        mockBaseAllocations.forEach((alloc) => {
            expect(profileIds.has(alloc.profile_id)).toBe(true);
            expect(categoryIds.has(alloc.category_id)).toBe(true);
        });

        // Monthly budgets point to valid members
        mockMonthlyBudgets.forEach((mb) => {
            expect(memberIds.has(mb.owner_id)).toBe(true);
            expect(mb.household_id).toBe(mockHousehold.id);
        });

        // Monthly budget categories point to valid budgets & categories
        mockMonthlyBudgetCategories.forEach((mbc) => {
            expect(budgetIds.has(mbc.monthly_budget_id)).toBe(true);
            expect(categoryIds.has(mbc.category_id)).toBe(true);
        });

        // Expenses point to valid payers & categories
        mockExpenses.forEach((exp) => {
            expect(memberIds.has(exp.payer_id)).toBe(true);
            expect(exp.household_id).toBe(mockHousehold.id);
            if (exp.category_id) {
                expect(categoryIds.has(exp.category_id)).toBe(true);
            }
        });

        // Bundled object contains everything
        expect(mockSeedData.household).toBe(mockHousehold);
        expect(mockSeedData.members).toBe(mockMembers);
        expect(mockSeedData.accounts).toBe(mockAccounts);
        expect(mockSeedData.expenses).toBe(mockExpenses);
    });
});
