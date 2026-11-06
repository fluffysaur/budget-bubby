import React, { forwardRef } from "react";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
    label?: string;
    error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
    ({ label, error, className = "", id, disabled, ...props }, ref) => {
        const textareaId =
            id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);

        return (
            <div className="w-full space-y-1.5">
                {label && (
                    <label
                        htmlFor={textareaId}
                        className="block text-xs font-bold uppercase tracking-wider text-(--text-muted)"
                    >
                        {label}
                    </label>
                )}
                <textarea
                    ref={ref}
                    id={textareaId}
                    disabled={disabled}
                    className={`w-full resize-none rounded-xl border-2 bg-(--bg-card) px-3.5 py-2.5 text-base sm:text-sm font-semibold text-(--text-ink) placeholder:text-(--text-faint) transition-all outline-none focus:ring-2 focus:ring-(--pastel-lilac) disabled:opacity-50 disabled:bg-(--bg-cream) ${
                        error
                            ? "border-(--accent-coral) focus:border-(--accent-coral)"
                            : "border-(--border-ink) focus:border-(--border-ink)"
                    } ${className}`}
                    {...props}
                />
                {error && (
                    <p className="text-xs font-bold text-(--accent-coral) animate-in fade-in">
                        {error}
                    </p>
                )}
            </div>
        );
    },
);

Textarea.displayName = "Textarea";
export default Textarea;
