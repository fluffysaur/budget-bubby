/**
 * The one type scale for money. Every rendered amount uses one of these,
 * via <CurrencyText size="..."> or (for StatCard values) MONEY_SIZE_CLASSES.lg.
 */
export type MoneySize = "hero" | "lg" | "md" | "sm" | "inline";

export const MONEY_BASE_CLASSES = "font-mono-num tracking-tight whitespace-nowrap";

export const MONEY_SIZE_CLASSES: Record<MoneySize, string> = {
    /** Page hero figure (Left to Spend, Net Worth) */
    hero: "text-3xl sm:text-4xl font-black",
    /** Stat card and summary figures */
    lg: "text-xl sm:text-2xl font-black",
    /** List rows and table cells */
    md: "text-sm sm:text-base font-extrabold",
    /** Secondary amounts: "of S$X", limits, meta lines */
    sm: "text-xs font-bold",
    /** Inside a sentence: inherits the surrounding size */
    inline: "font-bold",
};

const MONEY_SHRINK_TIERS: Record<
    Exclude<MoneySize, "inline">,
    { medium: string; compact: string }
> = {
    hero: {
        medium: "text-2xl sm:text-3xl font-black",
        compact: "text-xl sm:text-2xl font-black",
    },
    lg: {
        medium: "text-lg sm:text-xl font-black",
        compact: "text-base sm:text-lg font-black",
    },
    md: {
        medium: "text-xs sm:text-sm font-extrabold",
        compact: "text-xs font-extrabold",
    },
    sm: {
        medium: "text-[11px] font-bold",
        compact: "text-[10px] font-bold",
    },
};

/**
 * Returns the Tailwind size class for a formatted money string, stepping down
 * when `autoShrink` is enabled and the string is long enough to risk wrapping
 * or overflowing narrow cards.
 */
export function getMoneySizeClass(
    size: MoneySize,
    charLength: number,
    autoShrink = false,
): string {
    if (!autoShrink || size === "inline") {
        return MONEY_SIZE_CLASSES[size];
    }
    if (charLength >= 12) {
        return MONEY_SHRINK_TIERS[size].compact;
    }
    if (charLength >= 10) {
        return MONEY_SHRINK_TIERS[size].medium;
    }
    return MONEY_SIZE_CLASSES[size];
}
