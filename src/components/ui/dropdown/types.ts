import type { ReactNode } from "react";

/** One selectable row. The component owns the row layout. */
export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
    /** Leading icon, rendered `shrink-0`. Wins over `color` when both are set. */
    icon?: ReactNode;
    /** Any CSS colour (e.g. `"var(--pastel-mint)"`), rendered as a colour dot. */
    color?: string;
    /** Muted second line, matched by search. */
    description?: string;
    /** Trailing badge, rendered `shrink-0` before the check. */
    badge?: ReactNode;
}

/** A non-selectable heading with its options underneath. */
export interface SelectGroup {
    label: string;
    options: SelectOption[];
}

/** Flat and grouped entries may be mixed in one list. */
export type SelectItem = SelectOption | SelectGroup;

export type DropdownVariant = "field" | "pill";
export type DropdownSizeVariant = "sm" | "md";
