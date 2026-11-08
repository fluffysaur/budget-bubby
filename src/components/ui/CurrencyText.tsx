import React from "react";
import { formatSGD } from "../../lib/currency";
import {
    MONEY_BASE_CLASSES,
    MONEY_SIZE_CLASSES,
    type MoneySize,
} from "../../lib/moneyStyles";

export type CurrencySize = MoneySize;
export type CurrencyTone =
    "inherit" | "default" | "positive" | "negative" | "muted";

export interface CurrencyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    amount?: number;
    /** Pre-formatted value, e.g. formatSGD(x, { showCents: false }) */
    formatted?: string;
    size?: CurrencySize;
    /** Defaults to inheriting the surrounding text colour. */
    tone?: CurrencyTone;
}

const toneMap: Record<CurrencyTone, string> = {
    inherit: "",
    default: "text-(--text-ink)",
    positive: "text-emerald-700 dark:text-emerald-400",
    negative: "text-(--accent-coral-ink) dark:text-rose-400",
    muted: "text-(--text-muted)",
};

/** Renders an SGD amount in the app's single money type scale. */
export function CurrencyText({
    amount,
    formatted,
    size = "inline",
    tone = "inherit",
    className = "",
    ...props
}: CurrencyTextProps) {
    const displayValue = formatted ?? formatSGD(amount ?? 0);
    const classes = [
        MONEY_BASE_CLASSES,
        MONEY_SIZE_CLASSES[size],
        toneMap[tone],
        className,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <span className={classes} {...props}>
            {displayValue}
        </span>
    );
}

export default CurrencyText;
