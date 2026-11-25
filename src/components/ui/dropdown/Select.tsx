import { forwardRef, useCallback } from "react";
import { TruncatedText } from "../TruncatedText";
import { DropdownField } from "./DropdownField";
import { DropdownSurface } from "./DropdownSurface";
import { OptionList } from "./OptionList";
import { OptionLeading } from "./OptionRow";
import { findOption } from "./optionUtils";
import { useDropdown } from "./useDropdown";
import type {
    DropdownSizeVariant,
    DropdownVariant,
    SelectItem,
    SelectOption,
} from "./types";

export interface SelectProps {
    options: readonly SelectItem[];
    /** `""`, `null` or `undefined` means no value: the placeholder shows. */
    value: string | null | undefined;
    onValueChange: (value: string) => void;
    /** Muted trigger text while there is no value. */
    placeholder?: string;
    /** Adds a "Clear" action that calls `onValueChange("")`. */
    clearable?: boolean;
    /** Overrides the auto search (on above 8 enabled options). */
    searchable?: boolean;
    searchPlaceholder?: string;
    variant?: DropdownVariant;
    sizeVariant?: DropdownSizeVariant;
    label?: string;
    labelClassName?: string;
    error?: string;
    /** Applied to the trigger button. */
    className?: string;
    containerClassName?: string;
    iconClassName?: string;
    disabled?: boolean;
    id?: string;
    name?: string;
    "aria-label"?: string;
    "data-testid"?: string;
}

/**
 * Custom single-value dropdown: anchored popover on desktop, bottom sheet on
 * mobile. Options are data; the component owns row layout.
 */
export const Select = forwardRef<HTMLButtonElement, SelectProps>(
    (
        {
            options,
            value,
            onValueChange,
            placeholder,
            clearable = false,
            searchable,
            searchPlaceholder,
            variant = "field",
            sizeVariant = "md",
            label,
            labelClassName,
            error,
            className,
            containerClassName,
            iconClassName,
            disabled,
            id,
            name,
            "aria-label": ariaLabel,
            "data-testid": dataTestId,
        },
        ref,
    ) => {
        const current = value ?? "";
        const isSelected = useCallback(
            (candidate: string) => current !== "" && candidate === current,
            [current],
        );
        const onPick = useCallback(
            (option: SelectOption) => {
                if (option.value !== current) onValueChange(option.value);
            },
            [current, onValueChange],
        );

        const dropdown = useDropdown({
            items: options,
            isSelected,
            onPick,
            closeOnPick: true,
            searchable,
            disabled,
            id,
            label,
            "aria-label": ariaLabel,
        });

        const selected = findOption(options, current);
        const showClear = clearable && current !== "";

        const clearAction = showClear ? (
            <button
                type="button"
                onClick={() => {
                    onValueChange("");
                    dropdown.setOpen(false);
                }}
                className="min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold sm:min-h-8 uppercase tracking-wider text-(--text-muted) transition-colors hover:bg-(--bg-cream) hover:text-(--text-ink) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
            >
                Clear
            </button>
        ) : undefined;

        return (
            <>
                <DropdownField
                    ref={ref}
                    dropdown={dropdown}
                    variant={variant}
                    sizeVariant={sizeVariant}
                    labelClassName={labelClassName}
                    error={error}
                    className={className}
                    containerClassName={containerClassName}
                    iconClassName={iconClassName}
                    name={name}
                    hiddenValue={current}
                    data-testid={dataTestId}
                >
                    {selected ? (
                        <>
                            <OptionLeading option={selected} />
                            <TruncatedText
                                text={selected.label}
                                className="min-w-0"
                            />
                        </>
                    ) : (
                        <span className="truncate text-(--text-muted)">
                            {placeholder ?? "Select"}
                        </span>
                    )}
                </DropdownField>
                <DropdownSurface
                    dropdown={dropdown}
                    title={label ?? ariaLabel ?? placeholder ?? "Select"}
                    headerAction={clearAction}
                    searchPlaceholder={searchPlaceholder}
                >
                    <OptionList dropdown={dropdown} />
                </DropdownSurface>
            </>
        );
    },
);

Select.displayName = "Select";
