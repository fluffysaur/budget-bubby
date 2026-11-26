import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountsStore as SupabaseAccounts } from "../supabase/accounts";
import type { SupabaseContext } from "../supabase/context";
import { mockFinanceService } from "../mockFinanceService";

const rows = [
    { id: "a", household_id: "h", type: "Cash", name: "A", sort_order: 0 },
    { id: "b", household_id: "h", type: "Cash", name: "B", sort_order: 1 },
    { id: "c", household_id: "h", type: "Cash", name: "C", sort_order: 2 },
    { id: "z", household_id: "h", type: "CPF", name: "Z", sort_order: 0 },
];

function fakeContext(updateError: Error | null = null) {
    const updates: Array<{ payload: unknown; id: string }> = [];
    const client = {
        from: () => ({
            select: () => Promise.resolve({ data: rows, error: null }),
            update: (payload: unknown) => ({
                eq: (_column: string, id: string) => {
                    updates.push({ payload, id });
                    return Promise.resolve({ error: updateError });
                },
            }),
        }),
    };
    const ctx = { getClient: () => client } as unknown as SupabaseContext;
    return { ctx, updates };
}

describe("reorderAccounts (Supabase)", () => {
    it("writes only sort_order, and only for rows that moved", async () => {
        const { ctx, updates } = fakeContext();
        await new SupabaseAccounts(ctx).reorderAccounts(["c", "b", "a"]);
        expect(updates).toEqual([
            { id: "c", payload: { sort_order: 0 } },
            { id: "a", payload: { sort_order: 2 } },
        ]);
    });

    it("keeps hidden accounts in their slots", async () => {
        const { ctx, updates } = fakeContext();
        await new SupabaseAccounts(ctx).reorderAccounts(["c", "a"]);
        expect(updates.map((u) => u.id)).toEqual(["c", "a"]);
    });

    it("throws when an update fails", async () => {
        const { ctx } = fakeContext(new Error("denied"));
        await expect(
            new SupabaseAccounts(ctx).reorderAccounts(["b", "a"]),
        ).rejects.toThrow("denied");
    });
});

describe("account order (mock)", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.useRealTimers();
    });

    const cash = async () =>
        (await mockFinanceService.getAccounts("household")).filter(
            (a) => a.type === "Cash",
        );

    it("saves the new order without touching updated_at", async () => {
        const before = await cash();
        const ids = before.map((a) => a.id).reverse();

        await mockFinanceService.reorderAccounts(ids);

        const after = await cash();
        expect(after.map((a) => a.id)).toEqual(ids);
        expect(after.map((a) => a.sort_order)).toEqual(ids.map((_, i) => i));
        for (const account of after) {
            expect(account.updated_at).toBe(
                before.find((a) => a.id === account.id)?.updated_at,
            );
        }
    });

    it("adds a new account at the end of its group", async () => {
        const before = await cash();
        const created = await mockFinanceService.createAccount({
            owner_id: before[0].owner_id,
            name: "AAA First By Name",
            type: "Cash",
            balance: 1,
        });
        const after = await cash();
        expect(after[after.length - 1].id).toBe(created.id);
        expect(created.sort_order).toBe(
            Math.max(...before.map((a) => a.sort_order ?? -1)) + 1,
        );
    });
});
