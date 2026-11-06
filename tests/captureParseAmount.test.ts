import { describe, it, expect } from "vitest";
import { parseCapturedAmount } from "../src/lib/capture/parseAmount";

const ok = (amount: number, currency: string) => ({ ok: true, amount, currency });

describe("parseCapturedAmount", () => {
    it("reads SGD amounts with and without symbols", () => {
        expect(parseCapturedAmount("S$12.50")).toEqual(ok(12.5, "SGD"));
        expect(parseCapturedAmount("$12.50")).toEqual(ok(12.5, "SGD"));
        expect(parseCapturedAmount("12.5")).toEqual(ok(12.5, "SGD"));
        expect(parseCapturedAmount(12.5)).toEqual(ok(12.5, "SGD"));
        expect(parseCapturedAmount("S$ 1,234.56")).toEqual(ok(1234.56, "SGD"));
    });

    it("detects foreign symbols and prefixes", () => {
        expect(parseCapturedAmount("US$4.99")).toEqual(ok(4.99, "USD"));
        expect(parseCapturedAmount("¥1,200")).toEqual(ok(1200, "JPY"));
        expect(parseCapturedAmount("Rp 150.000")).toEqual(ok(150000, "IDR"));
        expect(parseCapturedAmount("₩12,000")).toEqual(ok(12000, "KRW"));
        expect(parseCapturedAmount("RM 8.90")).toEqual(ok(8.9, "MYR"));
        expect(parseCapturedAmount("€3,50")).toEqual(ok(3.5, "EUR"));
        expect(parseCapturedAmount("HK$88")).toEqual(ok(88, "HKD"));
    });

    it("lets a 3-letter ISO code or override win", () => {
        expect(parseCapturedAmount("4.99 USD")).toEqual(ok(4.99, "USD"));
        expect(parseCapturedAmount("$4.99", "usd")).toEqual(ok(4.99, "USD"));
        expect(parseCapturedAmount(1200, "JPY")).toEqual(ok(1200, "JPY"));
    });

    it("ignores refunds and zero amounts", () => {
        expect(parseCapturedAmount("-5.00")).toEqual({ ok: false, reason: "ignored" });
        expect(parseCapturedAmount("-S$5.00")).toEqual({ ok: false, reason: "ignored" });
        expect(parseCapturedAmount("0")).toEqual({ ok: false, reason: "ignored" });
        expect(parseCapturedAmount(0)).toEqual({ ok: false, reason: "ignored" });
    });

    it("rejects garbage", () => {
        expect(parseCapturedAmount("abc")).toEqual({ ok: false, reason: "invalid" });
        expect(parseCapturedAmount("")).toEqual({ ok: false, reason: "invalid" });
        expect(parseCapturedAmount(null)).toEqual({ ok: false, reason: "invalid" });
        expect(parseCapturedAmount({})).toEqual({ ok: false, reason: "invalid" });
        expect(parseCapturedAmount(Number.NaN)).toEqual({ ok: false, reason: "invalid" });
        expect(parseCapturedAmount("1".repeat(50))).toEqual({ ok: false, reason: "invalid" });
    });

    it("caps implausible amounts per currency", () => {
        expect(parseCapturedAmount("S$20,000.01")).toEqual({ ok: false, reason: "too_large" });
        expect(parseCapturedAmount("S$20,000")).toEqual(ok(20000, "SGD"));
        // 2,000,000 yen is within the JPY bound
        expect(parseCapturedAmount("¥2,000,000")).toEqual(ok(2000000, "JPY"));
        expect(parseCapturedAmount("¥99,000,000")).toEqual({ ok: false, reason: "too_large" });
    });
});
