/**
 * Merchant text helpers for captured purchases. Pure: shared by the
 * capture-expense Edge Function and the app.
 */

export const MAX_MERCHANT_LENGTH = 120;

// Payment processor prefixes dropped entirely ("SQ *Cafe" -> "cafe")
const PROCESSOR_PREFIX = /^(sq|paypal|sumup|zettle|izettle|stripe|tst|sp)\s*\*\s*/;
// Location noise at the end of card descriptors
const LOCATION_SUFFIXES = new Set(["singapore", "sg", "sgp", "sin"]);

/** Strips control characters and collapses whitespace. */
function stripControl(raw: string): string {
    return (
        raw
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u001f\u007f-\u009f]/g, " ")
            .replace(/\s+/g, " ")
            .trim()
    );
}

/**
 * Display name: control characters stripped, whitespace collapsed, capped at
 * 120 chars, and title-cased when it arrives in all caps. Returns null when
 * nothing is left.
 */
export function cleanMerchant(raw: unknown): string | null {
    if (typeof raw !== "string") return null;
    const cleaned = stripControl(raw).slice(0, MAX_MERCHANT_LENGTH).trim();
    if (!cleaned) return null;
    const hasLetters = /\p{L}/u.test(cleaned);
    const isAllCaps = hasLetters && cleaned === cleaned.toUpperCase();
    if (!isAllCaps) return cleaned;
    return cleaned
        .toLowerCase()
        .replace(/(^|[\s*/&(-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

/**
 * Stable lookup key for merchant rules and history matching.
 * "GRAB*FOOD 8812" -> "grab food", "NTUC FAIRPRICE-TAMPINES SG" ->
 * "ntuc fairprice tampines". Idempotent.
 */
export function normalizeMerchant(raw: string): string {
    const lower = stripControl(raw).toLowerCase();
    const tokens = lower
        .replace(PROCESSOR_PREFIX, "")
        .replace(/[^\p{L}\p{N}&]+/gu, " ")
        .trim()
        .split(" ")
        .filter(Boolean);

    // Drop trailing reference numbers and location suffixes
    while (tokens.length > 1) {
        const last = tokens[tokens.length - 1];
        if (/^\d+$/.test(last) || LOCATION_SUFFIXES.has(last)) {
            tokens.pop();
        } else {
            break;
        }
    }

    const key = tokens.join(" ").slice(0, MAX_MERCHANT_LENGTH).trim();
    return key || lower.slice(0, MAX_MERCHANT_LENGTH) || "unknown";
}
