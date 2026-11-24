/**
 * Wraps a service-role Supabase client so every read, update and delete is
 * filtered to one household. A service role bypasses RLS, and the finance
 * stores rely on RLS for household scoping, so without this a multi-household
 * run would mix data across households.
 *
 * Fails closed: a table in neither list below throws. The migration
 * classification test fails CI until a new table is added to one of them.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** Tables with a household_id column; filtered on it. */
export const HOUSEHOLD_ID_TABLES: ReadonlySet<string> = new Set([
    "account_snapshots",
    "accounts",
    "base_budget_profiles",
    "bonus_events",
    "bonus_split_defaults",
    "capture_tokens",
    "categories",
    "credit_card_statements",
    "credit_cards",
    "daily_checkins",
    "expenses",
    "household_members",
    "inbox_items",
    "loans",
    "merchant_rules",
    "monthly_budgets",
    "notification_log",
    "notification_preferences",
    "push_subscriptions",
    "recurring_items",
    "savings_goals",
    "settle_ups",
]);

/**
 * Tables with no household_id, reached only through a scoped parent row
 * (or keyed by a member id), so they pass through unfiltered.
 */
export const CHILD_TABLES: ReadonlySet<string> = new Set([
    "base_profile_allocations",
    "loan_payments",
    "member_ai_settings",
    "monthly_budget_categories",
]);

const FILTERED_METHODS = new Set(["select", "update", "delete"]);

export function scopeClientToHousehold(
    client: SupabaseClient,
    householdId: string,
): SupabaseClient {
    return new Proxy(client, {
        get(target, prop, receiver) {
            if (prop !== "from") return Reflect.get(target, prop, receiver);
            return (table: string) => {
                const column =
                    table === "households"
                        ? "id"
                        : HOUSEHOLD_ID_TABLES.has(table)
                          ? "household_id"
                          : null;
                if (!column && !CHILD_TABLES.has(table)) {
                    throw new Error(
                        `Table "${table}" is not classified for household scoping; add it to HOUSEHOLD_ID_TABLES or CHILD_TABLES in householdScopedClient.ts`,
                    );
                }
                const builder = target.from(table);
                if (!column) return builder;
                return new Proxy(builder, {
                    get(b, method) {
                        const value = Reflect.get(b, method, b);
                        if (
                            typeof method !== "string" ||
                            !FILTERED_METHODS.has(method)
                        ) {
                            return typeof value === "function"
                                ? value.bind(b)
                                : value;
                        }
                        return (...args: unknown[]) =>
                            value.apply(b, args).eq(column, householdId);
                    },
                });
            };
        },
    });
}
