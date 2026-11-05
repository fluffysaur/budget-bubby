import { useCallback, useRef, useState } from "react";
import { financeService } from "../../../services/financeService";
import {
    isRowBlank,
    rowToCreateInput,
    type BulkAction,
    type BulkState,
    type BulkSummary,
} from "../../../lib/bulkAddRows";
import type { Expense } from "../../../types/finance";

interface Options {
    state: BulkState;
    summary: BulkSummary;
    dispatch: React.Dispatch<BulkAction>;
    onSaved: (created: Expense[]) => void;
    onInvalid: (
        target: NonNullable<BulkSummary["firstInvalid"]> | null,
    ) => void;
}

/** Validates, saves the batch and reports back. Keeps rows intact on failure. */
export function useBulkAddSubmit({
    state,
    summary,
    dispatch,
    onSaved,
    onInvalid,
}: Options) {
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const inFlightRef = useRef(false);

    const submit = useCallback(async () => {
        if (inFlightRef.current) return;

        if (summary.invalidCount > 0 || summary.count === 0) {
            dispatch({ type: "setShowErrors", value: true });
            onInvalid(summary.firstInvalid);
            return;
        }

        inFlightRef.current = true;
        setIsSubmitting(true);
        setErrorMessage(null);
        try {
            const inputs = state.rows
                .filter((r) => !isRowBlank(r))
                .map((r) =>
                    rowToCreateInput(r, {
                        payerId: state.payerId,
                        rateOverrides: state.rateOverrides,
                    }),
                );
            const created = await financeService.bulkAddExpenses(inputs);
            if (typeof window !== "undefined" && created.length > 0) {
                const total = created.reduce((sum, e) => sum + e.amount, 0);
                window.dispatchEvent(
                    new CustomEvent("expenseAdded", {
                        detail: {
                            ...created[0],
                            item:
                                created.length === 1
                                    ? created[0].item
                                    : `${created.length} expenses logged`,
                            amount: total,
                        },
                    }),
                );
            }
            onSaved(created);
        } catch (err) {
            console.error("Failed to bulk add expenses:", err);
            setErrorMessage(
                err instanceof Error && err.message
                    ? err.message
                    : "Couldn't save. Try again.",
            );
        } finally {
            inFlightRef.current = false;
            setIsSubmitting(false);
        }
    }, [state, summary, dispatch, onSaved, onInvalid]);

    const clearError = useCallback(() => setErrorMessage(null), []);

    return { submit, isSubmitting, errorMessage, clearError };
}
