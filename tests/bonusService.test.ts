import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseFinanceService } from "../src/services/supabaseFinanceService";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { financeService } from "../src/services/financeService";
import * as supabaseClientModule from "../src/services/supabaseClient";
import * as queryClientModule from "../src/lib/queryClient";
import { BonusLogUnavailableError } from "../src/lib/supabaseErrors";
import { cloneDefaultSplit } from "../src/lib/bonusFormulas";
import type { SaveBonusEventInput } from "../src/types/finance";

type Result = { data: unknown; error: unknown };

/** Chainable PostgREST stand-in that resolves to `result` however it is awaited. */
function chain(result: Result) {
    const obj: Record<string, unknown> = {};
    for (const m of ["select", "eq", "gte", "lt", "limit", "order", "update", "upsert", "delete"]) {
        obj[m] = vi.fn(() => obj);
    }
    obj.maybeSingle = vi.fn().mockResolvedValue(result);
    obj.single = vi.fn().mockResolvedValue(result);
    obj.then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject);
    return obj;
}

const OWNER = "00000000-0000-0000-0000-000000000011";
const BUDGET_ID = "00000000-0000-0000-0000-000000000701";
const FOOD = "00000000-0000-0000-0000-000000000101";
const GOAL = "00000000-0000-0000-0000-000000000501";

function budgetRow(overrides: Record<string, unknown> = {}) {
    return {
        id: BUDGET_ID,
        household_id: "hh",
        owner_id: OWNER,
        month: "2026-11",
        gross_salary: 6000,
        bonus: 0,
        cpf_deduction: 1200,
        taxes_deduction: 0,
        insurance_deduction: 0,
        after_deductions: 4800,
        is_locked: false,
        ...overrides,
    };
}

function installClient(tables: Record<string, Result>, extra: Record<string, unknown> = {}) {
    const from = vi.fn((table: string) => chain(tables[table] ?? { data: [], error: null }));
    const client = {
        from,
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        ...extra,
    };
    vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(client as never);
    return client;
}

function budgetTables(budget: Record<string, unknown>, bonusEvents: Result): Record<string, Result> {
    return {
        monthly_budgets: { data: budget, error: null },
        monthly_budget_categories: {
            data: [
                {
                    id: "mbc-food",
                    monthly_budget_id: BUDGET_ID,
                    category_id: FOOD,
                    percentage: 0.5,
                    allocated_amount: Number(budget.after_deductions) * 0.5,
                    categories: { id: FOOD, household_id: "hh", name: "Food", color: "#000", icon: "utensils", is_system: false },
                },
            ],
            error: null,
        },
        expenses: { data: [], error: null },
        recurring_items: { data: [], error: null },
        bonus_events: bonusEvents,
    };
}

