/**
 * CategoryModeToggle
 * Shared "Mode" switch for category forms:
 * - Track cap: spendable, warns near the limit
 * - Set aside: allocation, funded and never warns
 */

import type { CategoryGroup } from "../../types/finance";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TooltipPopover } from "../ui/TooltipPopover";

export interface CategoryModeToggleProps {
    value: CategoryGroup;
    onChange: (group: CategoryGroup) => void;
    className?: string;
}

export function CategoryModeToggle({
    value,
    onChange,
    className = "",
}: CategoryModeToggleProps) {
    return (
        <div className={`space-y-1.5 ${className}`}>
            <div className="flex items-center gap-1.5">
                <span className="block text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Mode
                </span>
                <TooltipPopover title="Mode">
                    Track cap: warns near the limit. Set aside: funded, never
                    warns.
                </TooltipPopover>
            </div>
            <SegmentedTabs<CategoryGroup>
                ariaLabel="Category mode"
                size="sm"
                accent="lilac"
                activeTab={value}
                onChange={onChange}
                tabs={[
                    { id: "spendable", label: "Track cap" },
                    { id: "allocation", label: "Set aside" },
                ]}
            />
        </div>
    );
}

export default CategoryModeToggle;
