/**
 * Recurring item helpers shared by the finance services and the Recurring UI.
 *
 * - Insurance and tax reduce take-home pay (see calculateMemberRecurringDeductions).
 * - Subscription, bill and other items are spending, not payroll deductions.
 */

import {
    FileText,
    Package,
    Repeat,
    Shield,
    Zap,
    type LucideIcon,
} from "lucide-react";
import type { RecurringItemType } from "../types/finance";
import type { BadgeVariant } from "../components/ui/Badge";

export const RECURRING_TYPE_ICONS: Record<RecurringItemType, LucideIcon> = {
    insurance: Shield,
    tax: FileText,
    subscription: Repeat,
    bill: Zap,
    other: Package,
};

export const RECURRING_TYPE_BADGE_VARIANTS: Record<
    RecurringItemType,
    BadgeVariant
> = {
    insurance: "lilac",
    tax: "coral",
    subscription: "mint",
    bill: "butter",
    other: "slate",
};

export const RECURRING_ITEM_TYPES: readonly RecurringItemType[] = [
    "insurance",
    "tax",
    "subscription",
    "bill",
    "other",
] as const;

export const RECURRING_TYPE_LABELS: Record<RecurringItemType, string> = {
    insurance: "Insurance",
    tax: "Tax",
    subscription: "Subscription",
    bill: "Bill",
    other: "Other",
};

/** Insurance and tax are payroll-style deductions that reduce take-home pay. */
export function isDeductionType(type: RecurringItemType): boolean {
    return type === "insurance" || type === "tax";
}

/** Subscription, bill and other items are spending tracked against a budget category. */
export function isSpendType(type: RecurringItemType): boolean {
    return !isDeductionType(type);
}