describe("supabaseFinanceService bonus log", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        supabaseFinanceService.resetBonusLogAvailability();
    });

    it("reports unavailable on a missing table and caches the flag", async () => {
        const client = installClient({
            bonus_events: { data: null, error: { code: "42P01", message: "relation does not exist" } },
        });
        expect(await supabaseFinanceService.getBonusEvents()).toEqual({ available: false, events: [] });
        expect(await supabaseFinanceService.getBonusEvents()).toEqual({ available: false, events: [] });
        expect(client.from).toHaveBeenCalledTimes(1);
    });

    it("treats PGRST205 as missing too", async () => {
        installClient({ bonus_events: { data: null, error: { code: "PGRST205" } } });
        expect((await supabaseFinanceService.getBonusEvents()).available).toBe(false);
    });

    it("throws other errors", async () => {
        installClient({ bonus_events: { data: null, error: { code: "500", message: "boom" } } });
        await expect(supabaseFinanceService.getBonusEvents()).rejects.toMatchObject({ code: "500" });
    });

    it("maps rows with nested goal contributions", async () => {
        installClient({
            bonus_events: {
                data: [
                    {
                        id: "b1",
                        household_id: "hh",
                        recipient_id: OWNER,
                        type: "aws",
                        received_on: "2026-12-20",
                        gross: "6000.00",
                        cpf: "1200.00",
                        net: "4800.00",
                        split: [{ key: "goals", pct: 1, amount: 4800 }],
                        bonus_goal_contributions: [{ goal_id: GOAL, amount: "1920.00" }],
                    },
                ],
                error: null,
            },
        });
        const result = await supabaseFinanceService.getBonusEvents();
        expect(result.available).toBe(true);
        expect(result.events[0]).toMatchObject({
            gross: 6000,
            cpf: 1200,
            net: 4800,
            goal_contributions: [{ goal_id: GOAL, amount: 1920 }],
        });
    });

    it("keeps the bonus out of take-home and caps, and reports it from events", async () => {
        installClient(
            budgetTables(budgetRow(), {
                data: [{ id: "b1", recipient_id: OWNER, received_on: "2026-11-05", gross: 10000, cpf: 2000, net: 8000 }],
                error: null,
            }),
        );
        const detail = await supabaseFinanceService.getMonthlyBudget("2026-11", OWNER);
        expect(detail.budget.after_deductions).toBe(4800);
        expect(detail.disposablePool).toBe(4800);
        expect(detail.categories[0].allocated_amount).toBe(2400);
        expect(detail.budget.bonus).toBe(10000);
        expect(detail.bonusSummary).toEqual({ gross: 10000, cpf: 2000, net: 8000, count: 1, source: "events" });
    });

    it("falls back to the legacy column and normalizes unlocked rows", async () => {
        installClient(
            budgetTables(budgetRow({ bonus: 1500, after_deductions: 6300 }), {
                data: null,
                error: { code: "42P01" },
            }),
        );
        const detail = await supabaseFinanceService.getMonthlyBudget("2026-11", OWNER);
        expect(detail.bonusSummary).toMatchObject({ gross: 1500, net: 1500, cpf: 0, source: "legacy" });
        expect(detail.budget.after_deductions).toBe(4800);
        expect(detail.categories[0].allocated_amount).toBe(2400);
    });

    it("leaves locked legacy rows untouched", async () => {
        installClient(
            budgetTables(budgetRow({ bonus: 1500, after_deductions: 6300, is_locked: true }), {
                data: [],
                error: null,
            }),
        );
        const detail = await supabaseFinanceService.getMonthlyBudget("2026-11", OWNER);
        expect(detail.budget.after_deductions).toBe(6300);
        expect(detail.bonusSummary?.source).toBe("legacy");
    });

    it("strips bonus from monthly budget updates", async () => {
        const update = vi.fn(() => chain({ data: null, error: null }));
        installClient({}, { from: vi.fn(() => ({ update })) });
        await supabaseFinanceService.updateMonthlyBudget({ id: BUDGET_ID, bonus: 999, gross_salary: 7000 });
        expect(update).toHaveBeenCalledWith({ id: BUDGET_ID, gross_salary: 7000 });
    });

    it("uses the atomic increment RPC when a goal balance changes", async () => {
        const client = installClient({
            savings_goals: {
                data: { id: GOAL, target_amount: 10000, saved_so_far: 0, target_date: "2027-12-31", monthly_contribution: 0 },
                error: null,
            },
        });

        await supabaseFinanceService.updateGoal(GOAL, { saved_so_far: 3200 });

        expect(client.rpc).toHaveBeenCalledWith("increment_goal_saved", {
            p_goal_id: GOAL,
            p_amount: 3200,
        });
    });

    it("saves through the RPC and refreshes goal status", async () => {
        const client = installClient({
            households: { data: { id: "hh-uuid" }, error: null },
            savings_goals: { data: { id: GOAL, target_amount: 10000, saved_so_far: 0, target_date: "2027-12-31", monthly_contribution: 0 }, error: null },
        });
        client.rpc.mockResolvedValue({
            data: { id: "b-new", household_id: "hh-uuid", recipient_id: OWNER, type: "performance", received_on: "2026-11-05", gross: 10000, cpf: 2000, net: 8000, split: [] },
            error: null,
        });
        const updateGoal = vi.spyOn(supabaseFinanceService, "updateGoal");

        const input: SaveBonusEventInput = {
            recipient_id: OWNER,
            type: "performance",
            received_on: "2026-11-05",
            gross: 10000,
            cpf: 2000,
            note: "FY26",
            split: cloneDefaultSplit(),
            goal_contributions: [{ goal_id: GOAL, amount: 3200 }, { goal_id: "zero", amount: 0 }],
        };
        const saved = await supabaseFinanceService.saveBonusEvent(input);

        expect(client.rpc).toHaveBeenCalledWith("save_bonus_event", {
            p_event: expect.objectContaining({
                household_id: "hh-uuid",
                recipient_id: OWNER,
                gross: 10000,
                cpf: 2000,
                note: "FY26",
            }),
            p_contributions: [{ goal_id: GOAL, amount: 3200 }],
        });
        expect(updateGoal).toHaveBeenCalledWith(GOAL, {});
        expect(saved.goal_contributions).toEqual([{ goal_id: GOAL, amount: 3200 }]);
    });

    it("throws BonusLogUnavailableError when the RPC is missing", async () => {
        const client = installClient({ households: { data: { id: "hh-uuid" }, error: null } });
        client.rpc.mockResolvedValue({ data: null, error: { code: "PGRST202" } });
        await expect(
            supabaseFinanceService.saveBonusEvent({
                recipient_id: OWNER,
                type: "other",
                received_on: "2026-11-05",
                gross: 100,
                cpf: 20,
                split: cloneDefaultSplit(),
                goal_contributions: [],
            }),
        ).rejects.toBeInstanceOf(BonusLogUnavailableError);
    });

    it("returns the seeded default split when the table is missing", async () => {
        installClient({ bonus_split_defaults: { data: null, error: { code: "42P01" } } });
        expect(await supabaseFinanceService.getBonusSplitDefault(OWNER)).toEqual(cloneDefaultSplit());
    });
});

