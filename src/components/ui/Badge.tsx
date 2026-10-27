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
    lilac:
        "bg-[#f3e8ff] text-[#4a1d96] border-[1.5px] border-[#222222]/30 dark:bg-[#341a4d] dark:text-[#dfc2ff] dark:border-[#dfc2ff]/40",
    butter:
        "bg-[#fffbeb] text-[#78350f] border-[1.5px] border-[#222222]/30 dark:bg-[#3a280c] dark:text-[#fde68a] dark:border-[#fde68a]/40",
    blush:
        "bg-[#fdf2f8] text-[#831843] border-[1.5px] border-[#222222]/30 dark:bg-[#43122b] dark:text-[#fbcfe8] dark:border-[#fbcfe8]/40",
    mint:
        "bg-[#f0fdf4] text-[#14532d] border-[1.5px] border-[#222222]/30 dark:bg-[#13351d] dark:text-[#86efac] dark:border-[#86efac]/40",
    coral:
        "bg-[#fff1f2] text-[#881337] border-[1.5px] border-[#222222]/30 dark:bg-[#401217] dark:text-[#fecdd3] dark:border-[#fecdd3]/40",

    // Backward compatibility mappings with high contrast
    emerald:
        "bg-[#f0fdf4] text-[#14532d] border-[1.5px] border-[#222222]/30 dark:bg-[#13351d] dark:text-[#86efac] dark:border-[#86efac]/40",
    blue:
        "bg-[#eff6ff] text-[#1e3a8a] border-[1.5px] border-[#222222]/30 dark:bg-[#172554] dark:text-[#93c5fd] dark:border-[#93c5fd]/40",
    rose:
        "bg-[#fff1f2] text-[#881337] border-[1.5px] border-[#222222]/30 dark:bg-[#401217] dark:text-[#fecdd3] dark:border-[#fecdd3]/40",
    amber:
        "bg-[#fffbeb] text-[#78350f] border-[1.5px] border-[#222222]/30 dark:bg-[#3a280c] dark:text-[#fde68a] dark:border-[#fde68a]/40",
    slate:
        "bg-(--bg-cream) text-(--text-ink) border-[1.5px] border-(--border-ink) dark:bg-(--bg-elevated) dark:text-(--text-ink)",
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
