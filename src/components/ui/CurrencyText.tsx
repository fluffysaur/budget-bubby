import React from "react";
import { formatSGD } from "../../lib/currency";

export type CurrencySize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
export type CurrencyTone = "default" | "positive" | "negative" | "muted" | "coral" | "mint";

export interface CurrencyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    amount?: number;
    formatted?: string;
    size?: CurrencySize;
    tone?: CurrencyTone;
    bold?: boolean;
}

const sizeMap: Record<CurrencySize, string> = {
    xs: "text-xs",
    sm: "text-sm",
    base: "text-base",
    lg: "text-lg sm:text-xl",
    xl: "text-xl sm:text-2xl",
    "2xl": "text-2xl sm:text-3xl",
    "3xl": "text-3xl sm:text-4xl",
};

const toneMap: Record<CurrencyTone, string> = {
    default: "text-(--text-ink)",
    positive: "text-emerald-700 dark:text-emerald-400",
    negative: "text-(--accent-coral-ink) dark:text-rose-400",
    muted: "text-(--text-muted)",
    coral: "text-(--accent-coral-ink) dark:text-rose-400",
    mint: "text-emerald-700 dark:text-emerald-400",
};

export function CurrencyText({
    amount,
    formatted,
    size = "base",
    tone = "default",
    bold = true,
    className = "",
    ...props
}: CurrencyTextProps) {
    const displayValue = formatted !== undefined ? formatted : amount !== undefined ? formatSGD(amount) : "$0.00";

    return (
        <span
            className={`font-mono-num tracking-tight ${bold ? "font-extrabold" : "font-semibold"} ${sizeMap[size]} ${toneMap[tone]} ${className}`}
            {...props}
        >
            {displayValue}
        </span>
    );
}

export default CurrencyText;
