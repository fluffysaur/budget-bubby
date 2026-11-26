/**
 * CategoryProgressList Component
 * Visual category meters with:
 * - MeterBar indicator
 * - Bold remaining amount as primary figure
 * - Secondary figures (spent, budgeted, %) in a tap TooltipPopover
 * - Status Badge only when category exceeds budget
 * - "Set aside" (allocation) categories: lilac pill, Set aside / Funded readout
 */

import { useMemo } from "react";
import {
    AlertCircle,
    AlertTriangle,
    TrendingUp,
    HelpCircle,
    Utensils,
    Sparkles,
    Car,
    PiggyBank,
    Heart,
    Shield,
    Layers,
    Repeat,
} from "lucide-react";
import {
    isSpendableCategory,
    isBufferCategory,
    computeSpendableCategoryViews,
} from "../../lib/financialFormulas";
import { getRecurringMonthlyAmount } from "../../lib/recurringItems";
import { TooltipPopover } from "../ui/TooltipPopover";
import { TruncatedText } from "../ui/TruncatedText";
import { EmptyStateCard } from "../ui/EmptyStateCard";
import { MeterBar } from "../ui/MeterBar";
import { Badge } from "../ui/Badge";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import type { MonthlyBudgetCategoryDetail } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface CategoryProgressListProps {
    categories: MonthlyBudgetCategoryDetail[];
    onCategoryClick?: (categoryId: string) => void;
    compact?: boolean;
    className?: string;
}

function getCategoryIcon(name?: string) {
    const clean = (name || "").toLowerCase();
    if (
        clean.includes("food") ||
        clean.includes("grocer") ||
        clean.includes("dining")
    )
        return Utensils;
    if (clean.includes("lifestyle") || clean.includes("entertain"))
        return Sparkles;
    if (clean.includes("transport") || clean.includes("car")) return Car;
    if (clean.includes("invest")) return TrendingUp;
    if (clean.includes("saving")) return PiggyBank;
    if (clean.includes("tithe") || clean.includes("charity")) return Heart;
    if (clean.includes("buffer") || clean.includes("emerg")) return Shield;
    return Layers;
}

