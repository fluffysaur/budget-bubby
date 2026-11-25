import React, { forwardRef } from "react";
import { m, AnimatePresence } from "motion/react";
import { collapse } from "../../lib/motion";
import {
    FIELD_ERROR_TEXT_CLASS,
    FIELD_LABEL_CLASS,
    FIELD_LEFT_SLOT_PADDING,
    fieldClass,
    fieldContainerClass,
    fieldIdFromLabel,
    type FieldSize,
} from "./fieldStyles";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: React.ReactNode;
    labelClassName?: string;
    containerClassName?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightElement?: React.ReactNode;
    mono?: boolean;
    /** `md` for forms (default), `sm` for dense rows. Mobile text stays 16px. */
    sizeVariant?: FieldSize;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    (
        {
            label,
            labelClassName = "",
            containerClassName = "",
            error,
            leftIcon,
            rightElement,
            mono = false,
            sizeVariant = "md",
            className = "",
            id,
            disabled,
            ...props
        },
        ref,
    ) => {
        const inputId =
            id ||
            (typeof label === "string" ? fieldIdFromLabel(label) : undefined);

        return (
            <div
                className={fieldContainerClass(
                    containerClassName,
                    Boolean(label),
                )}
            >
                {label && (
                    <label
                        htmlFor={inputId}
                        className={`${FIELD_LABEL_CLASS} ${labelClassName}`}
                    >
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    {leftIcon && (
                        <div className="pointer-events-none absolute left-3 flex items-center text-(--text-muted)">
                            {leftIcon}
                        </div>
                    )}
                    <input
                        ref={ref}
                        id={inputId}
                        disabled={disabled}
                        aria-invalid={error ? true : undefined}
                        className={`${fieldClass(sizeVariant, Boolean(error))} ${
                            leftIcon ? FIELD_LEFT_SLOT_PADDING[sizeVariant] : ""
                        } ${rightElement ? "pr-11" : ""} ${
                            mono ? "font-mono-num font-bold" : ""
                        } ${className}`}
                        {...props}
                    />
                    {rightElement && (
                        <div className="absolute right-3 flex items-center">
                            {rightElement}
                        </div>
                    )}
                </div>
                <AnimatePresence initial={false}>
                    {error && (
                        <m.div key="input-error" {...collapse}>
                            <p className={FIELD_ERROR_TEXT_CLASS}>{error}</p>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        );
    },
);

Input.displayName = "Input";
export default Input;
