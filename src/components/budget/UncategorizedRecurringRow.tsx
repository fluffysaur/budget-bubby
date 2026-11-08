/**
 * UncategorizedRecurringRow Component
 * Shows recurring subscription/bill/other spend with no budget category.
 * It counts toward total spend but not toward any category meter.
 */

import { Repeat } from "lucide-react";
import { getRecurringMonthlyAmount } from "../../lib/recurringItems";
import { TooltipPopover } from "../ui/TooltipPopover";
import { TruncatedText } from "../ui/TruncatedText";
import type { RecurringItem } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface UncategorizedRecurringRowProps {
    amount: number;
    items?: RecurringItem[];
    className?: string;
}

export function UncategorizedRecurringRow({
    amount,
    items = [],
    className = "",
}: UncategorizedRecurringRowProps) {
    if (amount <= 0) return null;

    return (
        <div
            data-testid="uncategorized-recurring"
            className={`flex items-center justify-between gap-3 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3.5 shadow-cute-sm ${className}`}
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-(--bg-cream) border-2 border-(--border-ink) text-(--text-ink)">
                    <Repeat className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Uncategorized
                </span>
                {items.length > 0 && (
                    <TooltipPopover
                        label="Uncategorized recurring items"
                        title="Recurring"
                    >
                        <ul className="space-y-0.5 text-[11px]">
                            {items.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center justify-between gap-2"
                                >
                                    <span className="min-w-0 flex-1">
                                        <TruncatedText text={item.name} />
                                    </span>
                                    <span className="shrink-0">
                                        <CurrencyText
                                            amount={getRecurringMonthlyAmount(
                                                item,
                                            )}
                                        />
                                    </span>
                                </li>
                            ))}
                        </ul>
                    </TooltipPopover>
                )}
            </div>
            <span className="shrink-0 text-(--text-ink)">
                <CurrencyText amount={amount} size="md" />
            </span>
        </div>
    );
}

export default UncategorizedRecurringRow;
