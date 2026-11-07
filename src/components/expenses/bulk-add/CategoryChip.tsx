import { memo, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { TruncatedText } from "../../ui/TruncatedText";
import { isSpendableCategory } from "../../../lib/financialFormulas";
import type { BulkAction, BulkRow } from "../../../lib/bulkAddRows";
import type { Category, SavingsGoal } from "../../../types/finance";

// Goals shown before "More"
const GOAL_CHIP_LIMIT = 4;

interface CategoryChipProps {
    row: BulkRow;
    index: number;
    categories: Category[];
    goals: SavingsGoal[];
    dispatch: React.Dispatch<BulkAction>;
    hasError?: boolean;
    disabled?: boolean;
    className?: string;
}

/** Shows the (guessed) category or goal; tap to change. */
export const CategoryChip = memo(function CategoryChip({
    row,
    index,
    categories,
    goals,
    dispatch,
    hasError,
    disabled,
    className = "",
}: CategoryChipProps) {
    const [open, setOpen] = useState(false);
    const [showAll, setShowAll] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const spendable = useMemo(
        () => categories.filter((c) => isSpendableCategory(c)),
        [categories],
    );
    const visibleCategories =
        showAll || spendable.length === 0 ? categories : spendable;
    const visibleGoals = showAll ? goals : goals.slice(0, GOAL_CHIP_LIMIT);
    const hasMore =
        categories.length > visibleCategories.length ||
        goals.length > visibleGoals.length;

    const goal = row.goalId ? goals.find((g) => g.id === row.goalId) : null;
    const category = row.categoryId
        ? categories.find((c) => c.id === row.categoryId)
        : null;
    const label = goal
        ? `${goal.emoji || "🎯"} ${goal.title}`
        : (category?.name ?? "Category");

    useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent | TouchEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("touchstart", onDown);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("touchstart", onDown);
        };
    }, [open]);

    const pickCategory = (id: string) => {
        dispatch({ type: "setCategory", id: row.id, categoryId: id });
        setOpen(false);
    };
    const pickGoal = (id: string) => {
        dispatch({ type: "setGoal", id: row.id, goalId: id });
        setOpen(false);
    };

    const optionClass = (selected: boolean) =>
        `flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-bold text-(--text-ink) active:translate-x-0.5 active:translate-y-0.5 ${
            selected ? "bg-(--pastel-lilac-light)" : "hover:bg-(--bg-cream)"
        }`;

    return (
        <div
            ref={containerRef}
            className={`relative min-w-0 ${className}`}
            onKeyDown={(e) => {
                if (e.key === "Escape" && open) {
                    e.stopPropagation();
                    setOpen(false);
                }
            }}
        >
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Category for row ${index + 1}: ${label}`}
                onClick={() => setOpen((v) => !v)}
                className={`flex min-h-11 w-full items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 ${
                    goal
                        ? "border-(--border-ink) bg-(--pastel-butter-light) text-(--text-ink)"
                        : category
                          ? "border-(--border-ink) bg-(--bg-card) text-(--text-ink)"
                          : hasError
                            ? "border-(--accent-coral) bg-(--bg-card) text-(--accent-coral)"
                            : "border-(--border-subtle) bg-(--bg-card) text-(--text-muted)"
                }`}
            >
                <span className="min-w-0 flex-1 text-left">
                    <TruncatedText
                        text={
                            hasError && !category && !goal
                                ? "Pick category"
                                : label
                        }
                        className="pointer-events-none"
                    />
                </span>
                <ChevronDown
                    className="h-3.5 w-3.5 shrink-0 text-(--text-muted)"
                    strokeWidth={2.5}
                />
            </button>

            {open && (
                <div
                    role="listbox"
                    aria-label={`Category options for row ${index + 1}`}
                    className="z-50 mt-2 max-h-64 w-full min-w-48 overflow-y-auto rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-1.5 shadow-cute-sm sm:absolute sm:left-0 sm:top-full"
                >
                    {visibleCategories.map((c) => (
                        <button
                            key={c.id}
                            type="button"
                            role="option"
                            aria-selected={
                                row.categoryId === c.id && !row.goalId
                            }
                            onClick={() => pickCategory(c.id)}
                            className={optionClass(
                                row.categoryId === c.id && !row.goalId,
                            )}
                        >
                            <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/20"
                                style={{ backgroundColor: c.color }}
                                aria-hidden="true"
                            />
                            <span className="min-w-0 flex-1">
                                <TruncatedText
                                    text={c.name}
                                    className="pointer-events-none"
                                />
                            </span>
                        </button>
                    ))}
                    {visibleGoals.length > 0 && (
                        <>
                            <p className="px-3 pb-1 pt-2 text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                Goals
                            </p>
                            {visibleGoals.map((g) => (
                                <button
                                    key={g.id}
                                    type="button"
                                    role="option"
                                    aria-selected={row.goalId === g.id}
                                    onClick={() => pickGoal(g.id)}
                                    className={optionClass(row.goalId === g.id)}
                                >
                                    <span aria-hidden="true">
                                        {g.emoji || "🎯"}
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <TruncatedText
                                            text={g.title}
                                            className="pointer-events-none"
                                        />
                                    </span>
                                </button>
                            ))}
                        </>
                    )}
                    {hasMore && (
                        <button
                            type="button"
                            onClick={() => setShowAll(true)}
                            className="flex min-h-11 w-full items-center px-3 text-sm font-bold text-(--text-muted) hover:text-(--text-ink)"
                        >
                            More
                        </button>
                    )}
                </div>
            )}
        </div>
    );
});
