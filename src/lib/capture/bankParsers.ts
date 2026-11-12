/**
 * Reads a raw bank notification or SMS alert ("Your DBS card ending 1234 was
 * used for SGD12.50 on 11 Nov 14:32 at GRAB*FOOD.") into a capture.
 *
 * Tuned for the usual wording of Singapore banks (DBS/POSB, OCBC, UOB,
 * Standard Chartered, Citibank, HSBC) and generic card SMS. Bank wording
 * changes, so the extraction is keyword based rather than one strict pattern
 * per bank: find the amount, then the merchant or payee after "at"/"to",
 * then an optional date and time read as Singapore time.
 *
 * Pure: shared by the capture-expense Edge Function and tests.
 */

import { parseCapturedAmount } from "./parseAmount";

export const MAX_RAW_TEXT_LENGTH = 1000;

export type IgnoreReason = "otp" | "declined" | "incoming" | "not_a_charge";

export interface BankAlertContext {
    title?: string | null;
    sender?: string | null;
    app?: string | null;
}

export type BankAlert =
    | {
          kind: "charge";
          amount: number;
          currency: string;
          /** The amount as written, e.g. "SGD 12.50". */
          rawAmount: string;
          /** Merchant or payee as written, or null when none is named. */
          merchant: string | null;
          /** Only set when the alert names a time, or a day other than today. */
          occurredAt: Date | null;
          bank: string | null;
      }
    | { kind: "ignore"; reason: IgnoreReason };

// Checked in order: an OTP for a purchase also names an amount and merchant.
const OTP =
    /\b(?:otp|one[- ]time (?:password|passcode|pin|code)|verification code|security code|authentication code|2fa)\b/i;
const DECLINED =
    /\b(?:declined|unsuccessful|failed|rejected|not approved|not processed|cancelled|canceled|voided)\b/i;
const INCOMING =
    /\b(?:received|credited|incoming|deposited|refund(?:ed)?|cashback|salary|reversed|reversal)\b/i;
const OUTBOUND =
    /\b(?:used|charged|spent|spend|transaction|purchase|paid|payment|debited|deducted|transfer(?:red)?|sent|withdrawn|withdrawal)\b|\bamount\s*:/i;

const BANKS: readonly [RegExp, string][] = [
    [/\bposb\b/i, "POSB"],
    [/\b(?:dbs|paylah|digibank)\b/i, "DBS"],
    [/\bocbc\b/i, "OCBC"],
    [/\buob\b/i, "UOB"],
    [/\b(?:scb|standard chartered|stanchart)\b/i, "Standard Chartered"],
    [/\bciti(?:bank)?\b/i, "Citibank"],
    [/\bhsbc\b/i, "HSBC"],
    [/^trust\b|\btrust\s+(?:bank|card)\b/i, "Trust"],
    [/\bgxs\b/i, "GXS"],
    [/\bmaribank\b/i, "MariBank"],
    [/\byoutrip\b/i, "YouTrip"],
    [/\brevolut\b/i, "Revolut"],
    [/^wise\b|\bwise\s+(?:card|account)\b/i, "Wise"],
];

