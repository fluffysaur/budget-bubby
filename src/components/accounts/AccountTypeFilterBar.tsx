/**
 * AccountTypeFilterBar Component
 * Shared multi-select pills (All, Cash, Investments, CPF, Other) that drive the
 * Net Worth card, chart and account list. Empty selection means All.
 */

import { FilterChip } from "../ui/FilterChip";
import type { AccountType } from "../../types/finance";
import {
    ACCOUNT_TYPE_FILTER_LABELS,
    ACCOUNT_TYPE_ORDER,
} from "../../lib/accountTypeFilter";

export interface AccountTypeFilterBarProps {
    selected: AccountType[];
    /** Types the user actually has accounts for (Other is hidden otherwise). */
    availableTypes: AccountType[];
    onToggle: (type: AccountType) => void;
    onClear: () => void;
    className?: string;
}

export function AccountTypeFilterBar({
    selected,
    availableTypes,
    onToggle,
    onClear,
    className = "",
}: AccountTypeFilterBarProps) {
    const types = ACCOUNT_TYPE_ORDER.filter(
        (t) => t !== "Other" || availableTypes.includes("Other"),
    );

    return (
        <div
            role="group"
            aria-label="Filter by account type"
            className={`flex flex-wrap gap-2 ${className}`}
        >
            <FilterChip
                selected={selected.length === 0}
                className="min-h-11 px-4"
                onClick={onClear}
            >
                All
            </FilterChip>
            {types.map((type) => {
                const isActive = selected.includes(type);
                return (
                    <FilterChip
                        key={type}
                        selected={isActive}
                        className="min-h-11 px-4"
                        onClick={() => onToggle(type)}
                    >
                        {ACCOUNT_TYPE_FILTER_LABELS[type]}
                    </FilterChip>
                );
            })}
        </div>
    );
}

export default AccountTypeFilterBar;
