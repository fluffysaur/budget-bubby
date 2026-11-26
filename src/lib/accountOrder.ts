/** Ordering rules for `accounts.sort_order`. */

interface Orderable {
    id: string;
    name: string;
    sort_order?: number | null;
}

/** `sort_order nulls last, name`, matching the database query. */
export function sortAccounts<T extends Orderable>(accounts: T[]): T[] {
    return [...accounts].sort(
        (a, b) =>
            (a.sort_order ?? Infinity) - (b.sort_order ?? Infinity) ||
            a.name.localeCompare(b.name),
    );
}

/**
 * Puts the accounts named in `ids` into that order, using only the slots they
 * already occupy. Accounts hidden by a filter keep their place.
 */
export function applySubsetOrder<T extends { id: string }>(
    list: T[],
    ids: string[],
): T[] {
    const byId = new Map(list.map((item) => [item.id, item]));
    const queue = ids.flatMap((id) => byId.get(id) ?? []);
    const moving = new Set(queue.map((item) => item.id));
    let next = 0;
    return list.map((item) => (moving.has(item.id) ? queue[next++] : item));
}

export function nextSortOrder(group: { sort_order?: number | null }[]): number {
    return group.reduce(
        (next, a) => Math.max(next, (a.sort_order ?? -1) + 1),
        0,
    );
}

/** Moves `id` by one step. Returns an equal copy when it is already at an end. */
export function moveItem(ids: string[], id: string, step: -1 | 1): string[] {
    const from = ids.indexOf(id);
    const to = from + step;
    if (from < 0 || to < 0 || to >= ids.length) return [...ids];
    const next = [...ids];
    [next[from], next[to]] = [next[to], next[from]];
    return next;
}

/** Gives accounts without a position one, by name, as the migration does. */
export function backfillSortOrder<
    T extends Orderable & { household_id: string; type: string },
>(accounts: T[]): void {
    const unplaced = accounts
        .filter((a) => a.sort_order == null)
        .sort((a, b) => a.name.localeCompare(b.name));
    for (const account of unplaced) {
        account.sort_order = nextSortOrder(
            accounts.filter(
                (a) =>
                    a.household_id === account.household_id &&
                    a.type === account.type,
            ),
        );
    }
}