const CODES =
    "SGD|USD|EUR|GBP|JPY|CNY|RMB|HKD|TWD|AUD|NZD|MYR|IDR|KRW|THB|VND|PHP|INR|CHF|CAD";
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?|\d+(?:\.\d{1,2})?`;
// A currency is required next to the number, so card digits and phone
// numbers are never read as the amount.
const AMOUNT = new RegExp(
    String.raw`(?:\b(?:${CODES})\s?|(?:\b[A-Z]{1,2})?\$\s?|\bRM\s?|[€£¥₩฿₫₱]\s?)(?:${NUM})(?!\d)|(?:${NUM})\s?(?:${CODES})\b`,
    "i",
);

// Where a merchant or payee starts, and where it ends.
const MERCHANT_START = /\b(?:(?:at|to)\b\s*:?|(?:merchant|payee)\s*:)\s*/gi;
const MERCHANT_END =
    /\s+on\s+\d|\.(?:\s|$)|[;!?]|\s+if\b|\s+not you\b|\s+(?:was|is|has|have|were|using|via|with|from|ref)\b|$/i;
const NOT_A_MERCHANT =
    /^(?:your|you|the|my|card|be|view|call|approve)\b|^\d{1,2}[:.]\d{2}/i;
// "to Acc ending 5678 (JORDAN TEST)" -> "JORDAN TEST"
const ACCOUNT_WITH_NAME =
    /^(?:acc(?:ount)?|a\/c|mobile|nric|uen|card)\b[^(]*\(([^)]+)\)/i;

const MONTHS = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
];
const MONTH_NAME =
    "jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?";
const TIME = String.raw`(?:\s*(?:at|,|-)?\s*(\d{1,2})[:.](\d{2})(?:\s?([ap])\.?m\.?)?(?!\d))?`;
// "11 Nov 14:32", "11NOV26", "11 November 2026 2:10PM"
const DATE_DMY = new RegExp(
    String.raw`\b(\d{1,2})\s?(${MONTH_NAME})(?![a-z])\s?(\d{4}|\d{2})?(?![\d:])${TIME}`,
    "i",
);
// "11/11/26", "11/11/2026 13:15" (day first, as in Singapore)
const DATE_SLASH = new RegExp(
    String.raw`\b(\d{1,2})/(\d{1,2})/(\d{4}|\d{2})(?!\d)${TIME}`,
    "i",
);

const SGT_OFFSET_MS = 8 * 3_600_000;
const DAY_MS = 86_400_000;

function normalizeText(raw: string): string {
    return (
        raw
            .slice(0, MAX_RAW_TEXT_LENGTH)
            // Line breaks separate fields ("To: X\nDate: Y")
            .replace(/\s*[\r\n]+\s*/g, ". ")
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );
}

function detectBank(text: string): string | null {
    for (const [pattern, name] of BANKS) {
        if (pattern.test(text)) return name;
    }
    return null;
}

function findMerchant(text: string): string | null {
    for (const start of text.matchAll(MERCHANT_START)) {
        const rest = text.slice((start.index ?? 0) + start[0].length);
        const end = rest.search(MERCHANT_END);
        let candidate = rest
            .slice(0, end === -1 ? undefined : end)
            .replace(/[\s,:]+$/, "")
            .trim();
        if (!candidate || NOT_A_MERCHANT.test(candidate)) continue;
        const named = candidate.match(ACCOUNT_WITH_NAME);
        if (named) candidate = named[1].trim();
        if (candidate) return candidate;
    }
    return null;
}

function sgtYear(now: Date): number {
    return new Date(now.getTime() + SGT_OFFSET_MS).getUTCFullYear();
}

function sgtDayStart(now: Date): number {
    const shifted = now.getTime() + SGT_OFFSET_MS;
    return shifted - (shifted % DAY_MS) - SGT_OFFSET_MS;
}

function buildDate(
    day: number,
    month: number,
    yearText: string | undefined,
    hourText: string | undefined,
    minuteText: string | undefined,
    meridiem: string | undefined,
    now: Date,
): Date | null {
    if (month < 0 || month > 11 || day < 1) return null;

    let hour = 0;
    let minute = 0;
    const hasTime = hourText !== undefined && minuteText !== undefined;
    if (hasTime) {
        hour = Number(hourText);
        minute = Number(minuteText);
        if (meridiem) {
            if (hour < 1 || hour > 12) return null;
            hour = (hour % 12) + (meridiem.toLowerCase() === "p" ? 12 : 0);
        }
        if (hour > 23 || minute > 59) return null;
    }

    const make = (year: number) => {
        if (day > new Date(Date.UTC(year, month + 1, 0)).getUTCDate())
            return null;
        // Noon when only a day is given, so it lands on the right SGT date
        const ms =
            Date.UTC(year, month, day, hasTime ? hour : 12, minute) -
            SGT_OFFSET_MS;
        return ms;
    };

    let ms: number | null;
    if (yearText) {
        const year = Number(yearText);
        ms = make(yearText.length === 2 ? 2000 + year : year);
    } else {
        const year = sgtYear(now);
        ms = make(year);
        // "31 Dec" read on 1 Jan is last year's
        if (ms !== null && ms > now.getTime() + DAY_MS) ms = make(year - 1);
    }
    if (ms === null) return null;

    if (!hasTime) {
        // Today's date alone adds nothing over "now"
        const today = sgtDayStart(now);
        if (ms >= today && ms < today + DAY_MS) return null;
    }
    return new Date(ms);
}

function findDate(text: string, now: Date): Date | null {
    const dmy = text.match(DATE_DMY);
    if (dmy) {
        const month = MONTHS.indexOf(dmy[2].slice(0, 3).toLowerCase());
        return buildDate(
            Number(dmy[1]),
            month,
            dmy[3],
            dmy[4],
            dmy[5],
            dmy[6],
            now,
        );
    }
    const slash = text.match(DATE_SLASH);
    if (slash) {
        return buildDate(
            Number(slash[1]),
            Number(slash[2]) - 1,
            slash[3],
            slash[4],
            slash[5],
            slash[6],
            now,
        );
    }
    return null;
}

export function parseBankAlert(
    raw: string,
    now: Date,
    context?: BankAlertContext,
): BankAlert {
    const text = normalizeText(raw);
    const title = context?.title ? normalizeText(context.title) : "";
    const app = context?.app ? normalizeText(context.app) : "";
    const sender = context?.sender ? normalizeText(context.sender) : "";
    const combined = [title, text].filter(Boolean).join(". ");

    if (OTP.test(combined)) return { kind: "ignore", reason: "otp" };
    if (DECLINED.test(combined)) return { kind: "ignore", reason: "declined" };
    if (INCOMING.test(combined)) return { kind: "ignore", reason: "incoming" };
    if (!OUTBOUND.test(combined)) {
        return { kind: "ignore", reason: "not_a_charge" };
    }

    const amountMatch = text.match(AMOUNT) ?? title.match(AMOUNT);
    if (!amountMatch) return { kind: "ignore", reason: "not_a_charge" };
    const rawAmount = amountMatch[0].trim();
    const amount = parseCapturedAmount(rawAmount);
    if (!amount.ok) return { kind: "ignore", reason: "not_a_charge" };

    return {
        kind: "charge",
        amount: amount.amount,
        currency: amount.currency,
        rawAmount,
        merchant: findMerchant(text) ?? findMerchant(title),
        occurredAt: findDate(text, now) ?? findDate(title, now),
        bank:
            detectBank(text) ??
            detectBank(title) ??
            detectBank(app) ??
            detectBank(sender),
    };
}
