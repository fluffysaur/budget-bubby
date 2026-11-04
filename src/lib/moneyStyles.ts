/**
 * The one type scale for money. Every rendered amount uses one of these,
 * via <CurrencyText size="..."> or (for StatCard values) MONEY_SIZE_CLASSES.lg.
 */
export type MoneySize = "hero" | "lg" | "md" | "sm" | "inline";

export const MONEY_BASE_CLASSES = "font-mono-num tracking-tight";

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