describe("mockFinanceService bonus log", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockFinanceService.resetData();
    });

    const baseInput = async (): Promise<SaveBonusEventInput> => {
        const goals = await mockFinanceService.getGoals();
        const open = goals.find((g) => g.status !== "achieved" && g.saved_so_far < g.target_amount)!;
        return {
            recipient_id: "mem-00000000-0012",
            type: "performance",
            received_on: "2026-10-15",
            gross: 10000,
            cpf: 2000,
            split: cloneDefaultSplit(),
            goal_contributions: [{ goal_id: open.id, amount: 3200 }],
        };
    };

    it("funds goals on create, applies the delta on edit and reverses on delete", async () => {
        const input = await baseInput();
        const goalId = input.goal_contributions[0].goal_id;
        const before = (await mockFinanceService.getGoals()).find((g) => g.id === goalId)!.saved_so_far;

        const created = await mockFinanceService.saveBonusEvent(input);
        expect(created.net).toBe(8000);
        let goal = (await mockFinanceService.getGoals()).find((g) => g.id === goalId)!;
        expect(goal.saved_so_far).toBeCloseTo(before + 3200, 2);

        await mockFinanceService.saveBonusEvent({
            ...input,
            id: created.id,
            goal_contributions: [{ goal_id: goalId, amount: 1000 }],
        });
        goal = (await mockFinanceService.getGoals()).find((g) => g.id === goalId)!;
        expect(goal.saved_so_far).toBeCloseTo(before + 1000, 2);

        await mockFinanceService.deleteBonusEvent(created.id);
        goal = (await mockFinanceService.getGoals()).find((g) => g.id === goalId)!;
        expect(goal.saved_so_far).toBeCloseTo(before, 2);
        expect((await mockFinanceService.getBonusEvents()).events).toHaveLength(0);
    });

    it("clamps the reversal at zero", async () => {
        const input = await baseInput();
        const goalId = input.goal_contributions[0].goal_id;
        const created = await mockFinanceService.saveBonusEvent(input);
        await mockFinanceService.updateGoal(goalId, { saved_so_far: 100 });
        await mockFinanceService.deleteBonusEvent(created.id);
        const goal = (await mockFinanceService.getGoals()).find((g) => g.id === goalId)!;
        expect(goal.saved_so_far).toBe(0);
    });

    it("counts the bonus as income without raising category caps", async () => {
        const input = await baseInput();
        const before = await mockFinanceService.getMonthlyBudget("2026-10", input.recipient_id);
        await mockFinanceService.saveBonusEvent(input);
        const after = await mockFinanceService.getMonthlyBudget("2026-10", input.recipient_id);
        expect(after.budget.after_deductions).toBe(before.budget.after_deductions);
        expect(after.categories.map((c) => c.allocated_amount)).toEqual(
            before.categories.map((c) => c.allocated_amount),
        );
        expect(after.budget.bonus).toBe(10000);
        expect(after.bonusSummary).toMatchObject({ gross: 10000, cpf: 2000, net: 8000, source: "events" });
    });

    it("saves and reads a member's default split", async () => {
        const split = cloneDefaultSplit().map((s) => (s.key === "goals" ? { ...s, pct: 0.5 } : s.key === "lifestyle" ? { ...s, pct: 0.1 } : s));
        await mockFinanceService.saveBonusSplitDefault("mem-00000000-0011", split);
        const read = await mockFinanceService.getBonusSplitDefault("mem-00000000-0011");
        expect(read.find((s) => s.key === "goals")?.pct).toBe(0.5);
    });

    it("invalidates the finance cache on each mutation", async () => {
        const invalidate = vi.spyOn(queryClientModule.queryClient, "invalidateQueries");
        vi.spyOn(supabaseClientModule, "isSupabaseConfigured").mockReturnValue(false);
        const created = await financeService.saveBonusEvent(await baseInput());
        await financeService.deleteBonusEvent(created.id);
        await financeService.saveBonusSplitDefault("mem-00000000-0011", cloneDefaultSplit());
        expect(invalidate).toHaveBeenCalledTimes(3);
    });
});
