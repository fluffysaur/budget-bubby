import type { ExpenseFilter } from "../types/finance";

/**
 * The category ids an expense filter selects, or `[]` for "all categories".
 * Accepts the legacy single `categoryId` (older persisted state or callers)
 * and maps it to `[categoryId]`.
 */
export function getFilterCategoryIds(filter?: ExpenseFilter): string[] {
    if (!filter) return [];
    if (filter.categoryIds && filter.categoryIds.length > 0) {
        return filter.categoryIds;
    }
    return filter.categoryId ? [filter.categoryId] : [];
}
