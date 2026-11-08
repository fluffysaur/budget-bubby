import React from "react";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import type { SpendTone } from "../../lib/spendTone";

export interface DeltaBadgeProps {
    value: number; // numeric percentage delta, e.g. -8, 12
    goodWhen?: "down" | "up";
    size?: "sm" | "md";
    showSign?: boolean;
    label?: React.ReactNode;
    children?: React.ReactNode;
    className?: string;
}

const SIZE_STYLES = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-2.5 py-1 text-xs gap-1.5",
} as const;

const ICON_SIZE = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
} as const;

export const DeltaBadge: React.FC<DeltaBadgeProps> = ({
    value,
    goodWhen = "down",
    size = "sm",
    showSign = false,
    label,
    children,
    className = "",
}) => {
    const isZero = Math.abs(value) < 0.001;
    const isDown = value < -0.001;
    const isUp = value > 0.001;

    let tone: SpendTone | "neutral" = "neutral";
    if (!isZero) {
        if (goodWhen === "down") {
            tone = isDown ? "ok" : "over";
        } else {
            tone = isUp ? "ok" : "over";
        }
    }

    const toneClasses = {
        ok: "bg-(--tone-ok-bg) text-(--tone-ok-text) border border-(--border-ink) dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
        over: "bg-(--tone-over-bg) text-(--tone-over-text) border border-(--border-ink) dark:bg-rose-950/40 dark:text-rose-200",
        neutral:
            "bg-(--bg-cream) text-(--text-muted) border border-(--border-ink) dark:bg-(--bg-elevated) dark:text-(--text-muted)",
    }[tone];

    const absValue = Math.abs(value);
    const formattedNum =
        absValue % 1 === 0 ? absValue.toString() : absValue.toFixed(1);
    const signPrefix = showSign ? (isUp ? "+" : isDown ? "-" : "") : "";
    const formattedText = `${signPrefix}${formattedNum}%`;

    const icon = isZero ? (
        <Minus className={`${ICON_SIZE[size]} shrink-0`} strokeWidth={2.5} />
    ) : isDown ? (
        <ArrowDown
            className={`${ICON_SIZE[size]} shrink-0`}
            strokeWidth={2.5}
        />
    ) : (
        <ArrowUp className={`${ICON_SIZE[size]} shrink-0`} strokeWidth={2.5} />
    );

    const suffix = label ?? children;

    return (
        <span
            className={`inline-flex items-center font-bold rounded-full shadow-cute-sm ${SIZE_STYLES[size]} ${toneClasses} ${className}`}
        >
            {icon}
            <span className="font-mono-num">{formattedText}</span>
            {suffix && <span className="ml-0.5">{suffix}</span>}
        </span>
    );
};

export default DeltaBadge;
