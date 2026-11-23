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
    for (const m of [
        "select",
        "eq",
        "gte",
        "lt",
        "limit",
        "order",
        "update",
        "insert",
        "upsert",
        "delete",
    ]) {
        obj[m] = vi.fn(() => obj);
    }
    obj.maybeSingle = vi.fn().mockResolvedValue(result);
    obj.single = vi.fn().mockResolvedValue(result);
    obj.then = (
        resolve: (v: unknown) => unknown,
        reject: (e: unknown) => unknown,
    ) => Promise.resolve(result).then(resolve, reject);
    return obj;
}

const OWNER = "00000000-0000-0000-0000-000000000011";
const BUDGET_ID = "00000000-0000-0000-0000-000000000701";
const FOOD = "00000000-0000-0000-0000-000000000101";

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

function installClient(
    tables: Record<string, Result>,
    extra: Record<string, unknown> = {},
) {
    const from = vi.fn((table: string) =>
        chain(tables[table] ?? { data: [], error: null }),
    );
    const client = {
        from,
        auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
        ...extra,
    };
    vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(
        client as never,
    );
    return client;
}

function budgetTables(
    budget: Record<string, unknown>,
    bonusEvents: Result,
): Record<string, Result> {
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
                    categories: {
                        id: FOOD,
                        household_id: "hh",
                        name: "Food",
                        color: "#000",
                        icon: "utensils",
                        is_system: false,
                    },
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
            bonus_events: {
                data: null,
                error: { code: "42P01", message: "relation does not exist" },
            },
        });
        expect(await supabaseFinanceService.getBonusEvents()).toEqual({
            available: false,
            events: [],
        });
        expect(await supabaseFinanceService.getBonusEvents()).toEqual({
            available: false,
            events: [],
        });
        expect(client.from).toHaveBeenCalledTimes(1);
    });

    it("treats PGRST205 as missing too", async () => {
        installClient({
            bonus_events: { data: null, error: { code: "PGRST205" } },
        });
        expect((await supabaseFinanceService.getBonusEvents()).available).toBe(
            false,
        );
    });

    it("throws other errors", async () => {
        installClient({
            bonus_events: {
                data: null,
                error: { code: "500", message: "boom" },
            },
        });
        await expect(
            supabaseFinanceService.getBonusEvents(),
        ).rejects.toMatchObject({ code: "500" });
    });

    it("maps bonus rows", async () => {
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
        });
    });

    it("keeps the bonus out of take-home and caps, and reports it from events", async () => {
        installClient(
            budgetTables(budgetRow(), {
                data: [
                    {
                        id: "b1",
                        recipient_id: OWNER,
                        received_on: "2026-11-05",
                        gross: 10000,
                        cpf: 2000,
                        net: 8000,
                    },
                ],
                error: null,
            }),
        );
        const detail = await supabaseFinanceService.getMonthlyBudget(
            "2026-11",
            OWNER,
        );
        expect(detail.budget.after_deductions).toBe(4800);
        expect(detail.disposablePool).toBe(4800);
        expect(detail.categories[0].allocated_amount).toBe(2400);
        expect(detail.budget.bonus).toBe(10000);
        expect(detail.bonusSummary).toEqual({
            gross: 10000,
            cpf: 2000,
            net: 8000,
            count: 1,
            source: "events",
        });
    });

    it("falls back to the legacy column and normalizes unlocked rows", async () => {
        installClient(
            budgetTables(budgetRow({ bonus: 1500, after_deductions: 6300 }), {
                data: null,
                error: { code: "42P01" },
            }),
        );
        const detail = await supabaseFinanceService.getMonthlyBudget(
            "2026-11",
            OWNER,
        );
        expect(detail.bonusSummary).toMatchObject({
            gross: 1500,
            net: 1500,
            cpf: 0,
            source: "legacy",
        });
        expect(detail.budget.after_deductions).toBe(4800);
        expect(detail.categories[0].allocated_amount).toBe(2400);
    });

    it("leaves locked legacy rows untouched", async () => {
        installClient(
            budgetTables(
                budgetRow({
                    bonus: 1500,
                    after_deductions: 6300,
                    is_locked: true,
                }),
                {
                    data: [],
                    error: null,
                },
            ),
        );
        const detail = await supabaseFinanceService.getMonthlyBudget(
            "2026-11",
            OWNER,
        );
        expect(detail.budget.after_deductions).toBe(6300);
        expect(detail.bonusSummary?.source).toBe("legacy");
    });

    it("strips bonus from monthly budget updates", async () => {
        const update = vi.fn(() => chain({ data: null, error: null }));
        installClient({}, { from: vi.fn(() => ({ update })) });
        await supabaseFinanceService.updateMonthlyBudget({
            id: BUDGET_ID,
            bonus: 999,
            gross_salary: 7000,
        });
        expect(update).toHaveBeenCalledWith({
            id: BUDGET_ID,
            gross_salary: 7000,
        });
    });

    it("inserts into bonus_events directly without touching goals", async () => {
        const client = installClient({
            households: { data: { id: "hh-uuid" }, error: null },
            bonus_events: {
                data: {
                    id: "b-new",
                    household_id: "hh-uuid",
                    recipient_id: OWNER,
                    type: "performance",
                    received_on: "2026-11-05",
                    gross: 10000,
                    cpf: 2000,
                    net: 8000,
                    split: [],
                },
                error: null,
            },
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
        };
        const saved = await supabaseFinanceService.saveBonusEvent(input);

        const bonusCall = client.from.mock.results.find(
            (_, i) => client.from.mock.calls[i][0] === "bonus_events",
        )?.value as { insert: ReturnType<typeof vi.fn> };
        expect(bonusCall.insert).toHaveBeenCalledWith(
            expect.objectContaining({
                household_id: "hh-uuid",
                recipient_id: OWNER,
                gross: 10000,
                cpf: 2000,
                note: "FY26",
            }),
        );
        expect(client.rpc).not.toHaveBeenCalled();
        expect(updateGoal).not.toHaveBeenCalled();
        expect(saved.id).toBe("b-new");
    });

    it("throws BonusLogUnavailableError when the table is missing", async () => {
        installClient({
            households: { data: { id: "hh-uuid" }, error: null },
            bonus_events: { data: null, error: { code: "42P01" } },
        });
        await expect(
            supabaseFinanceService.saveBonusEvent({
                recipient_id: OWNER,
                type: "other",
                received_on: "2026-11-05",
                gross: 100,
                cpf: 20,
                split: cloneDefaultSplit(),
            }),
        ).rejects.toBeInstanceOf(BonusLogUnavailableError);
    });

    it("returns the seeded default split when the table is missing", async () => {
        installClient({
            bonus_split_defaults: { data: null, error: { code: "42P01" } },
        });
        expect(
            await supabaseFinanceService.getBonusSplitDefault(OWNER),
        ).toEqual(cloneDefaultSplit());
    });
});

