/** Helpers for logging partial credit card statement payments. */

export interface PartialAmountResult {
    /** Parsed amount rounded to cents, or null when invalid. */
    value: number | null;
    error: string | null;
}

/** A partial payment must be greater than 0 and less than the statement. */
export function validatePartialAmount(
    raw: string,
    statementAmount: number,
): PartialAmountResult {
    const parsed = parseFloat(raw);
    if (isNaN(parsed) || parsed <= 0) {
        return { value: null, error: "Enter an amount" };
    }
    const value = Math.round(parsed * 100) / 100;
    if (value >= statementAmount) {
        return { value: null, error: "Must be below statement" };
    }
    return { value, error: null };
}

/** True when the statement was paid for less than its full balance. */
export function isPartialPayment(stmt: {
    is_paid: boolean;
    amount_paid?: number | null;
}): boolean {
    return stmt.is_paid && stmt.amount_paid != null;
}
