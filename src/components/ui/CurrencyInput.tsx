/**
 * CurrencyInput: the one money field for the app.
 * Currency prefix, decimal keypad on mobile, mono digits, standard field style.
 * Value stays a string so callers keep control of parsing and empty states.
 */

import { forwardRef } from "react";
import { Input, type InputProps } from "./Input";

export interface CurrencyInputProps extends Omit<
    InputProps,
    "type" | "leftIcon" | "mono" | "inputMode"
> {
    /** Prefix shown inside the field. Defaults to S$. */
    currencySymbol?: string;
}

export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
    (
        {
            currencySymbol = "S$",
            placeholder = "0.00",
            step = "0.01",
            className = "",
            ...props
        },
        ref,
    ) => (
        <Input
            ref={ref}
            type="number"
            inputMode="decimal"
            step={step}
            placeholder={placeholder}
            mono
            leftIcon={
                <span className="font-mono-num text-xs font-bold text-(--text-muted)">
                    {currencySymbol}
                </span>
            }
            className={`text-right sm:text-left ${className}`}
            {...props}
        />
    ),
);

CurrencyInput.displayName = "CurrencyInput";
export default CurrencyInput;
