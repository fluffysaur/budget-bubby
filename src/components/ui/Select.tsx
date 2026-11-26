import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import { collapse } from "../../lib/motion";
import {
    FIELD_ERROR_TEXT_CLASS,
    FIELD_LABEL_CLASS,
    fieldClass,
    fieldContainerClass,
    fieldIdFromLabel,
    type FieldSize,
} from "./fieldStyles";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: React.ReactNode;
    labelClassName?: string;
    error?: string;
    options?: SelectOption[];
    sizeVariant?: FieldSize;
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
        const selectId =
            id ||
            (typeof label === "string" ? fieldIdFromLabel(label) : undefined);

        const chevronPadding = sizeVariant === "sm" ? "pr-9" : "pr-10";

        return (
            <div
                className={fieldContainerClass(
                    containerClassName,
                    Boolean(label),
                )}
            >
                {label && (
                    <label
                        htmlFor={selectId}
                        className={`${FIELD_LABEL_CLASS} ${labelClassName}`}
                    >
                        {label}
                    </label>
                )}
                <div className="relative flex items-center w-full min-w-0">
                    <select
                        ref={ref}
                        id={selectId}
                        disabled={disabled}
                        aria-invalid={error ? true : undefined}
                        className={`appearance-none cursor-pointer truncate ${fieldClass(
                            sizeVariant,
                            Boolean(error),
                        )} ${chevronPadding} ${className}`}
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
                <AnimatePresence initial={false}>
                    {error && (
                        <m.div key="select-error" {...collapse}>
                            <p className={FIELD_ERROR_TEXT_CLASS}>{error}</p>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        );
    },
);

Select.displayName = "Select";
export default Select;
