import { describe, it, expect, vi, beforeAll } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
    handleCapture,
    createSupabaseCaptureDeps,
    resolveCapturedAt,
    type CaptureDeps,
    type CaptureRequest,
} from "../src/server/captureExpense";
import { generateCaptureToken } from "../src/lib/capture/token";

const NOW = new Date("2026-11-05T04:00:00Z");
let token: string;
let hash: string;

beforeAll(async () => {
    ({ token, hash } = await generateCaptureToken());
});

function makeDeps(overrides: Partial<CaptureDeps> = {}) {
    const deps = {
        findToken: vi.fn(async (h: string) =>
            h === hash
                ? { id: "tok-1", member_id: "m1", household_id: "hh" }
                : null,
        ),
        countRecentByToken: vi.fn(async () => 0),
        findRule: vi.fn(async () => null),
        findLikelyDuplicate: vi.fn(async () => null),
        findRecentCapture: vi.fn(async (): Promise<string | null> => null),
        insertItem: vi.fn(async () => ({ id: "item-1" })),
        findByIdempotencyKey: vi.fn(async () => ({ id: "item-0" })),
        countPending: vi.fn(async () => 3),
        touchToken: vi.fn(async () => {}),
        now: () => NOW,
        ...overrides,
    };
    return deps;
}

function req(
    body: unknown,
    over: Partial<CaptureRequest> = {},
): CaptureRequest {
    return {
        method: "POST",
        authorization: `Bearer ${token}`,
        bodyText: typeof body === "string" ? body : JSON.stringify(body),
        ...over,
    };
}

const valid = {
    amount: "S$12.50",
    merchant: "GRAB*FOOD 8812",
    card: "DBS Altitude",
    timestamp: "2026-11-05T12:00:00+08:00",
};

describe("handleCapture", () => {
    it("rejects non-POST methods", async () => {
        const deps = makeDeps();
        expect(
            (await handleCapture(deps, req(valid, { method: "GET" }))).status,
        ).toBe(405);
        expect(
            (await handleCapture(deps, req(valid, { method: "OPTIONS" })))
                .status,
        ).toBe(405);
    });

    it("401s malformed tokens without a DB hit, and unknown/revoked tokens identically", async () => {
        const deps = makeDeps();
        const bad = await handleCapture(
            deps,
            req(valid, { authorization: "Bearer nope" }),
        );
        expect(bad).toEqual({ status: 401, body: { error: "unauthorized" } });
        expect(deps.findToken).not.toHaveBeenCalled();

        const other = await generateCaptureToken();
        const unknown = await handleCapture(
            deps,
            req(valid, { authorization: `Bearer ${other.token}` }),
        );
        expect(unknown).toEqual(bad);
    });

    it("413s oversized bodies", async () => {
        const res = await handleCapture(
            makeDeps(),
            req({ ...valid, pad: "x".repeat(5000) }),
        );
        expect(res.status).toBe(413);
    });

    it("rate limits per minute and per day", async () => {
        const minute = makeDeps({ countRecentByToken: vi.fn(async () => 10) });
        expect(await handleCapture(minute, req(valid))).toEqual({
            status: 429,
            body: { error: "rate_limited", retry_after: 60 },
        });
        const day = makeDeps({
            countRecentByToken: vi.fn(async (_id: string, since: string) =>
                since > new Date(NOW.getTime() - 120_000).toISOString()
                    ? 1
                    : 150,
            ),
        });
        expect((await handleCapture(day, req(valid))).body).toEqual({
            error: "rate_limited",
            retry_after: 3600,
        });
    });

    it("400s per field", async () => {
        const deps = makeDeps();
        expect((await handleCapture(deps, req("{not json"))).body).toEqual({
            error: "invalid_json",
        });
        expect((await handleCapture(deps, req("[1]"))).body).toEqual({
            error: "invalid_json",
        });
        expect(
            (await handleCapture(deps, req({ ...valid, amount: "abc" }))).body,
        ).toEqual({ error: "invalid_amount" });
        expect(
            (await handleCapture(deps, req({ ...valid, merchant: "  " }))).body,
        ).toEqual({ error: "invalid_merchant" });
        expect(deps.insertItem).not.toHaveBeenCalled();
    });

    it("ignores refunds and ignore-rule merchants", async () => {
        const deps = makeDeps({
            findRule: vi.fn(async () => ({
                action: "ignore" as const,
                category_id: null,
            })),
        });
        expect(await handleCapture(deps, req(valid))).toEqual({
            status: 200,
            body: { status: "ignored" },
        });
        expect(
            await handleCapture(makeDeps(), req({ ...valid, amount: "-5.00" })),
        ).toEqual({
            status: 200,
            body: { status: "ignored" },
        });
        expect(deps.insertItem).not.toHaveBeenCalled();
    });

    it("captures with the right row and touches the token", async () => {
        const deps = makeDeps({
            findRule: vi.fn(async () => ({
                action: "categorise" as const,
                category_id: "cat-food",
            })),
            findLikelyDuplicate: vi.fn(async () => "exp-9"),
        });
        const res = await handleCapture(
            deps,
            req({ ...valid, source: "Wallet" }),
        );
        expect(res).toEqual({
            status: 201,
            body: { status: "captured", id: "item-1", inboxCount: 3 },
        });
        const row = vi.mocked(deps.insertItem).mock.calls[0][0];
        expect(row).toMatchObject({
            household_id: "hh",
            member_id: "m1",
            token_id: "tok-1",
            source: "wallet",
            merchant: "Grab*Food 8812",
            merchant_key: "grab food",
            amount: 12.5,
            currency: "SGD",
            raw_amount: "S$12.50",
            card_name: "DBS Altitude",
            captured_at: "2026-11-05T04:00:00.000Z",
            suggested_category_id: "cat-food",
            likely_duplicate_of: "exp-9",
        });
        expect(row.idempotency_key).toMatch(/^[0-9a-f]{64}$/);
        expect(deps.findLikelyDuplicate).toHaveBeenCalledWith({
            memberId: "m1",
            amount: 12.5,
            currency: "SGD",
            dateFrom: "2026-11-04",
            dateTo: "2026-11-06",
        });
        expect(deps.touchToken).toHaveBeenCalledWith(
            "tok-1",
            NOW.toISOString(),
        );
    });

    it("accepts the generic Android-style body (number amount, occurred_at)", async () => {
        const deps = makeDeps();
        const res = await handleCapture(
            deps,
            req({
                amount: 4.99,
                currency: "usd",
                merchant: "Steam",
                occurred_at: "2026-11-05T03:30:00Z",
                source: "android",
            }),
        );
        expect(res.status).toBe(201);
        expect(vi.mocked(deps.insertItem).mock.calls[0][0]).toMatchObject({
            amount: 4.99,
            currency: "USD",
            raw_amount: null,
            source: "android",
            captured_at: "2026-11-05T03:30:00.000Z",
        });
    });

    it("returns duplicate when the idempotent insert conflicts", async () => {
        const deps = makeDeps({ insertItem: vi.fn(async () => null) });
        expect(await handleCapture(deps, req(valid))).toEqual({
            status: 200,
            body: { status: "duplicate", id: "item-0" },
        });
    });

    it("503s before the migration and 500s on other errors", async () => {
        const missing = makeDeps({
            findToken: vi.fn(async () => {
                throw { code: "42P01" };
            }),
        });
        expect(await handleCapture(missing, req(valid))).toEqual({
            status: 503,
            body: { error: "not_ready" },
        });
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        const broken = makeDeps({
            insertItem: vi.fn(async () => {
                throw new Error("boom");
            }),
        });
        expect(await handleCapture(broken, req(valid))).toEqual({
            status: 500,
            body: { error: "server_error" },
        });
        expect(JSON.stringify(spy.mock.calls)).not.toContain(token);
        spy.mockRestore();
    });
});

