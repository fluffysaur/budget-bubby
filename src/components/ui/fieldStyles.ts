/**
 * Shared form-field styling. Input, Select, Textarea and CurrencyInput all
 * build their classes from here so every field in the app looks the same:
 * 2px ink border, canvas fill at rest, card fill on focus, lilac focus ring.
 *
 * Mobile text stays at 16px (`text-base`) in every size so iOS Safari does
 * not zoom on focus; only padding and desktop text size shrink for `sm`.
 */

export type FieldSize = "sm" | "md";

export const FIELD_LABEL_CLASS =
    "block text-xs font-bold uppercase tracking-wider text-(--text-muted)";

export const FIELD_ERROR_TEXT_CLASS = "text-xs font-bold text-(--accent-coral)";

const FIELD_BASE_CLASS =
    "w-full min-w-0 rounded-xl border-2 bg-(--bg-canvas) font-semibold text-(--text-ink) placeholder:text-(--text-faint) transition-colors outline-none focus:bg-(--bg-card) focus:ring-2 focus:ring-(--pastel-lilac) disabled:opacity-50 disabled:bg-(--bg-cream) disabled:cursor-not-allowed";

const FIELD_SIZE_CLASS: Record<FieldSize, string> = {
    md: "px-3.5 py-2.5 text-base sm:text-sm",
    sm: "px-3 py-2 text-base sm:text-xs",
};

/** Left padding when a leading icon/prefix is shown, per size. */
export const FIELD_LEFT_SLOT_PADDING: Record<FieldSize, string> = {
    md: "pl-10",
    sm: "pl-9",
};

export function fieldClass(size: FieldSize = "md", error = false): string {
    const border = error
        ? "border-(--accent-coral) focus:border-(--accent-coral)"
        : "border-(--border-ink) focus:border-(--border-ink)";
    return `${FIELD_BASE_CLASS} ${FIELD_SIZE_CLASS[size]} ${border}`;
}

/** Stable id from a label when the caller does not pass one. */
export function fieldIdFromLabel(label?: string): string | undefined {
    return label ? label.toLowerCase().replace(/\s+/g, "-") : undefined;
}
