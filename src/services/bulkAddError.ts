import type { Expense } from "../types/finance";

/**
 * Thrown by a sequential bulkAddExpenses when some rows were saved before a
 * later row failed. `created` holds the saved rows, in input order, so callers
 * can retry or queue only the rest instead of duplicating the saved ones.
 */
export class PartialBulkAddError extends Error {
    readonly created: Expense[];
    readonly cause: unknown;

    constructor(created: Expense[], cause: unknown) {
        super(
            cause instanceof Error
                ? cause.message
                : "Bulk add failed part-way through",
        );
        this.name = "PartialBulkAddError";
        this.created = created;
        this.cause = cause;
    }
}
