/**
 * RecurringTypeBadge Component
 * Pill badge with icon + label for a recurring item type
 * (Insurance, Tax, Subscription, Bill, Other).
 */

import { Badge } from "../ui/Badge";
import {
    RECURRING_TYPE_BADGE_VARIANTS,
    RECURRING_TYPE_ICONS,
    RECURRING_TYPE_LABELS,
} from "../../lib/recurringItems";
import type { RecurringItemType } from "../../types/finance";

export interface RecurringTypeBadgeProps {
    type: RecurringItemType;
    size?: "sm" | "md";
    className?: string;
}

export function RecurringTypeBadge({
    type,
    size = "sm",
    className = "",
}: RecurringTypeBadgeProps) {
    const Icon = RECURRING_TYPE_ICONS[type] ?? RECURRING_TYPE_ICONS.other;
    const label = RECURRING_TYPE_LABELS[type] ?? type;
    return (
        <span role="status" className={`inline-flex shrink-0 ${className}`}>
            <Badge
                variant={RECURRING_TYPE_BADGE_VARIANTS[type] ?? "slate"}
                size={size}
                icon={<Icon className="h-3 w-3" strokeWidth={2.5} />}
            >
                {label}
            </Badge>
        </span>
    );
}

export default RecurringTypeBadge;
