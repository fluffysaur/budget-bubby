/**
 * Switch primitive: labelled on/off toggle with an optional hint line.
 */

import type { ReactNode } from "react";

export interface SwitchProps {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    hint?: ReactNode;
    id?: string;
    disabled?: boolean;
}

export function Switch({
    checked,
    onChange,
    label,
    hint,
    id,
    disabled,
}: SwitchProps) {
    return (
        <div className="flex min-h-11 items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
                <span className="block text-sm font-bold text-(--text-ink)">
                    {label}
                </span>
                {hint && (
                    <span className="block text-xs text-(--text-muted)">
                        {hint}
                    </span>
                )}
            </div>
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                aria-label={label}
                disabled={disabled}
                onClick={() => onChange(!checked)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--pastel-lilac) disabled:cursor-not-allowed disabled:opacity-50 ${
                    checked ? "bg-(--pastel-butter)" : "bg-(--bg-card)"
                }`}
            >
                <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-(--text-ink) shadow-md ring-0 transition-transform duration-200 ease-in-out motion-reduce:transition-none ${
                        checked ? "translate-x-5" : "translate-x-0"
                    }`}
                />
            </button>
        </div>
    );
}

export default Switch;
