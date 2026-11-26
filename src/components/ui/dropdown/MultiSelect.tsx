import { forwardRef, useCallback, useMemo } from "react";
import { Button } from "../Button";
import { DropdownField } from "./DropdownField";
import { DropdownSurface } from "./DropdownSurface";
import { OptionList } from "./OptionList";
import { flattenOptions } from "./optionUtils";
import { useDropdown } from "./useDropdown";
import type {
    DropdownSizeVariant,
    DropdownVariant,
    SelectItem,
    SelectOption,
} from "./types";

export interface MultiSelectProps {
    options: readonly SelectItem[];
    value: readonly string[];
    /** Called on every toggle (live) and by "Clear all" with `[]`. */
    onValueChange: (values: string[]) => void;
    /** Muted trigger text while nothing is picked. */
    placeholder?: string;
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
    "aria-label"?: string;
    "data-testid"?: string;
}

/**
 * Custom multi-value dropdown sharing its internals with Select. The surface
 * stays open while toggling and every toggle applies live. Rows show
 * checkboxes; the trigger reads "First +N" in option order.
 */
export const MultiSelect = forwardRef<HTMLButtonElement, MultiSelectProps>(
    (
        {
            options,
            value,
            onValueChange,
            placeholder,
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
            "aria-label": ariaLabel,
            "data-testid": dataTestId,
        },
        ref,
    ) => {
        const isSelected = useCallback(
            (candidate: string) => value.includes(candidate),
            [value],
        );
        const onPick = useCallback(
            (option: SelectOption) => {
                onValueChange(
                    value.includes(option.value)
                        ? value.filter((v) => v !== option.value)
                        : [...value, option.value],
                );
            },
            [onValueChange, value],
        );

        const dropdown = useDropdown({
            items: options,
            isSelected,
            onPick,
            closeOnPick: false,
            searchable,
            disabled,
            id,
            label,
            "aria-label": ariaLabel,
        });

        // Selected options in option order; unknown values are ignored.
        const selected = useMemo(
            () =>
                flattenOptions(options).filter((o) => value.includes(o.value)),
            [options, value],
        );
        const first = selected[0];
        const extra = selected.length - 1;

        const clearAction =
            selected.length > 0 ? (
                <button
                    type="button"
                    onClick={() => onValueChange([])}
                    className="min-h-11 shrink-0 rounded-xl px-3 text-xs font-bold sm:min-h-8 uppercase tracking-wider text-(--text-muted) transition-colors hover:bg-(--bg-cream) hover:text-(--text-ink) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                >
                    Clear all
                </button>
            ) : undefined;

        const done = dropdown.isMobile ? (
            <Button
                type="button"
                variant="primary"
                size="lg"
                className="w-full"
                onClick={() => dropdown.setOpen(false)}
            >
                Done
            </Button>
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
                    data-testid={dataTestId}
                >
                    {first ? (
                        <>
                            {/* Plain truncation: TruncatedText stops click
                                propagation when overflowing, which would
                                swallow taps meant for the trigger. */}
                            <span
                                className="min-w-0 truncate"
                                title={first.label}
                            >
                                {first.label}
                            </span>
                            {extra > 0 && (
                                <span className="shrink-0 text-(--text-muted)">
                                    +{extra}
                                </span>
                            )}
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
                    footer={done}
                    searchPlaceholder={searchPlaceholder}
                >
                    <OptionList
                        dropdown={dropdown}
                        multiselectable
                        indicator="checkbox"
                    />
                </DropdownSurface>
            </>
        );
    },
);

MultiSelect.displayName = "MultiSelect";
