/** Helpers shared by the Supabase domain stores. */

import type {
    NotificationPreferences,
    BonusEvent,
    BonusSplitShare,
} from "../../types/finance";
import { getDefaultNotificationPreferences } from "../../lib/notificationDefaults";

/** Column-support probes, cached per session. `undefined` = not probed yet. */
export const columnSupport: {
    categoryGroup: boolean | undefined;
    categoryMemberId: boolean | undefined;
    expensePartnerCategory: boolean | undefined;
} = {
    categoryGroup: undefined,
    categoryMemberId: undefined,
    expensePartnerCategory: undefined,
};

export const PRESET_DEFAULT_CATEGORIES = [
    {
        name: "Food",
        color: "#F59E0B",
        icon: "utensils",
        group: "spendable" as const,
    },
    {
        name: "Lifestyle",
        color: "#EC4899",
        icon: "sparkles",
        group: "spendable" as const,
    },
    {
        name: "Transport",
        color: "#3B82F6",
        icon: "car",
        group: "spendable" as const,
    },
    {
        name: "Investments",
        color: "#10B981",
        icon: "trending-up",
        group: "allocation" as const,
    },
    {
        name: "Savings",
        color: "#6366F1",
        icon: "piggy-bank",
        group: "allocation" as const,
    },
    {
        name: "Tithing",
        color: "#8B5CF6",
        icon: "heart",
        group: "allocation" as const,
    },
    {
        name: "Buffer",
        color: "#64748B",
        icon: "shield",
        group: "spendable" as const,
    },
];

/**
 * Fills fields missing from older rows with defaults and trims Postgres
 * `time` values ("18:00:00") to "HH:MM".
 */
export function normalizeNotificationPreferences(
    row: Record<string, unknown>,
    memberId: string,
    householdId: string,
): NotificationPreferences {
    const prefs = {
        ...getDefaultNotificationPreferences(memberId, householdId),
        ...(row as Partial<NotificationPreferences>),
    };
    for (const key of [
        "checkin_time",
        "quiet_hours_start",
        "quiet_hours_end",
    ] as const) {
        const value = prefs[key];
        if (typeof value === "string") prefs[key] = value.slice(0, 5);
    }
    return prefs;
}

/**
 * Compat for the optional categories."group" column. `undefined` = unknown,
 * `false` = known missing (skip it in writes), `true` = known present.
 */

/** Test hook: forget what we learned about optional category/expense columns. */
export function resetCategoryGroupColumnSupport(): void {
    columnSupport.categoryGroup = undefined;
    columnSupport.categoryMemberId = undefined;
    columnSupport.expensePartnerCategory = undefined;
}

/** Postgres 42703 (undefined column) or PostgREST PGRST204 (column not in schema cache). */
/** Maps a bonus_events row to a BonusEvent. */
export function mapBonusEventRow(row: Record<string, unknown>): BonusEvent {
    const gross = Number(row.gross) || 0;
    const cpf = Number(row.cpf) || 0;
    const split = Array.isArray(row.split)
        ? (row.split as BonusSplitShare[]).map((s) => ({
              key: s.key,
              pct: Number(s.pct) || 0,
              ...(s.amount !== undefined
                  ? { amount: Number(s.amount) || 0 }
                  : {}),
          }))
        : [];
    return {
        id: String(row.id),
        household_id: String(row.household_id ?? ""),
        recipient_id: String(row.recipient_id ?? ""),
        type: (row.type as BonusEvent["type"]) ?? "other",
        received_on: String(row.received_on ?? "").slice(0, 10),
        gross,
        cpf,
        net:
            row.net !== undefined && row.net !== null
                ? Number(row.net)
                : Math.round((gross - cpf) * 100) / 100,
        note: (row.note as string | null | undefined) ?? null,
        split,
        created_by: (row.created_by as string | null | undefined) ?? null,
        created_at: row.created_at as string | undefined,
        updated_at: row.updated_at as string | undefined,
    };
}

export function isMissingColumnError(
    error: { code?: string; message?: string } | null,
): boolean {
    if (!error) return false;
    return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Quotes a value for a PostgREST `or()` ilike filter by wrapping `%value%` in
 * double quotes and escaping `\` and `"`.
 */
export function quotePostgrestIlikePattern(search: string): string {
    const escaped = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"%${escaped}%"`;
}

export function buildExpenseSearchOrFilter(search: string): string {
    const quoted = quotePostgrestIlikePattern(search);
    return `item.ilike.${quoted},remarks.ilike.${quoted}`;
}

export const POSTGREST_PAGE_SIZE = 1000;

export type PaginatableQuery<T> = PromiseLike<{
    data: T[] | null;
    error: unknown;
}> & {
    range?: (
        from: number,
        to: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

export async function fetchAllPages<T>(
    buildQuery: () => PaginatableQuery<T>,
): Promise<T[]> {
    const firstQuery = buildQuery();
    if (typeof firstQuery.range !== "function") {
        const { data, error } = await firstQuery;
        if (error) throw error;
        return (data || []) as T[];
    }

    const allRows: T[] = [];
    let offset = 0;

    while (true) {
        const query = offset === 0 ? firstQuery : buildQuery();
        const { data, error } = await query.range!(
            offset,
            offset + POSTGREST_PAGE_SIZE - 1,
        );
        if (error) throw error;
        const batch = (data || []) as T[];
        allRows.push(...batch);
        if (batch.length < POSTGREST_PAGE_SIZE) {
            break;
        }
        offset += POSTGREST_PAGE_SIZE;
    }

    return allRows;
}

export function roundCpfCap(cap: number | null | undefined): number | null {
    return typeof cap === "number" && Number.isFinite(cap) && cap > 0
        ? Math.round(cap * 100) / 100
        : null;
}