describe("mockFinanceService bonus log", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        mockFinanceService.resetData();
    });

    const baseInput = async (): Promise<SaveBonusEventInput> => ({
        recipient_id: "mem-00000000-0012",
        type: "performance",
        received_on: "2026-10-15",
        gross: 10000,
        cpf: 2000,
        split: cloneDefaultSplit(),
    });

    it("creates, edits and deletes a bonus without touching goals", async () => {
        const input = await baseInput();
        const goalsBefore = await mockFinanceService.getGoals();

        const created = await mockFinanceService.saveBonusEvent(input);
        expect(created.net).toBe(8000);

        const edited = await mockFinanceService.saveBonusEvent({
            ...input,
            id: created.id,
            gross: 12000,
            cpf: 2400,
        });
        expect(edited.net).toBe(9600);
        expect((await mockFinanceService.getGoals()).length).toBe(
            goalsBefore.length,
        );
        expect(await mockFinanceService.getGoals()).toEqual(goalsBefore);

        await mockFinanceService.deleteBonusEvent(created.id);
        expect(await mockFinanceService.getGoals()).toEqual(goalsBefore);
        expect((await mockFinanceService.getBonusEvents()).events).toHaveLength(
            0,
        );
    });

    it("counts the bonus as income without raising category caps", async () => {
        const input = await baseInput();
        const before = await mockFinanceService.getMonthlyBudget(
            "2026-10",
            input.recipient_id,
        );
        await mockFinanceService.saveBonusEvent(input);
        const after = await mockFinanceService.getMonthlyBudget(
            "2026-10",
            input.recipient_id,
        );
        expect(after.budget.after_deductions).toBe(
            before.budget.after_deductions,
        );
        expect(after.categories.map((c) => c.allocated_amount)).toEqual(
            before.categories.map((c) => c.allocated_amount),
        );
        expect(after.budget.bonus).toBe(10000);
        expect(after.bonusSummary).toMatchObject({
            gross: 10000,
            cpf: 2000,
            net: 8000,
            source: "events",
        });
    });

    it("saves and reads a member's default split", async () => {
        const split = cloneDefaultSplit().map((s) =>
            s.key === "goals"
                ? { ...s, pct: 0.5 }
                : s.key === "lifestyle"
                  ? { ...s, pct: 0.1 }
                  : s,
        );
        await mockFinanceService.saveBonusSplitDefault(
            "mem-00000000-0011",
            split,
        );
        const read =
            await mockFinanceService.getBonusSplitDefault("mem-00000000-0011");
        expect(read.find((s) => s.key === "goals")?.pct).toBe(0.5);
    });

    it("invalidates the finance cache on each mutation", async () => {
        const invalidate = vi.spyOn(
            queryClientModule.queryClient,
            "invalidateQueries",
        );
        vi.spyOn(supabaseClientModule, "isSupabaseConfigured").mockReturnValue(
            false,
        );
        const created = await financeService.saveBonusEvent(await baseInput());
        await financeService.deleteBonusEvent(created.id);
        await financeService.saveBonusSplitDefault(
            "mem-00000000-0011",
            cloneDefaultSplit(),
        );
        expect(invalidate).toHaveBeenCalledTimes(3);
    });
});
