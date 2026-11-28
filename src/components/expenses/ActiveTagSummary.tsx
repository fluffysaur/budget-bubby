/**
 * ActiveTagSummary: slim summary of the tag currently filtering the ledger
 * (total, count, top categories) with a clear affordance.
 */

import { useMemo } from "react";
import { X } from "lucide-react";
import { m } from "motion/react";
import { CategoryBadge } from "../ui/CategoryBadge";
import { CurrencyText } from "../ui/CurrencyText";
import { TruncatedText } from "../ui/TruncatedText";
import { fadeRise } from "../../lib/motion";
import { normalizeExpenseTag } from "../../lib/expenseFormDraft";
import { aggregateSpendTags, isSameTag } from "../../lib/spendTags";
import type { Category, Expense } from "../../types/finance";

export interface ActiveTagSummaryProps {
    tag: string;
    expenses: Expense[];
    categories?: Category[];
    onClear: () => void;
    className?: string;
}

export function ActiveTagSummary({
    tag,
    expenses,
    categories,
    onClear,
    className = "",
}: ActiveTagSummaryProps) {
    const aggregate = useMemo(
        () =>
            aggregateSpendTags(expenses, categories).find((a) =>
                isSameTag(a.tag, tag),
            ),
        [expenses, categories, tag],
    );

    const label = normalizeExpenseTag(tag);
    const count = aggregate?.transactionCount ?? 0;

    return (
        <m.div
            {...fadeRise}
            data-testid="active-tag-summary"
            className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border-2 border-(--border-ink) bg-(--pastel-lilac-light) px-3 py-2 ${className}`}
        >
            <div className="min-w-0 flex-1 basis-40">
                <div className="flex items-center gap-2">
                    <span className="min-w-0 text-sm font-black font-display text-(--text-ink)">
                        <TruncatedText text={`#${label}`} />
                    </span>
                </div>
                <p className="text-xs text-(--text-muted) font-mono-num">
                    <span className="font-bold text-(--text-ink)">
                        <CurrencyText amount={aggregate?.totalAmount ?? 0} />
                    </span>
                    {" · "}
                    {count} {count === 1 ? "expense" : "expenses"}
                    {" · "}All time
                </p>
            </div>
            {aggregate && aggregate.categories.length > 0 && (
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {aggregate.categories.slice(0, 3).map((cat) => (
                        <CategoryBadge
                            key={cat.id}
                            name={cat.name}
                            color={cat.color}
                        />
                    ))}
                </div>
            )}
            <button
                type="button"
                aria-label="Clear tag filter"
                onClick={onClear}
                className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl text-(--text-muted) transition-colors hover:bg-(--bg-cream) hover:text-(--text-ink)"
            >
                <X className="h-4 w-4" strokeWidth={2.5} />
            </button>
        </m.div>
    );
}

export default ActiveTagSummary;