describe("handleCapture with raw_text", () => {
    const sms =
        "Your DBS card ending 1234 was used for SGD12.50 on 05 Nov 11:58 at GRAB*FOOD. If unauthorised, call 1800 111 1111.";

    it("captures amount, merchant, time and bank from the alert", async () => {
        const deps = makeDeps();
        const res = await handleCapture(
            deps,
            req({ raw_text: sms, source: "sms" }),
        );
        expect(res.status).toBe(201);
        expect(vi.mocked(deps.insertItem).mock.calls[0][0]).toMatchObject({
            source: "sms",
            merchant: "Grab*Food",
            merchant_key: "grab food",
            amount: 12.5,
            currency: "SGD",
            raw_amount: "SGD12.50",
            card_name: "DBS",
            captured_at: "2026-11-05T03:58:00.000Z",
        });
    });

    it("lets explicit fields win over the parsed text", async () => {
        const deps = makeDeps();
        await handleCapture(
            deps,
            req({
                raw_text: sms,
                merchant: "Grab Food",
                card: "DBS Altitude",
                occurred_at: "2026-11-05T03:59:30Z",
            }),
        );
        expect(vi.mocked(deps.insertItem).mock.calls[0][0]).toMatchObject({
            merchant: "Grab Food",
            card_name: "DBS Altitude",
            captured_at: "2026-11-05T03:59:30.000Z",
        });
    });

    it("falls back to a bank label when no merchant is named", async () => {
        const deps = makeDeps();
        await handleCapture(
            deps,
            req({ raw_text: "OCBC: SGD 6.00 was debited from your account." }),
        );
        expect(vi.mocked(deps.insertItem).mock.calls[0][0].merchant).toBe(
            "OCBC alert",
        );
    });

    it("ignores OTPs, declined charges and incoming transfers without inserting", async () => {
        const deps = makeDeps();
        for (const [text, reason] of [
            ["Your OTP for SGD 12.50 at GRAB*FOOD is 123456.", "otp"],
            ["Your card transaction of SGD 8.00 was declined.", "declined"],
            ["You have received SGD 25.00 via PayNow.", "incoming"],
        ]) {
            expect(
                await handleCapture(
                    deps,
                    req({ raw_text: text, amount: "SGD 1.00", merchant: "x" }),
                ),
            ).toEqual({ status: 200, body: { status: "ignored", reason } });
        }
        expect(deps.insertItem).not.toHaveBeenCalled();
    });

    it("ignores text that is not a charge", async () => {
        const res = await handleCapture(
            makeDeps(),
            req({ raw_text: "Your statement is ready." }),
        );
        expect(res.body).toEqual({ status: "ignored", reason: "not_a_charge" });
    });

    it("returns duplicate when another source already captured the purchase", async () => {
        const deps = makeDeps({
            findRecentCapture: vi.fn(async () => "item-wallet"),
        });
        const res = await handleCapture(
            deps,
            req({ raw_text: sms, source: "sms" }),
        );
        expect(res).toEqual({
            status: 200,
            body: { status: "duplicate", id: "item-wallet" },
        });
        expect(deps.findRecentCapture).toHaveBeenCalledWith({
            memberId: "m1",
            amount: 12.5,
            currency: "SGD",
            fromIso: "2026-11-05T03:56:00.000Z",
            toIso: "2026-11-05T04:00:00.000Z",
            excludeSource: "sms",
        });
        expect(deps.insertItem).not.toHaveBeenCalled();
        expect(deps.touchToken).toHaveBeenCalled();
    });

    it("accepts multi-line MacroDroid JSON and uses title/app/sender context", async () => {
        const deps = makeDeps();
        const rawJsonWithLiteralNewlines =
            '{\n  "raw_text": "Amount: SGD 18.00\nTo: CASEY PLACEHOLDER",\n  "title": "Payment Alert",\n  "app": "digibank",\n  "source": "bank"\n}';
        const res = await handleCapture(
            deps,
            req(rawJsonWithLiteralNewlines),
        );
        expect(res.status).toBe(201);
        expect(vi.mocked(deps.insertItem).mock.calls[0][0]).toMatchObject({
            source: "bank",
            merchant: "Casey Placeholder",
            amount: 18,
            currency: "SGD",
            card_name: "DBS",
        });
    });
});

