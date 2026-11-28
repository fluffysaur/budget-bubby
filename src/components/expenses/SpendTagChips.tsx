/**
 * SpendTagChips: single-line, horizontally scrollable row of tag/trip chips
 * (most recently used first). Tapping a chip toggles the ledger tag filter.
 */

import { useMemo } from "react";
import { Tag } from "lucide-react";
import { FilterChip } from "../ui/FilterChip";
import { formatSGDEstimate } from "../../lib/currency";
import { aggregateSpendTags, isSameTag } from "../../lib/spendTags";
import type { Category, Expense } from "../../types/finance";

export interface SpendTagChipsProps {
    expenses: Expense[];
    categories?: Category[];
    activeTag?: string;
    onSelectTag: (tag: string) => void;
    className?: string;
}

export function SpendTagChips({
    expenses,
    categories,
    activeTag,
    onSelectTag,
    className = "",
}: SpendTagChipsProps) {
    const aggregates = useMemo(
        () => aggregateSpendTags(expenses, categories),
        [expenses, categories],
    );

    if (aggregates.length === 0) return null;

    return (
        <div
            role="group"
            aria-label="Tags and trips"
            data-testid="spend-tag-chips"
            className={`flex items-center gap-2 ${className}`}
        >
            <Tag
                className="h-4 w-4 shrink-0 text-(--text-muted)"
                strokeWidth={2.5}
                aria-hidden="true"
            />
            <div className="flex min-w-0 flex-1 snap-x items-center gap-2 overflow-x-auto py-1 pr-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mask-[linear-gradient(to_right,black_calc(100%-1.5rem),transparent)]">
                {aggregates.map((item) => (
                    <FilterChip
                        key={item.tag}
                        selected={isSameTag(activeTag, item.tag)}
                        onClick={() => onSelectTag(item.tag)}
                        className="min-h-11 snap-start whitespace-nowrap"
                        data-testid={`tag-chip-${item.tag}`}
                    >
                        <span>#{item.tag}</span>
                        <span className="font-mono-num font-normal text-(--text-muted)">
                            {formatSGDEstimate(item.totalAmount)}
                        </span>
                    </FilterChip>
                ))}
            </div>
        </div>
    );
}

export default SpendTagChips;
