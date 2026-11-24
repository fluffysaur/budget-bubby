import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@supabase/supabase-js";
import { scopeClientToHousehold } from "../src/server/householdScopedClient";

function fakeClient() {
    const eq = vi.fn();
    const builder = {
        select: vi.fn(() => ({ eq })),
        update: vi.fn(() => ({ eq })),
        delete: vi.fn(() => ({ eq })),
        insert: vi.fn(() => "inserted"),
    };
    const from = vi.fn(() => builder);
    return { client: { from } as unknown as SupabaseClient, from, builder, eq };
}

describe("scopeClientToHousehold", () => {
    it("adds a household_id filter to reads, updates and deletes", () => {
        const { client, builder, eq } = fakeClient();
        const scoped = scopeClientToHousehold(client, "hh-a");

        scoped.from("expenses").select("*");
        scoped.from("expenses").update({ note: "x" });
        scoped.from("expenses").delete();

        expect(builder.select).toHaveBeenCalledWith("*");
        expect(eq).toHaveBeenCalledTimes(3);
        expect(eq).toHaveBeenCalledWith("household_id", "hh-a");
    });

    it("scopes the households table by id", () => {
        const { client, eq } = fakeClient();
        scopeClientToHousehold(client, "hh-a").from("households").select("*");
        expect(eq).toHaveBeenCalledWith("id", "hh-a");
    });

    it("leaves inserts and child tables without household_id alone", () => {
        const { client, builder, eq } = fakeClient();
        const scoped = scopeClientToHousehold(client, "hh-a");

        expect(scoped.from("expenses").insert({})).toBe("inserted");
        scoped.from("monthly_budget_categories").select("*");

        expect(builder.insert).toHaveBeenCalled();
        expect(eq).not.toHaveBeenCalled();
    });

    it("throws for a table that is not classified", () => {
        const { client } = fakeClient();
        expect(() =>
            scopeClientToHousehold(client, "hh-a").from("brand_new_table"),
        ).toThrow(/not classified/);
    });

    it("filters real request URLs", async () => {
        const urls: string[] = [];
        const spy = vi.fn(async (input: RequestInfo | URL) => {
            urls.push(String(input));
            return new Response("[]", {
                status: 200,
                headers: { "Content-Type": "application/json" },
            });
        });
        const client = createClient("http://localhost", "key", {
            global: { fetch: spy as unknown as typeof fetch },
        });
        const scoped = scopeClientToHousehold(client, "hh-a");

        await scoped.from("expenses").select("*");
        await scoped.from("expenses").update({ note: "x" }).eq("id", "e1");
        await scoped.from("expenses").delete().eq("id", "e1");
        await scoped.from("expenses").insert({ note: "x" });

        const [select, update, del, insert] = urls;
        expect(select).toContain("household_id=eq.hh-a");
        expect(update).toContain("household_id=eq.hh-a");
        expect(del).toContain("household_id=eq.hh-a");
        expect(insert).not.toContain("household_id=");
    });
});
