import React, { forwardRef } from "react";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    label?: string;
    error?: string;
    leftIcon?: React.ReactNode;
    rightElement?: React.ReactNode;
    mono?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
    ({ label, error, leftIcon, rightElement, mono = false, className = "", id, disabled, ...props }, ref) => {
        const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label
                        htmlFor={inputId}
                        className="block text-xs font-bold uppercase tracking-wider text-(--text-muted)"
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
                        className={`w-full rounded-xl border-[1.5px] bg-(--bg-card) px-3.5 py-2.5 text-sm font-semibold text-(--text-ink) placeholder:text-(--text-faint) transition-all outline-none focus:ring-2 focus:ring-[#dfc2ff] disabled:opacity-50 disabled:bg-(--bg-cream) ${
                            error
                                ? "border-(--accent-coral) focus:border-(--accent-coral)"
                                : "border-(--border-ink) focus:border-(--border-ink)"
                        } ${leftIcon ? "pl-10" : ""} ${rightElement ? "pr-11" : ""} ${
                            mono ? "font-mono-num font-bold" : ""
                        } ${className}`}
                        {...props}
                    />
                    {rightElement && <div className="absolute right-3 flex items-center">{rightElement}</div>}
                </div>
                {error && <p className="text-xs font-bold text-(--accent-coral) animate-in fade-in">{error}</p>}
            </div>
        );
    },
);

Input.displayName = "Input";
export default Input;
