import { describe, it, expect, beforeEach, vi } from "vitest";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { SupabaseInboxStore } from "../src/services/inbox/supabaseInboxStore";
import { InboxUnavailableError } from "../src/services/inbox/inboxErrors";
import { isMissingRelationError } from "../src/lib/supabaseErrors";
import type { SupabaseClient } from "@supabase/supabase-js";

const MISSING = {
    code: "PGRST205",
    message: "Could not find the table 'public.inbox_items'",
};

/** A query builder whose every call resolves to `result`. */
function fakeClient(result: { data: unknown; error: unknown }): SupabaseClient {
    const builder: Record<string, unknown> = {};
    const chain = () => builder;
    for (const m of [
        "select",
        "eq",
        "neq",
        "is",
        "order",
        "limit",
        "update",
        "insert",
        "upsert",
        "delete",
        "single",
        "maybeSingle",
    ]) {
        builder[m] = vi.fn(chain);
    }
    builder.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(result).then(resolve);
    return {
        from: vi.fn(() => builder),
        rpc: vi.fn(() => Promise.resolve(result)),
        auth: {
            getUser: vi.fn(() => Promise.resolve({ data: { user: null } })),
        },
    } as unknown as SupabaseClient;
}

describe("isMissingRelationError", () => {
    it("matches PostgREST and Postgres missing-object codes", () => {
        expect(isMissingRelationError(MISSING)).toBe(true);
        expect(isMissingRelationError({ code: "42P01" })).toBe(true);
        expect(isMissingRelationError({ code: "42883" })).toBe(true);
        expect(isMissingRelationError({ code: "23505" })).toBe(false);
        expect(isMissingRelationError(null)).toBe(false);
    });
});

describe("SupabaseInboxStore before the migration", () => {
    const store = new SupabaseInboxStore(
        () => fakeClient({ data: null, error: MISSING }),
        async () => "hh",
    );

    it("reports reads as unavailable", async () => {
        expect(await store.getInboxItems()).toEqual({
            available: false,
            items: [],
        });
        expect((await store.getInboxSummary("m1")).available).toBe(false);
        expect(await store.listCaptureTokens()).toEqual({
            available: false,
            tokens: [],
        });
        expect(await store.getMerchantRules()).toEqual([]);
    });

    it("throws InboxUnavailableError on writes", async () => {
        await expect(
            store.confirmInboxItem("i1", {
                payer_id: "m1",
                date: "2026-11-05",
                item: "x",
                amount: 1,
                is_shared: false,
            }),
        ).rejects.toBeInstanceOf(InboxUnavailableError);
        await expect(
            store.resolveInboxItem("i1", "discarded"),
        ).rejects.toBeInstanceOf(InboxUnavailableError);
        await expect(store.createCaptureToken("iPhone")).rejects.toBeInstanceOf(
            InboxUnavailableError,
        );
    });

    it("rethrows other errors", async () => {
        const broken = new SupabaseInboxStore(
            () =>
                fakeClient({
                    data: null,
                    error: { code: "500", message: "boom" },
                }),
            async () => "hh",
        );
        await expect(broken.getInboxItems()).rejects.toMatchObject({
            message: "boom",
        });
    });
});

describe("mock inbox (demo mode)", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFinanceService.resetData();
    });

    it("seeds three pending items across both members", async () => {
        const { available, items } = await mockFinanceService.getInboxItems();
        expect(available).toBe(true);
        expect(items).toHaveLength(3);
        expect(new Set(items.map((i) => i.member_id)).size).toBe(2);
        const summary = await mockFinanceService.getInboxSummary();
        expect(summary.pendingCount).toBe(3);
        expect(summary.pendingTotalSgd).toBeCloseTo(68.45);
    });

    it("confirms idempotently and records an expense and check-in", async () => {
        const [item] = (await mockFinanceService.getInboxItems()).items;
        const input = {
            payer_id: item.member_id,
            date: "2026-11-05",
            item: item.merchant,
            amount: item.amount,
            is_shared: false,
        };
        const first = await mockFinanceService.confirmInboxItem(item.id, input);
        const again = await mockFinanceService.confirmInboxItem(item.id, input);
        expect(again).toBe(first);
        const expenses = await mockFinanceService.getExpenses();
        expect(expenses.filter((e) => e.id === first)).toHaveLength(1);
        const checkins = await mockFinanceService.getDailyCheckins(
            item.member_id,
        );
        expect(checkins.some((c) => c.checkin_date === "2026-11-05")).toBe(
            true,
        );
        expect((await mockFinanceService.getInboxItems()).items).toHaveLength(
            2,
        );
    });

    it("discards and undoes", async () => {
        const [item] = (await mockFinanceService.getInboxItems()).items;
        await mockFinanceService.resolveInboxItem(item.id, "discarded");
        expect((await mockFinanceService.getInboxItems()).items).toHaveLength(
            2,
        );
        await mockFinanceService.resolveInboxItem(item.id, "pending");
        expect((await mockFinanceService.getInboxItems()).items).toHaveLength(
            3,
        );
    });

    it("upserts merchant rules and counts hits", async () => {
        await mockFinanceService.upsertMerchantRule({
            merchant_key: "grab food",
            category_id: "c1",
        });
        const rule = await mockFinanceService.upsertMerchantRule({
            merchant_key: "grab food",
            category_id: "c2",
        });
        expect(rule).toMatchObject({ category_id: "c2", hit_count: 2 });
        expect(await mockFinanceService.getMerchantRules()).toHaveLength(1);
    });
});
