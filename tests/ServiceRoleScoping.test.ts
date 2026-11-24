import { describe, it, expect } from "vitest";
import captureSource from "../src/server/captureExpense.ts?raw";
import remindersSource from "../src/server/sendReminders.ts?raw";

/**
 * Edge functions use the service-role key, which bypasses RLS. Every query in
 * src/server must therefore be scoped in code. This test pins each query to
 * its scoping column(s); a new or changed query fails until it is reviewed
 * and added here (issue #235). The SQL side is covered by
 * supabase/tests/rls_household_isolation.sql.
 */

type Chain = { table: string; op: string; eq: string[] };

const sources: Record<string, string> = {
    "captureExpense.ts": captureSource,
    "sendReminders.ts": remindersSource,
};

function extractChains(file: string): Chain[] {
    const chains: Chain[] = [];
    const re = /\.from\("(\w+)"\)([\s\S]*?);/g;
    for (const match of sources[file].matchAll(re)) {
        const body = match[2];
        const op =
            (["insert", "upsert", "update", "delete"] as const).find((o) =>
                body.includes(`.${o}(`),
            ) ?? "select";
        const eq = [...body.matchAll(/\.eq\("(\w+)"/g)].map((m) => m[1]);
        chains.push({ table: match[1], op, eq });
    }
    return chains;
}

const key = (c: Chain) => `${c.table}:${c.op}:${[...c.eq].sort().join("+")}`;

describe("service-role queries are scoped (captureExpense)", () => {
    // Auth is the member's bearer token; the token row yields household_id and
    // member_id, which scope every later query.
    const expected = [
        "capture_tokens:select:token_hash", // bearer-token lookup
        "inbox_items:select:token_id",
        "merchant_rules:select:household_id+merchant_key",
        "expenses:select:payer_id",
        "inbox_items:select:amount+currency+member_id",
        "inbox_items:upsert:", // row carries household_id/member_id from the token row
        "inbox_items:select:idempotency_key+member_id",
        "inbox_items:select:household_id+status",
        "capture_tokens:update:id", // id comes from the verified token row
    ];

    it("matches the reviewed query manifest", () => {
        const found = extractChains("captureExpense.ts").map(key);
        expect(found.sort()).toEqual([...expected].sort());
    });

    it("scopes every query except the token lookup and the token-derived insert", () => {
        for (const c of extractChains("captureExpense.ts")) {
            if (c.table === "capture_tokens" && c.eq.includes("token_hash")) {
                continue;
            }
            if (c.op === "upsert") continue;
            expect(c.eq.length, key(c)).toBeGreaterThan(0);
        }
    });

    it("inserts inbox rows with ids from the verified token", () => {
        const source = captureSource;
        expect(source).toContain("household_id: tokenRow.household_id");
        expect(source).toContain("member_id: tokenRow.member_id");
    });
});

describe("service-role queries are scoped (sendReminders)", () => {
    // The cron job intentionally lists every household, then handles each one
    // with a client scoped to that household (see householdScopedClient.ts).
    const expected = [
        "households:select:", // cron: all households by design
        "household_members:select:household_id", // one household's members
        "push_subscriptions:select:member_id",
        "push_subscriptions:delete:endpoint", // endpoint came from that member's own list
    ];

    it("matches the reviewed query manifest", () => {
        const found = extractChains("sendReminders.ts").map(key);
        expect(found.sort()).toEqual([...expected].sort());
    });

    it("builds each household's service on a scoped client", () => {
        expect(remindersSource).toContain(
            "scopeClientToHousehold(client, householdId)",
        );
    });
});
