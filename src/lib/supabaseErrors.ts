/**
 * True when a Supabase/PostgREST error means a table or function doesn't
 * exist yet (a migration that hasn't been applied).
 */
export function isMissingRelationError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const { code, message } = err as { code?: unknown; message?: unknown };
    if (
        code === "PGRST205" || // table not in schema cache
        code === "PGRST202" || // function not in schema cache
        code === "42P01" || // undefined_table
        code === "42883" // undefined_function
    ) {
        return true;
    }
    return (
        typeof message === "string" &&
        /could not find the (table|function)|relation .* does not exist/i.test(message)
    );
}
