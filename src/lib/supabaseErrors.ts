/**
 * Helpers for recognising Supabase / PostgREST errors that mean an optional
 * migration has not been applied yet, so features can degrade gracefully.
 */

const MISSING_RELATION_CODES = new Set([
    "42P01", // undefined_table
    "PGRST205", // table not in schema cache
    "42883", // undefined_function
    "PGRST202", // function not in schema cache
]);

/** True when the error says a table or RPC does not exist (migration not applied). */
export function isMissingRelationError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: unknown }).code;
    return typeof code === "string" && MISSING_RELATION_CODES.has(code);
}

/** Thrown by bonus log mutations when the bonus tables or RPCs are missing. */
export class BonusLogUnavailableError extends Error {
    constructor() {
        super("Bonus log is not set up yet. Apply the bonus_events migration.");
        this.name = "BonusLogUnavailableError";
    }
}