export function CategoryProgressList({
    categories = [],
    onCategoryClick,
    compact = false,
    className = "",
}: CategoryProgressListProps) {
    const household = useOptionalHousehold();
    const members = household?.members ?? [];
    const { absorption, views } = useMemo(
        () => computeSpendableCategoryViews(categories),
        [categories],
    );

    // Identify over-budget categories that are NOT fully cushioned by buffer
    const overBudgetCategories = useMemo(() => {
        return categories.filter((c) => {
            if (!isSpendableCategory(c.category ?? c.category_id)) return false;
            const actual = c.actualSpent || 0;
            const allocated = c.allocated_amount || 0;
            if (actual <= allocated) return false;

            const isBuffer = isBufferCategory(c.category ?? c.category_id);
            if (isBuffer) return true; // buffer itself exceeded allocation

            if (!absorption.hasBuffer) return true;

            const breakdown =
                absorption.categoryBreakdown[
                    c.category_id || c.category?.id || ""
                ];
            return (
                breakdown &&
                (breakdown.status === "uncovered" ||
                    breakdown.status === "partially_covered")
            );
        });
    }, [categories, absorption]);

    if (categories.length === 0) {
        return (
            <EmptyStateCard
                icon={<HelpCircle className="h-6 w-6" />}
                title="No Categories"
                description="Add budget categories to track monthly spend."
                className={className}
            />
        );
    }

    return (
        <div className={`space-y-4 ${className}`}>
            {/* Over Budget Alert Banner */}
            {overBudgetCategories.length > 0 && (
                <div className="flex items-center gap-3 p-3.5 sm:p-4 rounded-2xl border-2 border-(--border-ink) bg-(--pastel-coral-light) text-(--text-ink) shadow-cute-sm">
                    <div className="p-1.5 rounded-xl bg-(--accent-coral) text-white border-2 border-(--border-ink) shrink-0 shadow-cute-sm">
                        <AlertCircle className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <div className="text-xs sm:text-sm min-w-0 flex-1">
                        <span className="font-bold font-display">
                            {overBudgetCategories.length}{" "}
                            {overBudgetCategories.length === 1
                                ? "category"
                                : "categories"}{" "}
                            over cap:
                        </span>{" "}
                        <span className="font-medium opacity-90">
                            {overBudgetCategories
                                .map((c) => c.category?.name || "Category")
                                .join(", ")}
                        </span>
                    </div>
                </div>
            )}

            {/* Category Progress Meters */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
                {categories.map((catDetail) => {
                    const categoryName = catDetail.category?.name || "Category";
                    const categoryColor =
                        catDetail.category?.color || "#3B82F6";
                    const Icon = getCategoryIcon(categoryName);
                    const catId =
                        catDetail.category_id || catDetail.category?.id || "";

                    const isBuffer = isBufferCategory(
                        catDetail.category ?? catDetail.category_id,
                    );
                    const coverage = absorption.categoryBreakdown[catId];
                    const view = views[catId];

                    const allocated = catDetail.allocated_amount || 0;
                    const actual = catDetail.actualSpent || 0;
                    const subSpent = catDetail.recurringSpent || 0;
                    const subItems = catDetail.recurringItems || [];

                    const remaining =
                        view?.remaining ??
                        (catDetail.remaining !== undefined
                            ? catDetail.remaining
                            : allocated - actual);

                    const spentPercentage =
                        allocated > 0
                            ? (actual / allocated) * 100
                            : actual > 0
                              ? 100
                              : 0;
                    const roundedPercentage = Math.round(spentPercentage);
                    // Set-aside categories are funded, not capped: never warn.
                    const tracksCap = isSpendableCategory(
                        catDetail.category ?? catDetail.category_id,
                    );
                    const isOverBudget =
                        tracksCap &&
                        (spentPercentage >= 100 || actual > allocated);

                    const isAlert =
                        tracksCap &&
                        (isBuffer
                            ? absorption.isDepleted
                            : coverage
                              ? coverage.status === "uncovered" ||
                                coverage.status === "partially_covered"
                              : isOverBudget);

                    return (
                        <div
                            key={catDetail.id || catDetail.category_id}
                            onClick={() =>
                                onCategoryClick?.(catDetail.category_id)
                            }
                            className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) ${
                                compact ? "p-3.5 sm:p-4" : "p-4 sm:p-5"
                            } shadow-cute-sm transition-colors ${
                                isAlert
                                    ? "bg-(--pastel-coral-light)/50"
                                    : coverage?.status === "covered"
                                      ? "bg-(--pastel-mint-light)/20 hover:bg-(--pastel-mint-light)/30"
                                      : "hover:bg-(--pastel-butter-light)/20"
                            } ${onCategoryClick ? "cursor-pointer" : ""}`}
                        >
                            {/* Card Header: Icon, Name & Status Badge (Over or Set aside only) */}
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div
                                        className="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-white shadow-cute-sm border border-(--border-ink)"
                                        style={{
                                            backgroundColor: categoryColor,
                                        }}
                                    >
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                        <TruncatedText
                                            text={categoryName}
                                            className="font-display font-black text-sm text-(--text-ink)"
                                        />
                                        {tracksCap && (
                                            <span
                                                className="inline-flex shrink-0"
                                                onClick={(e) =>
                                                    e.stopPropagation()
                                                }
                                            >
                                                <TooltipPopover
                                                    title={
                                                        isBuffer
                                                            ? "Buffer Details"
                                                            : `${categoryName} Details`
                                                    }
                                                    ariaLabel={`${categoryName} budget breakdown`}
                                                    align="left"
                                                >
                                                    <div className="space-y-1.5 text-xs">
                                                        <div>
                                                            {isBuffer
                                                                ? "Direct spent:"
                                                                : "Spent:"}{" "}
                                                            <strong>
                                                                <CurrencyText
                                                                    amount={
                                                                        actual
                                                                    }
                                                                />
                                                            </strong>
                                                        </div>
                                                        <div>
                                                            Budget:{" "}
                                                            <strong>
                                                                <CurrencyText
                                                                    amount={
                                                                        allocated
                                                                    }
                                                                />
                                                            </strong>
                                                        </div>
                                                        <div className="text-(--text-muted)">
                                                            {roundedPercentage}%
                                                            of cap
                                                        </div>
                                                        {isBuffer &&
                                                            absorption.totalAbsorbed >
                                                                0 && (
                                                                <div className="pt-1.5 border-t border-(--border-ink)/20 space-y-1">
                                                                    <div className="font-bold flex items-center justify-between">
                                                                        <span>
                                                                            Absorbed
                                                                            overages:
                                                                        </span>
                                                                        <span>
                                                                            <CurrencyText
                                                                                amount={
                                                                                    absorption.totalAbsorbed
                                                                                }
                                                                            />
                                                                        </span>
                                                                    </div>
                                                                    {absorption
                                                                        .cushionBreakdown
                                                                        .length >
                                                                        0 && (
                                                                        <ul className="list-disc pl-4 space-y-0.5 text-[11px] text-(--text-muted)">
                                                                            {absorption.cushionBreakdown.map(
                                                                                (
                                                                                    item,
                                                                                ) => (
                                                                                    <li
                                                                                        key={
                                                                                            item.categoryId
                                                                                        }
                                                                                    >
                                                                                        {
                                                                                            item.categoryName
                                                                                        }
                                                                                        :{" "}
                                                                                        <strong className="text-(--text-ink)">
                                                                                            <CurrencyText
                                                                                                amount={
                                                                                                    item.absorbedAmount
                                                                                                }
                                                                                            />
                                                                                        </strong>
                                                                                    </li>
                                                                                ),
                                                                            )}
                                                                        </ul>
                                                                    )}
                                                                </div>
                                                            )}
                                                        {isBuffer && (
                                                            <div className="pt-1.5 border-t border-(--border-ink)/20 font-bold flex items-center justify-between">
                                                                <span>
                                                                    Remaining
                                                                    cushion:
                                                                </span>
                                                                <span
                                                                    className={
                                                                        absorption.isDepleted
                                                                            ? "text-rose-600 dark:text-rose-400"
                                                                            : ""
                                                                    }
                                                                >
                                                                    <CurrencyText
                                                                        amount={
                                                                            remaining
                                                                        }
                                                                    />
                                                                </span>
                                                            </div>
                                                        )}
                                                        {!isBuffer &&
                                                            coverage &&
                                                            coverage.absorbed >
                                                                0 && (
                                                                <div className="pt-1 border-t border-(--border-ink)/20 text-emerald-700 dark:text-emerald-300 font-medium">
                                                                    Covered by
                                                                    Buffer:{" "}
                                                                    <CurrencyText
                                                                        amount={
                                                                            coverage.absorbed
                                                                        }
                                                                    />
                                                                </div>
                                                            )}
                                                        {!isBuffer &&
                                                            coverage &&
                                                            coverage.uncovered >
                                                                0 && (
                                                                <div className="text-rose-600 dark:text-rose-400 font-medium">
                                                                    Uncovered:{" "}
                                                                    <CurrencyText
                                                                        amount={
                                                                            coverage.uncovered
                                                                        }
                                                                    />
                                                                </div>
                                                            )}
                                                    </div>
                                                </TooltipPopover>
                                            </span>
                                        )}
                                        {catDetail.category?.member_id && (
                                            <Badge
                                                variant="lilac"
                                                size="sm"
                                                className="shrink-0"
                                            >
                                                {members.find(
                                                    (m) =>
                                                        m.id ===
                                                        catDetail.category
                                                            ?.member_id,
                                                )?.display_name ?? "Personal"}
                                            </Badge>
                                        )}
                                    </div>
                                </div>

                                {/* Status Indicator Icon (tap/hover for details) */}
                                <div
                                    className="shrink-0"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    {!tracksCap ? (
                                        <TooltipPopover
                                            title="Set aside"
                                            ariaLabel="Set aside"
                                            renderTrigger={(triggerProps) => (
                                                <button
                                                    type="button"
                                                    {...triggerProps}
                                                    className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-(--accent-lilac)/30 text-(--text-ink) p-1.5 shadow-cute-sm cursor-pointer"
                                                >
                                                    <PiggyBank className="h-3.5 w-3.5" />
                                                </button>
                                            )}
                                        >
                                            Funds set aside each month without a
                                            spending cap.
                                        </TooltipPopover>
                                    ) : isBuffer ? (
                                        absorption.isDepleted ? (
                                            <TooltipPopover
                                                title="Buffer depleted"
                                                ariaLabel="Buffer depleted"
                                                renderTrigger={(
                                                    triggerProps,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        {...triggerProps}
                                                        data-testid={`badge-depleted-${catDetail.category_id}`}
                                                        className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 p-1.5 shadow-cute-sm cursor-pointer"
                                                    >
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            >
                                                All buffer funds have been used
                                                or absorbed by overages.
                                            </TooltipPopover>
                                        ) : absorption.totalAbsorbed > 0 ? (
                                            <TooltipPopover
                                                title="Cushioning"
                                                ariaLabel="Cushioning"
                                                renderTrigger={(
                                                    triggerProps,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        {...triggerProps}
                                                        data-testid={`badge-cushioning-${catDetail.category_id}`}
                                                        className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 p-1.5 shadow-cute-sm cursor-pointer"
                                                    >
                                                        <Shield className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            >
                                                Absorbing{" "}
                                                <CurrencyText
                                                    amount={
                                                        absorption.totalAbsorbed
                                                    }
                                                />{" "}
                                                in category overages.
                                            </TooltipPopover>
                                        ) : null
                                    ) : isOverBudget ? (
                                        coverage?.status === "covered" ? (
                                            <TooltipPopover
                                                title="Covered by Buffer"
                                                ariaLabel="Covered by Buffer"
                                                renderTrigger={(
                                                    triggerProps,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        {...triggerProps}
                                                        data-testid={`badge-covered-${catDetail.category_id}`}
                                                        className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 p-1.5 shadow-cute-sm cursor-pointer"
                                                    >
                                                        <Shield className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            >
                                                Overage of{" "}
                                                <CurrencyText
                                                    amount={coverage.absorbed}
                                                />{" "}
                                                is fully absorbed by your
                                                Buffer.
                                            </TooltipPopover>
                                        ) : coverage?.status ===
                                          "partially_covered" ? (
                                            <TooltipPopover
                                                title="Partially covered"
                                                ariaLabel="Partially covered"
                                                renderTrigger={(
                                                    triggerProps,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        {...triggerProps}
                                                        data-testid={`badge-partially-covered-${catDetail.category_id}`}
                                                        className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 p-1.5 shadow-cute-sm cursor-pointer"
                                                    >
                                                        <AlertTriangle className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            >
                                                Buffer absorbs{" "}
                                                <CurrencyText
                                                    amount={coverage.absorbed}
                                                />{" "}
                                                of this overage;{" "}
                                                <CurrencyText
                                                    amount={coverage.uncovered}
                                                />{" "}
                                                remains uncovered.
                                            </TooltipPopover>
                                        ) : coverage?.status === "uncovered" &&
                                          absorption.hasBuffer ? (
                                            <TooltipPopover
                                                title="Uncovered"
                                                ariaLabel="Uncovered"
                                                renderTrigger={(
                                                    triggerProps,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        {...triggerProps}
                                                        data-testid={`badge-uncovered-${catDetail.category_id}`}
                                                        className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 p-1.5 shadow-cute-sm cursor-pointer"
                                                    >
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            >
                                                Uncovered by{" "}
                                                <CurrencyText
                                                    amount={coverage.uncovered}
                                                />{" "}
                                                — Buffer is depleted.
                                            </TooltipPopover>
                                        ) : (
                                            <TooltipPopover
                                                title="Over budget"
                                                ariaLabel="Over budget"
                                                renderTrigger={(
                                                    triggerProps,
                                                ) => (
                                                    <button
                                                        type="button"
                                                        {...triggerProps}
                                                        data-testid={`badge-rose-${catDetail.category_id}`}
                                                        className="inline-flex items-center justify-center rounded-full border-2 border-(--border-ink) bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 p-1.5 shadow-cute-sm cursor-pointer"
                                                    >
                                                        <AlertCircle className="h-3.5 w-3.5" />
                                                    </button>
                                                )}
                                            >
                                                Spent{" "}
                                                <CurrencyText
                                                    amount={Math.abs(remaining)}
                                                />{" "}
                                                over cap.
                                            </TooltipPopover>
                                        )
                                    ) : null}
                                </div>
                            </div>

                            {/* Primary Amount: Left / Over for spendable, Set aside / Funded for allocations */}
                            {!tracksCap ? (
                                <div className="flex items-center justify-between text-left my-2">
                                    <div>
                                        <span className="block text-2xs uppercase font-bold text-(--text-muted)">
                                            Set aside
                                        </span>
                                        <span className="text-(--text-ink)">
                                            <CurrencyText
                                                amount={allocated}
                                                size="md"
                                            />
                                        </span>
                                    </div>
                                    {actual > 0 && (
                                        <div className="text-right">
                                            <span className="block text-2xs uppercase font-bold text-(--text-muted)">
                                                Funded
                                            </span>
                                            <span className="text-(--text-ink)">
                                                <CurrencyText
                                                    amount={actual}
                                                    size="md"
                                                />
                                            </span>
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="my-2 space-y-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                                            {remaining < 0 ? (
                                                <span className="text-sm font-bold text-rose-600 dark:text-rose-400 font-mono-num">
                                                    <CurrencyText
                                                        amount={Math.abs(remaining)}
                                                    />{" "}
                                                    over
                                                </span>
                                            ) : (
                                                <span className="text-sm font-bold text-(--text-ink) font-mono-num">
                                                    <CurrencyText
                                                        amount={remaining}
                                                    />{" "}
                                                    left
                                                </span>
                                            )}
                                            {coverage?.status === "partially_covered" && (
                                                <span className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                                                    (Uncovered by{" "}
                                                    <CurrencyText
                                                        amount={coverage.uncovered}
                                                    />)
                                                </span>
                                            )}
                                        </div>

                                        <div
                                            className="flex items-center gap-1.5 shrink-0"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            {subSpent > 0 && (
                                                <TooltipPopover
                                                    label={`${categoryName} Recurring Breakdown`}
                                                    title="Recurring"
                                                    renderTrigger={(
                                                        triggerProps,
                                                    ) => (
                                                        <button
                                                            type="button"
                                                            {...triggerProps}
                                                            className="inline-flex items-center gap-1 rounded-lg bg-(--bg-cream) px-1.5 py-0.5 text-2xs font-semibold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                                                        >
                                                            <Repeat className="h-3 w-3 shrink-0 text-purple-600 dark:text-purple-400" />
                                                            <CurrencyText
                                                                amount={
                                                                    subSpent
                                                                }
                                                            />
                                                        </button>
                                                    )}
                                                >
                                                    <div className="space-y-1">
                                                        <p>
                                                            Includes{" "}
                                                            <strong>
                                                                <CurrencyText
                                                                    amount={
                                                                        subSpent
                                                                    }
                                                                />
                                                                /mo
                                                            </strong>{" "}
                                                            from recurring
                                                            items:
                                                        </p>
                                                        {subItems.length >
                                                            0 && (
                                                            <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                                                                {subItems.map(
                                                                    (s) => (
                                                                        <li
                                                                            key={
                                                                                s.id
                                                                            }
                                                                        >
                                                                            {
                                                                                s.name
                                                                            }
                                                                            :{" "}
                                                                            <CurrencyText
                                                                                amount={getRecurringMonthlyAmount(
                                                                                    s,
                                                                                )}
                                                                            />
                                                                        </li>
                                                                    ),
                                                                )}
                                                            </ul>
                                                        )}
                                                    </div>
                                                </TooltipPopover>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Progress Bar Meter */}
                            {(tracksCap || allocated > 0) && (
                                <div className="mt-2.5">
                                    <MeterBar
                                        value={view?.meterValue ?? actual}
                                        max={allocated}
                                        tone={!tracksCap ? "ok" : undefined}
                                        size="md"
                                        aria-label={`${categoryName} spending progress`}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default CategoryProgressList;
