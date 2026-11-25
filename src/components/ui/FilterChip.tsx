/**
 * FilterChip: toggleable pill for filter rows (account types, tags, etc.).
 * Selected = lilac fill + ink border + cute shadow; idle = canvas + subtle border.
 */

import React from "react";

export interface FilterChipProps extends Omit<
    React.ButtonHTMLAttributes<HTMLButtonElement>,
    "type"
> {
    selected: boolean;
    icon?: React.ReactNode;
    /** `sm` for dense toolbars, `md` (default) for standalone rows. */
    sizeVariant?: "sm" | "md";
}

const SIZE_CLASS = {
    sm: "min-h-8 px-2.5 py-1 text-[11px] gap-1",
    md: "min-h-9 px-3 py-1.5 text-xs gap-1.5",
} as const;

export function FilterChip({
    selected,
    icon,
    sizeVariant = "md",
    className = "",
    children,
    ...props
}: FilterChipProps) {
    return (
        <button
            type="button"
            aria-pressed={selected}
            className={`inline-flex shrink-0 items-center justify-center rounded-xl border-2 transition-press cursor-pointer active:translate-x-0.5 active:translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-(--pastel-lilac) disabled:cursor-not-allowed disabled:opacity-50 ${SIZE_CLASS[sizeVariant]} ${
                selected
                    ? "bg-(--pastel-lilac) text-(--text-ink) border-(--border-ink) shadow-cute-sm font-bold"
                    : "bg-(--bg-canvas) text-(--text-muted) border-(--border-subtle) hover:border-(--border-ink) hover:text-(--text-ink) font-semibold"
            } ${className}`}
            {...props}
        >
            {icon}
            {children}
        </button>
    );
}

export default FilterChip;
