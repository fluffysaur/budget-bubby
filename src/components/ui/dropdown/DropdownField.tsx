import { forwardRef, type ReactNode } from "react";
import { useMergeRefs } from "@floating-ui/react";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, m } from "motion/react";
import { collapse } from "../../../lib/motion";
import type { DropdownState } from "./useDropdown";
import type { DropdownSizeVariant, DropdownVariant } from "./types";

export interface DropdownFieldProps {
    dropdown: DropdownState;
    /** Trigger content: the selected value, or a muted placeholder. */
    children: ReactNode;
    variant?: DropdownVariant;
    sizeVariant?: DropdownSizeVariant;
    labelClassName?: string;
    error?: string;
    /** Applied to the trigger button. */
    className?: string;
    containerClassName?: string;
    iconClassName?: string;
    /** Renders a hidden input so the value is present in FormData. */
    name?: string;
    hiddenValue?: string;
    "data-testid"?: string;
}

const FIELD_SIZE = {
    sm: "px-3 py-2 text-base sm:text-xs pr-9",
    md: "px-3.5 py-2.5 text-base sm:text-sm pr-10",
} as const;

/**
 * Label + trigger button + inline error. `field` matches the old native
 * select; `pill` is the compact rounded-full trigger used for inline pickers.
 */
export const DropdownField = forwardRef<HTMLButtonElement, DropdownFieldProps>(
    (
        {
            dropdown,
            children,
            variant = "field",
            sizeVariant = "md",
            labelClassName = "",
            error,
            className = "",
            containerClassName = "",
            iconClassName = "",
            name,
            hiddenValue,
            "data-testid": dataTestId,
        },
        forwardedRef,
    ) => {
        const { label, ids, open, disabled, floating } = dropdown;
        const ref = useMergeRefs([floating.refs.setReference, forwardedRef]);
        const isPill = variant === "pill";

        const triggerClass = isPill
            ? `relative inline-flex w-fit max-w-full min-w-0 items-center gap-1.5 rounded-full border border-(--border-subtle) bg-(--bg-canvas) py-1 pl-3 pr-8 text-left text-base font-bold text-(--text-ink) transition-colors hover:border-(--border-ink) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) disabled:cursor-not-allowed disabled:opacity-50 sm:text-xs`
            : `relative flex w-full min-w-0 items-center gap-2 rounded-xl border-2 bg-(--bg-card) text-left font-semibold text-(--text-ink) transition-colors outline-none focus:ring-2 focus:ring-(--pastel-lilac) disabled:cursor-not-allowed disabled:bg-(--bg-cream) disabled:opacity-50 ${FIELD_SIZE[sizeVariant]} ${
                  error
                      ? "border-(--accent-coral) focus:border-(--accent-coral)"
                      : "border-(--border-ink) focus:border-(--border-ink)"
              }`;

        return (
            <div
                className={`${isPill ? "max-w-full" : "w-full"} min-w-0 ${
                    label && !isPill ? "space-y-1.5" : ""
                } ${containerClassName}`}
            >
                {label && (
                    <label
                        id={ids.labelId}
                        htmlFor={ids.triggerId}
                        className={
                            isPill
                                ? "sr-only"
                                : `block text-xs font-bold uppercase tracking-wider text-(--text-muted) ${labelClassName}`
                        }
                    >
                        {label}
                    </label>
                )}
                <button
                    ref={ref}
                    type="button"
                    disabled={disabled}
                    data-testid={dataTestId}
                    data-state={open ? "open" : "closed"}
                    {...dropdown.getTriggerProps()}
                    className={`${triggerClass} cursor-pointer ${className}`}
                >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                        {children}
                    </span>
                    <ChevronDown
                        className={`pointer-events-none absolute top-1/2 shrink-0 -translate-y-1/2 text-(--text-muted) transition-transform ${
                            isPill
                                ? "right-2.5 h-3.5 w-3.5"
                                : "right-3.5 h-4 w-4"
                        } ${open ? "rotate-180" : ""} ${iconClassName}`}
                        strokeWidth={2.5}
                        aria-hidden="true"
                    />
                </button>
                {name && (
                    <input
                        type="hidden"
                        name={name}
                        value={hiddenValue ?? ""}
                    />
                )}
                <AnimatePresence initial={false}>
                    {error && (
                        <m.div key="dropdown-error" {...collapse}>
                            <p className="text-xs font-bold text-(--accent-coral)">
                                {error}
                            </p>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        );
    },
);

DropdownField.displayName = "DropdownField";
