import React from "react";

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
    | "coral";
export type BadgeSize = "sm" | "md";

export interface BadgeProps {
    variant?: BadgeVariant;
    size?: BadgeSize;
    icon?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
    lilac: "bg-(--pastel-lilac-light) text-purple-900 border-2 border-(--border-ink) dark:bg-purple-950/40 dark:text-(--pastel-lilac)",
    butter: "bg-(--pastel-butter-light) text-amber-900 border-2 border-(--border-ink) dark:bg-amber-950/40 dark:text-amber-200",
    blush: "bg-(--pastel-pink-light) text-pink-900 border-2 border-(--border-ink) dark:bg-pink-950/40 dark:text-pink-200",
    mint: "bg-(--pastel-mint-light) text-emerald-900 border-2 border-(--border-ink) dark:bg-emerald-950/40 dark:text-(--pastel-mint)",
    coral: "bg-(--pastel-coral-light) text-rose-900 border-2 border-(--border-ink) dark:bg-rose-950/40 dark:text-rose-200",

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

export function Badge({
    variant = "emerald",
    size = "md",
    icon,
    children,
    className = "",
}: BadgeProps) {
    return (
        <span
            className={`inline-flex items-center font-bold rounded-full ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        >
            {icon && <span className="shrink-0">{icon}</span>}
            <span>{children}</span>
        </span>
    );
}

export default Badge;
