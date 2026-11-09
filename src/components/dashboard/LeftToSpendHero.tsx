import React, { useState } from "react";
import { Card, MeterBar } from "../ui";
import { CurrencyText } from "../ui/CurrencyText";
import { CategoryMeterCard } from "./CategoryMeterCard";

export interface SpendableCategoryItem {
    id: string;
    name: string;
    color: string;
    spent: number;
    allocated: number;
    remaining: number;
    pct: number;
}

export interface SpendableSummary {
    totalAllocated: number;
    totalSpent: number;
    totalRemaining: number;
    totalPct: number;
    categories: SpendableCategoryItem[];
}

export interface LeftToSpendHeroProps {
    summary: SpendableSummary;
    onNavigateBudget?: () => void;
}

export const LeftToSpendHero = React.memo(function LeftToSpendHero({
    summary,
    onNavigateBudget,
}: LeftToSpendHeroProps) {
    const [showAllCategories, setShowAllCategories] = useState(false);
    const isOverspent = summary.totalRemaining < 0;

    const displayedCategories = showAllCategories
        ? summary.categories
        : summary.categories.slice(0, 4);
    const hasMore = summary.categories.length > 4;

    return (
        <Card role="region" aria-label="Left to Spend" padding="lg">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                        Left to Spend
                    </span>
                    <div
                        data-testid="left-to-spend-amount"
                        className={`mt-1 ${
                            isOverspent
                                ? "text-(--accent-coral-ink) dark:text-rose-400"
                                : "text-(--text-ink)"
                        }`}
                    >
                        <CurrencyText
                            amount={summary.totalRemaining}
                            size="hero"
                        />
                    </div>
                    <span className="mt-1 block text-xs font-semibold text-(--text-muted) font-mono-num">
                        <CurrencyText amount={summary.totalSpent} /> of{" "}
                        <CurrencyText amount={summary.totalAllocated} /> spent
                    </span>
                </div>
                {onNavigateBudget && (
                    <button
                        type="button"
                        onClick={onNavigateBudget}
                        className="shrink-0 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 active:shadow-none transition-press cursor-pointer"
                    >
                        Budget
                    </button>
                )}
            </div>

            {/* Overall progress meter */}
            <div className="mt-3">
                <MeterBar
                    value={summary.totalSpent}
                    max={summary.totalAllocated}
                    size="md"
                    aria-label="Spendable budget progress"
                />
            </div>

            {/* Per-category meters */}
            {summary.categories.length > 0 && (
                <div className="mt-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                        {displayedCategories.map((cat) => (
                            <CategoryMeterCard
                                key={cat.id}
                                name={cat.name}
                                color={cat.color}
                                remaining={cat.remaining}
                                pct={cat.pct}
                            />
                        ))}
                    </div>
                    {hasMore && (
                        <div className="mt-2 text-center">
                            <button
                                type="button"
                                onClick={() =>
                                    setShowAllCategories((prev) => !prev)
                                }
                                className="text-xs font-bold text-(--text-muted) hover:text-(--text-ink) py-1 px-3 rounded-lg hover:bg-(--bg-cream) cursor-pointer transition-colors"
                            >
                                {showAllCategories
                                    ? "Show Less"
                                    : `+${summary.categories.length - 4} More`}
                            </button>
                        </div>
                    )}
                </div>
            )}
        </Card>
    );
});
LeftToSpendHero.displayName = "LeftToSpendHero";

export default LeftToSpendHero;