describe("resolveCapturedAt", () => {
    it("falls back to now for missing, bad or out-of-window stamps", () => {
        expect(resolveCapturedAt(undefined, NOW)).toBe(NOW);
        expect(resolveCapturedAt("garbage", NOW)).toBe(NOW);
        expect(resolveCapturedAt("2026-10-01T00:00:00Z", NOW)).toBe(NOW);
        expect(resolveCapturedAt("2026-11-05T05:00:00Z", NOW)).toBe(NOW);
        expect(
            resolveCapturedAt("2026-11-05T04:05:00Z", NOW).toISOString(),
        ).toBe("2026-11-05T04:05:00.000Z");
    });
});

describe("createSupabaseCaptureDeps", () => {
    it("exposes only the scoped methods and touches only capture tables", async () => {
        const tables: string[] = [];
        const builder: Record<string, unknown> = {};
        for (const m of [
            "select",
            "eq",
            "neq",
            "is",
            "gte",
            "lte",
            "limit",
            "upsert",
            "update",
            "maybeSingle",
        ]) {
            builder[m] = () => builder;
        }
        builder.then = (resolve: (v: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, count: 0 }).then(
                resolve,
            );
        const client = {
            from: (t: string) => {
                tables.push(t);
                return builder;
            },
        } as unknown as SupabaseClient;

        const deps = createSupabaseCaptureDeps(client);
        expect(Object.keys(deps).sort()).toEqual(
            [
                "countPending",
                "countRecentByToken",
                "findByIdempotencyKey",
                "findLikelyDuplicate",
                "findRecentCapture",
                "findRule",
                "findToken",
                "insertItem",
                "now",
                "touchToken",
            ].sort(),
        );

        await deps.findToken("x");
        await deps.countRecentByToken("t", "s");
        await deps.findRule("h", "k");
        await deps.findLikelyDuplicate({
            memberId: "m",
            amount: 1,
            currency: "SGD",
            dateFrom: "a",
            dateTo: "b",
        });
        await deps.findRecentCapture({
            memberId: "m",
            amount: 1,
            currency: "SGD",
            fromIso: "a",
            toIso: "b",
            excludeSource: "sms",
        });
        await deps.insertItem({} as never);
        await deps.findByIdempotencyKey("m", "k");
        await deps.countPending("h");
        await deps.touchToken("t", "n");
        expect(new Set(tables)).toEqual(
            new Set([
                "capture_tokens",
                "inbox_items",
                "merchant_rules",
                "expenses",
            ]),
        );
    });
});
