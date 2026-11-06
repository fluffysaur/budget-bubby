import { Fragment, memo, useCallback, useState } from "react";
import { Trash2 } from "lucide-react";
import { Button } from "../../ui/Button";
import { guessCategoryId } from "../../../lib/categoryGuess";
import { validateRow, visibleErrors } from "../../../lib/bulkAddRows";
import { CategoryChip } from "./CategoryChip";
import { RowAmountInput, RowItemInput } from "./RowInputs";
import { RowDateField } from "./RowDateField";
import { RowMoreFields } from "./RowMoreFields";
import type { BulkRowViewProps } from "./BulkRowCard";

interface BulkRowTableRowProps extends BulkRowViewProps {
    /** Date gets its own column at md+, otherwise sits under the description. */
    showDateColumn: boolean;
    columnCount: number;
}

/** Desktop row: table cells plus an optional "More" row. */
export const BulkRowTableRow = memo(function BulkRowTableRow({
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
    showDateColumn,
    columnCount,
}: BulkRowTableRowProps) {
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
        <Fragment>
            <tr aria-label={`Row ${index + 1}`} className="align-top">
                {showDateColumn && (
                    <td className="px-1.5 py-2">
                        <RowDateField
                            row={row}
                            index={index}
                            dispatch={dispatch}
                            disabled={disabled}
                        />
                    </td>
                )}
                <td className="px-1.5 py-2">
                    <RowAmountInput
                        row={row}
                        index={index}
                        error={errors.amount}
                        dispatch={dispatch}
                        registerRef={registerRef}
                        onEnter={onAmountEnter}
                        disabled={disabled}
                    />
                </td>
                <td className="min-w-0 px-1.5 py-2">
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
                    {!showDateColumn && (
                        <RowDateField
                            row={row}
                            index={index}
                            dispatch={dispatch}
                            disabled={disabled}
                            className="mt-1.5 w-fit"
                        />
                    )}
                </td>
                <td className="px-1.5 py-2">
                    <CategoryChip
                        row={row}
                        index={index}
                        categories={categories}
                        goals={goals}
                        dispatch={dispatch}
                        hasError={Boolean(errors.category)}
                        disabled={disabled}
                    />
                </td>
                <td className="px-1.5 py-2">
                    <button
                        type="button"
                        aria-expanded={moreOpen}
                        aria-label={`More options for row ${index + 1}`}
                        onClick={() => setMoreOpen((v) => !v)}
                        className="min-h-11 w-full text-xs font-bold text-(--text-muted) hover:text-(--text-ink)"
                    >
                        {moreOpen ? "Less" : "More"}
                    </button>
                </td>
                <td className="px-1.5 py-2">
                    <Button
                        variant="ghost"
                        size="icon-md"
                        aria-label={`Remove row ${index + 1}`}
                        className="min-h-11 min-w-11"
                        disabled={disabled}
                        onClick={() => onRemove(row.id)}
                    >
                        <Trash2 className="h-4 w-4" strokeWidth={2.5} />
                    </Button>
                </td>
            </tr>
            {moreOpen && (
                <tr aria-label={`More options for row ${index + 1}`}>
                    <td colSpan={columnCount} className="px-1.5 pb-3">
                        <RowMoreFields
                            row={row}
                            index={index}
                            rateOverrides={rateOverrides}
                            dispatch={dispatch}
                            disabled={disabled}
                        />
                    </td>
                </tr>
            )}
        </Fragment>
    );
});
