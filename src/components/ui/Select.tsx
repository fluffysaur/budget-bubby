import React, { forwardRef } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label?: string;
    error?: string;
    options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
    ({ label, error, options, children, className = "", id, disabled, ...props }, ref) => {
        const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label
                        htmlFor={selectId}
                        className="block text-xs font-bold uppercase tracking-wider text-(--text-muted)"
                    >
                        {label}
                    </label>
                )}
                <div className="relative flex items-center">
                    <select
                        ref={ref}
                        id={selectId}
                        disabled={disabled}
                        className={`w-full appearance-none rounded-xl border-[1.5px] bg-(--bg-card) px-3.5 py-2.5 pr-10 text-sm font-semibold text-(--text-ink) transition-all outline-none focus:ring-2 focus:ring-[#dfc2ff] disabled:opacity-50 disabled:bg-(--bg-cream) cursor-pointer ${
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
                    <div className="pointer-events-none absolute right-3 flex items-center text-(--text-muted)">
                        <ChevronDown className="h-4 w-4 stroke-[2.5]" />
                    </div>
                </div>
                {error && <p className="text-xs font-bold text-(--accent-coral) animate-in fade-in">{error}</p>}
            </div>
        );
    },
);

Select.displayName = "Select";
export default Select;
