import type { ReactNode } from "react";

/**
 * Accounts toolbar controls. Every control is 36px tall, with an invisible
 * extension that makes each tap target 44px.
 */

const WELL =
    "flex h-9 items-center gap-0.5 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-0.5";

export interface SegmentedToggleProps<T extends string> {
    /** Accessible name for the group. */
    label: string;
    value: T;
    onChange: (value: T) => void;
    options: { value: T; label: string; content: ReactNode }[];
}

/** Two or more segments in a cream well; the selected one is a raised chip. */
export function SegmentedToggle<T extends string>({
    label,
    value,
    onChange,
    options,
}: SegmentedToggleProps<T>) {
    return (
        <div role="group" aria-label={label} className={`shrink-0 ${WELL}`}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    onClick={() => onChange(option.value)}
                    aria-label={option.label}
                    aria-pressed={value === option.value}
                    className={`relative inline-flex h-7 min-w-8 cursor-pointer items-center justify-center gap-1 rounded-lg px-2 text-xs font-bold transition-colors after:absolute after:inset-x-0 after:-inset-y-2 after:content-[''] ${
                        value === option.value
                            ? "border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                            : "text-(--text-muted) hover:text-(--text-ink)"
                    }`}
                >
                    {option.content}
                </button>
            ))}
        </div>
    );
}

export interface ToolbarPillProps {
    active?: boolean;
    onClick: () => void;
    children: ReactNode;
}

/** A single toolbar action in the same family as the toggles. */
export function ToolbarPill({
    active = false,
    onClick,
    children,
}: ToolbarPillProps) {
    return (
        <button
            type="button"
            onClick={onClick}
            // Fixed width so "Edit" -> "Done" doesn't move the other controls
            className={`relative inline-flex h-9 w-20 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) px-3 text-xs font-bold text-(--text-ink) transition-colors after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                active
                    ? "bg-(--pastel-butter) hover:bg-(--accent-butter)"
                    : "bg-(--bg-cream) hover:bg-(--bg-card)"
            }`}
        >
            {children}
        </button>
    );
}
