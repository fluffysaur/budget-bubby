import React from "react";
import { Check, AlertTriangle, AlertCircle, Clock } from "lucide-react";

export type BadgeVariant =
    | "emerald"
    | "blue"
    | "rose"
    | "amber"
    | "slate"
    | "lilac"
    | "butter"
    | "blush"
    | "mint"
    | "coral"
    | "ok"
    | "near"
    | "over"
    | "due"
    | "paid";

export type BadgeSize = "sm" | "md";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
    variant?: BadgeVariant;
    size?: BadgeSize;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
    "data-testid"?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    lilac: "bg-(--pastel-lilac-light) text-purple-900 border-2 border-(--border-ink) dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    butter: "bg-(--pastel-butter-light) text-amber-900 border-2 border-(--border-ink) dark:bg-amber-950/40 dark:text-amber-200",
    blush: "bg-(--pastel-pink-light) text-pink-900 border-2 border-(--border-ink) dark:bg-pink-950/40 dark:text-pink-200",
    mint: "bg-(--pastel-mint-light) text-emerald-900 border-2 border-(--border-ink) dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    coral: "bg-(--pastel-coral-light) text-rose-900 border-2 border-(--border-ink) dark:bg-rose-950/40 dark:text-rose-200",

    // Status variants (PR #9 visual meters)
    ok: "bg-(--tone-ok-bg) text-(--tone-ok-text) border-2 border-(--border-ink) dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    near: "bg-(--tone-near-bg) text-(--tone-near-text) border-2 border-(--border-ink) dark:bg-amber-950/40 dark:text-amber-200",
    over: "bg-(--tone-over-bg) text-(--tone-over-text) border-2 border-(--border-ink) dark:bg-rose-950/40 dark:text-rose-200",
    due: "bg-(--pastel-lilac-light) text-purple-900 border-2 border-(--border-ink) dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    paid: "bg-(--tone-ok-bg) text-(--tone-ok-text) border-2 border-(--border-ink) dark:bg-emerald-950/40 dark:text-(--pastel-mint)",

    // Backward compatibility mappings with high contrast
    emerald:
        "bg-(--pastel-mint-light) text-emerald-900 border-2 border-(--border-ink) dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    blue: "bg-blue-50 text-blue-900 border-2 border-(--border-ink) dark:bg-blue-950/40 dark:text-blue-200",
    rose: "bg-(--pastel-coral-light) text-rose-900 border-2 border-(--border-ink) dark:bg-rose-950/40 dark:text-rose-200",
    amber: "bg-(--pastel-butter-light) text-amber-900 border-2 border-(--border-ink) dark:bg-amber-950/40 dark:text-amber-200",
    slate: "bg-(--bg-cream) text-(--text-ink) border-2 border-(--border-ink) dark:bg-(--bg-elevated) dark:text-(--text-ink)",
};

const sizeStyles: Record<BadgeSize, string> = {
    sm: "px-2 py-0.5 text-[11px] gap-1",
    md: "px-3 py-1 text-xs gap-1.5",
};

const iconSizes: Record<BadgeSize, string> = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
};

export function Badge({
    variant = "emerald",
    size = "md",
    icon,
    children,
    className = "",
    ...rest
}: BadgeProps) {
    let resolvedIcon = icon;
    if (resolvedIcon === undefined) {
        const iconClass = `${iconSizes[size]} shrink-0`;
        switch (variant) {
            case "ok":
                resolvedIcon = (
                    <Check className={iconClass} strokeWidth={2.5} />
                );
                break;
            case "near":
                resolvedIcon = (
                    <AlertTriangle className={iconClass} strokeWidth={2.5} />
                );
                break;
            case "over":
                resolvedIcon = (
                    <AlertCircle className={iconClass} strokeWidth={2.5} />
                );
                break;
            case "due":
                resolvedIcon = (
                    <Clock className={iconClass} strokeWidth={2.5} />
                );
                break;
            case "paid":
                resolvedIcon = (
                    <Check className={iconClass} strokeWidth={2.5} />
                );
                break;
            default:
                break;
        }
    }

    return (
        <span
            className={`inline-flex items-center font-bold rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
            {...rest}
        >
            {resolvedIcon && (
                <span className="shrink-0">{resolvedIcon}</span>
            )}
            <span>{children}</span>
        </span>
    );
}

export default Badge;
