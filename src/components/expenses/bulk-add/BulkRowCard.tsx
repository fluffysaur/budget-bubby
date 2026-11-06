import { memo, useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";
import { guessCategoryId } from "../../../lib/categoryGuess";
import { validateRow, visibleErrors } from "../../../lib/bulkAddRows";
import type {
    BulkAction,
    BulkRow,
    RateOverrides,
} from "../../../lib/bulkAddRows";
import type { Category, SavingsGoal } from "../../../types/finance";
import { CategoryChip } from "./CategoryChip";
import { RowAmountInput, RowItemInput, type RegisterRef } from "./RowInputs";
import { RowDateField } from "./RowDateField";
import { RowMoreFields } from "./RowMoreFields";

export interface BulkRowViewProps {
    row: BulkRow;
    index: number;
    categories: Category[];
    goals: SavingsGoal[];
    rateOverrides: RateOverrides;
    showErrors: boolean;
    dispatch: React.Dispatch<BulkAction>;
    registerRef: RegisterRef;
    onAmountEnter: (rowId: string) => void;
    onItemEnter: (rowId: string) => void;
    onRemove: (rowId: string) => void;
    disabled?: boolean;
}

/** Mobile row: compact card with a "More" collapse. */
export const BulkRowCard = memo(function BulkRowCard({
    row,
    index,
    categories,
    goals,
    rateOverrides,
    showErrors,
    dispatch,
    registerRef,
    onAmountEnter,
    onItemEnter,
    onRemove,
    disabled,
}: BulkRowViewProps) {
    const [moreOpen, setMoreOpen] = useState(
        row.tags.length > 0 || row.currency !== "SGD",
    );
    const allErrors = validateRow(row, { rateOverrides });
    const errors = visibleErrors(row, allErrors, showErrors);
    const guess = useCallback(
        (text: string) => guessCategoryId(text, categories),
        [categories],
    );

    return (
        <li
            role="group"
            aria-label={`Row ${index + 1}`}
            className="space-y-2 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3 shadow-(--shadow-cute-sm)"
        >
            <div className="flex items-start gap-2">
                <div className="w-28 shrink-0">
                    <RowAmountInput
                        row={row}
                        index={index}
                        error={errors.amount}
                        dispatch={dispatch}
                        registerRef={registerRef}
                        onEnter={onAmountEnter}
                        disabled={disabled}
                    />
                </div>
                <div className="min-w-0 flex-1">
                    <RowItemInput
                        row={row}
                        index={index}
                        error={errors.item}
                        dispatch={dispatch}
                        registerRef={registerRef}
                        onEnter={onItemEnter}
                        disabled={disabled}
                        guess={guess}
                    />
                </div>
                <Button
                    variant="ghost"
                    size="icon-md"
                    aria-label={`Remove row ${index + 1}`}
                    className="min-h-11 min-w-11 shrink-0"
                    disabled={disabled}
                    onClick={() => onRemove(row.id)}
                >
                    <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                </Button>
            </div>

            <div className="flex items-center gap-2">
                <CategoryChip
                    row={row}
                    index={index}
                    categories={categories}
                    goals={goals}
                    dispatch={dispatch}
                    hasError={Boolean(errors.category)}
                    disabled={disabled}
                    className="flex-1"
                />
                <RowDateField
                    row={row}
                    index={index}
                    dispatch={dispatch}
                    disabled={disabled}
                />
                <button
                    type="button"
                    aria-expanded={moreOpen}
                    aria-label={`More options for row ${index + 1}`}
                    onClick={() => setMoreOpen((v) => !v)}
                    className="min-h-11 shrink-0 px-1 text-xs font-bold text-(--text-muted) hover:text-(--text-ink)"
                >
                    {moreOpen ? "Less" : "More"}
                </button>
            </div>

            <div
                className={`grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none ${
                    moreOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
            >
                <div className="min-h-0 overflow-hidden">
                    {moreOpen && (
                        <div className="pt-1">
                            <RowMoreFields
                                row={row}
                                index={index}
                                rateOverrides={rateOverrides}
                                dispatch={dispatch}
                                disabled={disabled}
                            />
                        </div>
                    )}
                </div>
            </div>
        </li>
    );
});
