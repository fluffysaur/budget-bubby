import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    labelClassName?: string;
    error?: string;
    options?: SelectOption[];
    sizeVariant?: "sm" | "md";
    containerClassName?: string;
    iconClassName?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    (
        {
            label,
            labelClassName = "",
            error,
            options,
            children,
            className = "",
            containerClassName = "",
            iconClassName = "",
            id,
            disabled,
            sizeVariant = "md",
            ...props
        },
        ref,
    ) => {
        const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

        const sizeClasses =
            sizeVariant === "sm"
                ? "px-3 py-2 text-xs pr-9"
                : "px-3.5 py-2.5 text-sm pr-10";

        return (
            <div className={`w-full min-w-0 ${label ? "space-y-1.5" : ""} ${containerClassName}`}>
                {label && (
                    <label
                        htmlFor={selectId}
                        className={`block text-xs font-bold uppercase tracking-wider text-(--text-muted) ${labelClassName}`}
                    >
                        {label}
                    </label>
                )}
                <div className="relative flex items-center w-full min-w-0">
                    <select
                        ref={ref}
                        id={selectId}
                        disabled={disabled}
                        className={`w-full min-w-0 appearance-none rounded-xl border-2 bg-(--bg-card) font-semibold text-(--text-ink) transition-all outline-none focus:ring-2 focus:ring-(--pastel-lilac) disabled:opacity-50 disabled:bg-(--bg-cream) cursor-pointer truncate ${sizeClasses} ${
                            error
                                ? "border-(--accent-coral) focus:border-(--accent-coral)"
                                : "border-(--border-ink) focus:border-(--border-ink)"
                        } ${className}`}
                        {...props}
                    >
                        {options
                            ? options.map((opt) => (
                                  <option
                                      key={opt.value}
                                      value={opt.value}
                                      disabled={opt.disabled}
                                  >
                                      {opt.label}
                                  </option>
                              ))
                            : children}
                    </select>
                    <ChevronDown
                        className={`pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-(--text-muted) shrink-0 ${iconClassName}`}
                        strokeWidth={2.5}
                    />
                </div>
                {error && <p className="text-xs font-bold text-(--accent-coral) animate-in fade-in">{error}</p>}
            </div>
        );
    },
);

Select.displayName = "Select";
export default Select;
