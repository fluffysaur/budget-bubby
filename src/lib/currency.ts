/**
 * Singapore Dollar (SGD) currency formatting and parsing utilities.
 * Ensures consistent financial presentation across the application:
 * - Positive: S$1,234.50
 * - Negative: -S$50.00
 * - Zero: S$0.00
 */

/**
 * Formats a number as Singapore Dollars, always with cents (S$X,XXX.XX).
 * Negative values are formatted with a preceding minus sign: -S$XX.XX.
 */
export function formatSGD(amount: number): string {
    if (isNaN(amount) || !isFinite(amount)) {
        return "S$0.00";
    }

    // Round to cents to avoid -0.00 or floating point artifacts
    const rounded = Math.round(amount * 100) / 100;
    const isNegative = rounded < 0;
    const absAmount = Math.abs(rounded);

    const formattedAbs = absAmount.toLocaleString("en-SG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

    return `${isNegative ? "-" : ""}S$${formattedAbs}`;
}

/**
 * Rounds up to the next cent, e.g. a shortfall of 400.001 becomes 400.01.
 * Values already on a cent (within float noise) are kept as they are.
 */
export function ceilToCent(amount: number): number {
    if (!isFinite(amount)) return 0;
    return Math.ceil(Math.round(amount * 1e6) / 1e4) / 100;
}

/**
 * Compact SGD representation (e.g., S$500k, S$1.2M, S$1B). Only for chart
 * axes and tick labels, where space is fixed; use formatSGD everywhere else.
 *
 * Formatting and rounding rules:
 * - Rounded to at most 1 decimal place using standard half-up rounding.
 * - Whole rounded values omit trailing ".0" (e.g. S$1M, S$2k).
 * - Threshold rollover: Tier selection occurs at the half-up rounding boundary
 *   (>= 999_950 rolls over to "M" so 999_999 formats as "S$1M" rather than "S$1000.0k";
 *   >= 999.5 rolls over to "k"; >= 999_950_000 rolls over to "B").
 * - Convention for near-whole amounts: 1,950 (1.95k) rounds half-up to 2.0k -> "S$2k"
 *   (trailing ".0" omitted). 1,940 (1.94k) rounds half-up to 1.9k -> "S$1.9k".
 * - Negative values format with leading minus sign before S$: -S$1M, -S$2k.
 * - Negative values rounding to 0 format as S$0 (prevents negative zero "-S$0").
 */
export function formatSGDCompact(amount: number): string {
    if (isNaN(amount) || !isFinite(amount)) {
        return "S$0";
    }

    const absAmount = Math.abs(amount);

    let formatted: string;
    if (absAmount >= 999_950_000) {
        const val = Math.round((absAmount / 1_000_000_000) * 10) / 10;
        formatted = `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}B`;
    } else if (absAmount >= 999_950) {
        const val = Math.round((absAmount / 1_000_000) * 10) / 10;
        formatted = `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}M`;
    } else if (absAmount >= 999.5) {
        const val = Math.round((absAmount / 1_000) * 10) / 10;
        formatted = `${val % 1 === 0 ? val.toFixed(0) : val.toFixed(1)}k`;
    } else {
        formatted = Math.round(absAmount).toLocaleString("en-SG");
    }

    const isNegative = amount < 0 && formatted !== "0";
    return `${isNegative ? "-" : ""}S$${formatted}`;
}

/**
 * Parses user input currency string into a valid number.
 * Strips whitespace, currency symbols (S$, $), commas, and handles accounting negative notation (X).
 */
export function parseSGD(value: string): number {
    if (!value || typeof value !== "string") {
        return 0;
    }

    const trimmed = value.trim();
    if (!trimmed) {
        return 0;
    }

    let isNegative = false;
    let clean = trimmed;

    // Accounting parenthetical negative notation: (S$50)
    if (clean.startsWith("(") && clean.endsWith(")")) {
        isNegative = true;
        clean = clean.slice(1, -1).trim();
    }

    if (clean.startsWith("-")) {
        isNegative = true;
        clean = clean.slice(1).trim();
    }

    // Remove S$, $, commas, and whitespace
    clean = clean
        .replace(/^[sS]?\$/i, "")
        .replace(/,/g, "")
        .trim();

    const parsed = parseFloat(clean);
    if (isNaN(parsed) || !isFinite(parsed)) {
        return 0;
    }

    const result = isNegative ? -parsed : parsed;
    return Math.round(result * 100) / 100;
}

/** Matches amounts produced by formatSGD / formatSGDCompact, e.g. -S$1,234.50, S$2k. */
const SGD_AMOUNT_PATTERN = /-?S\$[\d,]+(?:\.\d+)?[kMB]?/g;

/** Replaces every formatted SGD amount in a string with a bullet mask. */
export function maskSGDText(text: string, mask = "••••"): string {
    return text.replace(SGD_AMOUNT_PATTERN, mask);
}
