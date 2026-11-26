import type { ReactNode } from "react";
import type { DropdownState } from "./useDropdown";
import { OptionRow, type OptionIndicator } from "./OptionRow";
import { isSelectGroup } from "./optionUtils";
import type { SelectOption } from "./types";

export interface OptionListProps {
    dropdown: DropdownState;
    indicator?: OptionIndicator;
    multiselectable?: boolean;
    emptyLabel?: string;
    className?: string;
}

/**
 * The `role="listbox"` with its groups and rows, built from the dropdown's
 * filtered items. Row indexes match `dropdown.visibleOptions`.
 */
export function OptionList({
    dropdown,
    indicator = "check",
    multiselectable = false,
    emptyLabel = "No matches",
    className = "",
}: OptionListProps) {
    const { visibleItems, visibleOptions, activeIndex, isSelected, ids } =
        dropdown;
    let index = 0;

    const renderRow = (option: SelectOption) => {
        const rowIndex = index++;
        return (
            <OptionRow
                key={`${option.value}-${rowIndex}`}
                option={option}
                selected={isSelected(option.value)}
                active={activeIndex === rowIndex}
                indicator={indicator}
                {...dropdown.getOptionProps(rowIndex, option)}
            />
        );
    };

    const children: ReactNode[] = visibleItems.map((item, itemIndex) => {
        if (!isSelectGroup(item)) return renderRow(item);
        const headingId = `${ids.listboxId}-group-${itemIndex}`;
        return (
            <div
                key={`group-${item.label}-${itemIndex}`}
                role="group"
                aria-labelledby={headingId}
                className="pt-1 first:pt-0"
            >
                <div
                    id={headingId}
                    role="presentation"
                    className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-(--text-muted)"
                >
                    {item.label}
                </div>
                {item.options.map(renderRow)}
            </div>
        );
    });

    return (
        <>
            <div
                {...dropdown.getListboxProps(multiselectable)}
                className={`min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5 focus:outline-none ${className}`}
            >
                {children}
            </div>
            {visibleOptions.length === 0 && (
                <p
                    role="status"
                    className="-mt-1.5 flex min-h-11 shrink-0 items-center px-4.5 pb-1.5 text-sm font-semibold text-(--text-muted)"
                >
                    {emptyLabel}
                </p>
            )}
        </>
    );
}
