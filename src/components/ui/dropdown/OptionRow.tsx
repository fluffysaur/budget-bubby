import type { HTMLAttributes } from "react";
import { Check } from "lucide-react";
import { TruncatedText } from "../TruncatedText";
import type { SelectOption } from "./types";

export type OptionIndicator = "check" | "checkbox";

export interface OptionRowProps extends HTMLAttributes<HTMLDivElement> {
    option: SelectOption;
    selected: boolean;
    active: boolean;
    /** Select shows a trailing check; MultiSelect shows a leading checkbox. */
    indicator?: OptionIndicator;
}

/** Leading icon, or a colour dot when only `color` is set. */
export function OptionLeading({
    option,
}: {
    option: Pick<SelectOption, "icon" | "color">;
}) {
    if (option.icon) {
        return (
            <span className="flex shrink-0 items-center" aria-hidden="true">
                {option.icon}
            </span>
        );
    }
    if (option.color) {
        return (
            <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-(--border-ink)"
                style={{ backgroundColor: option.color }}
                aria-hidden="true"
            />
        );
    }
    return null;
}

export function OptionRow({
    option,
    selected,
    active,
    indicator = "check",
    className = "",
    ...props
}: OptionRowProps) {
    const descriptionId = option.description
        ? `${props.id}-description`
        : undefined;

    return (
        <div
            {...props}
            aria-describedby={descriptionId}
            data-active={active || undefined}
            className={`flex min-h-11 select-none items-center gap-2.5 rounded-xl px-3 py-2 text-base text-(--text-ink) transition-colors sm:text-sm ${
                option.disabled
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer"
            } ${active && !option.disabled ? "bg-(--pastel-lilac-light)" : ""} ${
                selected ? "font-bold" : "font-semibold"
            } ${className}`}
        >
            {indicator === "checkbox" && (
                <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 border-(--border-ink) transition-colors ${
                        selected ? "bg-(--pastel-lilac)" : "bg-(--bg-card)"
                    }`}
                    aria-hidden="true"
                >
                    {selected && (
                        <Check className="h-3.5 w-3.5" strokeWidth={3} />
                    )}
                </span>
            )}
            <OptionLeading option={option} />
            <span className="flex min-w-0 flex-1 flex-col">
                <TruncatedText text={option.label} />
                {option.description && (
                    <span
                        id={descriptionId}
                        aria-hidden="true"
                        className="text-xs font-medium text-(--text-muted)"
                    >
                        <TruncatedText text={option.description} />
                    </span>
                )}
            </span>
            {option.badge && (
                <span className="flex shrink-0 items-center">
                    {option.badge}
                </span>
            )}
            {indicator === "check" && (
                <Check
                    className={`h-4 w-4 shrink-0 ${selected ? "opacity-100" : "opacity-0"}`}
                    strokeWidth={3}
                    aria-hidden="true"
                />
            )}
        </div>
    );
}
