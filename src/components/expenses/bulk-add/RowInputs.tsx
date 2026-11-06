import { Input } from "../../ui/Input";
import { isZeroDecimalCurrency } from "../../../lib/currencyConverter";
import { sanitizeAmount } from "../../../lib/bulkAddRows";
import type { BulkAction, BulkRow } from "../../../lib/bulkAddRows";

export type RegisterRef = (
    rowId: string,
    field: "amount" | "item",
    el: HTMLInputElement | null,
) => void;

interface RowInputProps {
    row: BulkRow;
    index: number;
    error?: string;
    dispatch: React.Dispatch<BulkAction>;
    registerRef: RegisterRef;
    onEnter: (rowId: string) => void;
    disabled?: boolean;
}

// 16px on mobile prevents iOS zoom-on-focus
const INPUT_CLASS = "text-base! sm:text-sm!";

export function RowAmountInput({
    row,
    index,
    error,
    dispatch,
    registerRef,
    onEnter,
    disabled,
}: RowInputProps) {
    const errorId = `bulk-amount-error-${row.id}`;
    return (
        <>
            <Input
                ref={(el) => registerRef(row.id, "amount", el)}
                aria-label={`Amount for row ${index + 1}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                placeholder="0.00"
                inputMode={
                    isZeroDecimalCurrency(row.currency) ? "numeric" : "decimal"
                }
                enterKeyHint="next"
                autoComplete="off"
                disabled={disabled}
                value={row.amount}
                className={`${INPUT_CLASS} font-black`}
                onChange={(e) =>
                    dispatch({
                        type: "updateRow",
                        id: row.id,
                        patch: {
                            amount: sanitizeAmount(
                                e.target.value,
                                row.currency,
                            ),
                        },
                    })
                }
                onBlur={() =>
                    dispatch({ type: "touch", id: row.id, field: "amount" })
                }
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        onEnter(row.id);
                    }
                }}
            />
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="mt-1 text-xs font-bold text-(--accent-coral)"
                >
                    {error}
                </p>
            )}
        </>
    );
}

export function RowItemInput({
    row,
    index,
    error,
    dispatch,
    registerRef,
    onEnter,
    disabled,
    guess,
}: RowInputProps & { guess: (text: string) => string | undefined }) {
    const errorId = `bulk-item-error-${row.id}`;
    return (
        <>
            <Input
                ref={(el) => registerRef(row.id, "item", el)}
                aria-label={`Description for row ${index + 1}`}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? errorId : undefined}
                placeholder="e.g. Lunch"
                enterKeyHint="next"
                autoComplete="off"
                disabled={disabled}
                value={row.item}
                className={INPUT_CLASS}
                onChange={(e) =>
                    dispatch({
                        type: "setItem",
                        id: row.id,
                        item: e.target.value,
                        guessedCategoryId: guess(e.target.value),
                    })
                }
                onBlur={() =>
                    dispatch({ type: "touch", id: row.id, field: "item" })
                }
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        onEnter(row.id);
                    }
                }}
            />
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="mt-1 text-xs font-bold text-(--accent-coral)"
                >
                    {error}
                </p>
            )}
        </>
    );
}
