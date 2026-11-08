/**
 * Parses an amount as a phone sends it ("S$12.50", "US$4.99", "¥1,200",
 * "Rp 150.000", 12.5) into a positive number and an ISO currency code.
 *
 * Shared by the capture-expense Edge Function and the `?action=new` deep
 * link. Pure: no browser or Deno APIs.
 */

import {
    SUPPORTED_CURRENCIES,
    isZeroDecimalCurrency,
} from "../currencyConverter";

export type ParsedAmount =
    | { ok: true; amount: number; currency: string }
    | { ok: false; reason: "ignored" | "invalid" | "too_large" };

/** Largest SGD amount accepted from a capture. */
export const MAX_CAPTURE_SGD = 20_000;
/** Raw amount strings longer than this are rejected. */
export const MAX_RAW_AMOUNT_LENGTH = 40;

// Symbols and prefixes, longest first so "US$" is not read as "S$" or "$".
// A bare "$" means SGD: both phones are set to the Singapore region.
const SYMBOLS: readonly [string, string][] = [
    ["JP¥", "JPY"],
    ["CN¥", "CNY"],
    ["US$", "USD"],
    ["NT$", "TWD"],
    ["HK$", "HKD"],
    ["RMB", "CNY"],
    ["S$", "SGD"],
    ["A$", "AUD"],
    ["RM", "MYR"],
    ["RP", "IDR"],
    ["¥", "JPY"],
    ["€", "EUR"],
    ["£", "GBP"],
    ["₩", "KRW"],
    ["฿", "THB"],
    ["₫", "VND"],
    ["₱", "PHP"],
    ["$", "SGD"],
];

const ISO_CODE = /^[A-Z]{3}$/;

/** Normalises an optional ISO code. Returns null when it isn't one. */
export function normalizeCurrencyCode(code: unknown): string | null {
    if (typeof code !== "string") return null;
    const upper = code.trim().toUpperCase();
    return ISO_CODE.test(upper) ? upper : null;
}

function detectCurrency(nonNumeric: string): string | null {
    const upper = nonNumeric.toUpperCase();
    // A 3-letter ISO code wins over any symbol ("USD 4.99", "4.99 EUR")
    const letters = upper.match(/[A-Z]+/g) ?? [];
    for (const run of letters) {
        if (run === "RMB") return "CNY";
        if (ISO_CODE.test(run)) return run;
    }
    for (const [symbol, code] of SYMBOLS) {
        if (upper.includes(symbol)) return code;
    }
    return null;
}

function parseNumber(text: string, currency: string): number {
    const cleaned = text.replace(/'/g, "");
    const lastDot = cleaned.lastIndexOf(".");
    const lastComma = cleaned.lastIndexOf(",");
    if (lastDot === -1 && lastComma === -1) return Number(cleaned);

    if (lastDot !== -1 && lastComma !== -1) {
        // Both present: the last one is the decimal separator
        const decimal = lastDot > lastComma ? "." : ",";
        const group = decimal === "." ? "," : ".";
        return Number(cleaned.split(group).join("").replace(decimal, "."));
    }

    const sep = lastDot !== -1 ? "." : ",";
    const parts = cleaned.split(sep);
    if (parts.length > 2) return Number(parts.join(""));
    const after = parts[1] ?? "";
    // "1,200" or "150.000" (zero-decimal currency) are thousands groups
    if (
        after.length === 3 &&
        (sep === "," || isZeroDecimalCurrency(currency))
    ) {
        return Number(parts.join(""));
    }
    return Number(`${parts[0] || "0"}.${after}`);
}

/** Max accepted amount in a currency: the SGD cap times a generous rate bound. */
export function maxAmountFor(currency: string): number {
    if (currency === "SGD") return MAX_CAPTURE_SGD;
    const config = SUPPORTED_CURRENCIES.find((c) => c.code === currency);
    if (config) return MAX_CAPTURE_SGD * config.defaultRatePerSGD * 3;
    return 100_000_000;
}

/**
 * @param raw The amount as sent: a string or a number.
 * @param currencyOverride Optional ISO code. Wins over anything in `raw`.
 */
export function parseCapturedAmount(
    raw: unknown,
    currencyOverride?: string | null,
): ParsedAmount {
    const override = normalizeCurrencyCode(currencyOverride);

    let value: number;
    let currency: string;

    if (typeof raw === "number") {
        if (!Number.isFinite(raw)) return { ok: false, reason: "invalid" };
        value = raw;
        currency = override ?? "SGD";
    } else if (typeof raw === "string") {
        if (raw.length > MAX_RAW_AMOUNT_LENGTH)
            return { ok: false, reason: "invalid" };
        const compact = raw.replace(/\s/g, ""); // \s also matches NBSP and narrow NBSP
        const numeric = compact.match(/\d[\d.,']*/);
        if (!numeric) return { ok: false, reason: "invalid" };

        const nonNumeric = compact.replace(numeric[0], " ");
        currency = override ?? detectCurrency(nonNumeric) ?? "SGD";
        const negative = /^[-−(]|[-−)]$/.test(
            compact.replace(/[^\d.,'\-−()]/g, ""),
        );
        value = parseNumber(numeric[0].replace(/[.,]$/, ""), currency);
        if (!Number.isFinite(value)) return { ok: false, reason: "invalid" };
        if (negative) value = -value;
    } else {
        return { ok: false, reason: "invalid" };
    }

    // Refunds and card verifications
    if (value <= 0) return { ok: false, reason: "ignored" };

    const amount = Math.round(value * 100) / 100;
    if (amount <= 0) return { ok: false, reason: "ignored" };
    if (amount > maxAmountFor(currency))
        return { ok: false, reason: "too_large" };
    return { ok: true, amount, currency };
}
