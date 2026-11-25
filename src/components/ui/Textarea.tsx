import React, { forwardRef } from "react";
import { m, AnimatePresence } from "motion/react";
import { collapse } from "../../lib/motion";
import {
    FIELD_ERROR_TEXT_CLASS,
    FIELD_LABEL_CLASS,
    fieldClass,
    fieldIdFromLabel,
    type FieldSize,
} from "./fieldStyles";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: React.ReactNode;
    labelClassName?: string;
    containerClassName?: string;
    error?: string;
    sizeVariant?: FieldSize;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    (
        {
            label,
            labelClassName = "",
            containerClassName = "",
            error,
            sizeVariant = "md",
            className = "",
            id,
            disabled,
            ...props
        },
        ref,
    ) => {
        const textareaId =
            id ||
            (typeof label === "string" ? fieldIdFromLabel(label) : undefined);

        return (
            <div
                className={`w-full min-w-0 ${label ? "space-y-1.5" : ""} ${containerClassName}`}
            >
                {label && (
                    <label
                        htmlFor={textareaId}
                        className={`${FIELD_LABEL_CLASS} ${labelClassName}`}
                    >
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={textareaId}
                    disabled={disabled}
                    aria-invalid={error ? true : undefined}
                    className={`resize-none ${fieldClass(sizeVariant, Boolean(error))} ${className}`}
                    {...props}
                />
                <AnimatePresence initial={false}>
                    {error && (
                        <m.div key="textarea-error" {...collapse}>
                            <p className={FIELD_ERROR_TEXT_CLASS}>{error}</p>
                        </m.div>
                    )}
                </AnimatePresence>
            </div>
        );
    },
);

Textarea.displayName = "Textarea";
export default Textarea;
