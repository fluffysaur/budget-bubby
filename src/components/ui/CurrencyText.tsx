import React from "react";
import { formatSGD } from "../../lib/currency";
import { usePrivacy, PRIVACY_MASK } from "../../context/PrivacyContext";
import { useTweenedNumber } from "../../hooks/useTweenedNumber";
import {
    MONEY_BASE_CLASSES,
    getMoneySizeClass,
    type MoneySize,
} from "../../lib/moneyStyles";

export type CurrencySize = MoneySize;
export type CurrencyTone =
    "inherit" | "default" | "positive" | "negative" | "muted";

export interface CurrencyTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    amount?: number;
    /** Pre-formatted value, e.g. formatSGD(x) */
    formatted?: string;
    size?: CurrencySize;
    /** Defaults to inheriting the surrounding text colour. */
    tone?: CurrencyTone;
    /** Whether to smoothly count up or down when amount changes. */
    animate?: boolean;
    /** Step down font size for long formatted amounts. Defaults to true for sized variants, false for inline. */
    autoShrink?: boolean;
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
    animate = false,
    autoShrink,
    className = "",
    ...props
}: CurrencyTextProps) {
    const { isPrivacyMode } = usePrivacy();
    const tweenedAmount = useTweenedNumber(amount ?? 0, {
        disabled: !animate || formatted !== undefined || isPrivacyMode,
    });
    const finalAmount =
        animate && formatted === undefined ? tweenedAmount : amount;
    const displayValue = isPrivacyMode
        ? PRIVACY_MASK
        : (formatted ?? formatSGD(finalAmount ?? 0));
    const shouldShrink = autoShrink ?? size !== "inline";
    const classes = [
        MONEY_BASE_CLASSES,
        getMoneySizeClass(size, displayValue.length, shouldShrink),
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
