/**
 * Shared draft state and builders for expense entry (ExpenseFormModal & InboxCard).
 */

import { buildExpenseFxFields } from "./currencyConverter";
import { getCurrentSingaporeTime, getTodayDateString } from "./dateUtils";
import type { CreateExpenseInput } from "../types/finance";

export type FundingSource = "budget" | "goal";

export interface ExpenseFormDraft {
    amount: number;
    currencyCode: string;
    customExchangeRate?: number;
    item: string;
    categoryId: string;
    partnerCategoryId?: string;
    categoryManuallySelected: boolean;
    isGoalSpend: boolean;
    selectedGoalId: string;
    payerId: string;
    isShared: boolean;
    splitRatio: number;
    date: string;
    time: string;
    remarks: string;
    tags: string[];
}

const GLOBAL_RECENT_TAGS_STORAGE_KEY = "budget_bubby_recent_tags_global_v2";

export function getStoredRecentTags(): string[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    try {
        const raw = window.localStorage.getItem(GLOBAL_RECENT_TAGS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {
        // Ignore localStorage error
    }
    return [];
}

export function storeRecentTags(newTags: string[]): void {
    if (
        typeof window === "undefined" ||
        !window.localStorage ||
        !newTags.length
    ) {
        return;
    }
    try {
        const existing = getStoredRecentTags();
        const combined = [
            ...newTags.map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
            ...existing,
        ];
        const unique: string[] = [];
        for (const t of combined) {
            if (!unique.some((u) => u.toLowerCase() === t.toLowerCase())) {
                unique.push(t);
            }
        }
        window.localStorage.setItem(
            GLOBAL_RECENT_TAGS_STORAGE_KEY,
            JSON.stringify(unique.slice(0, 10)),
        );
    } catch {
        // Ignore localStorage failures
    }
}

export function buildExpenseInputFromDraft(
    draft: ExpenseFormDraft,
    householdId?: string,
): CreateExpenseInput {
    return {
        ...(householdId ? { household_id: householdId } : {}),
        payer_id: draft.payerId,
        category_id: draft.isGoalSpend ? null : draft.categoryId || null,
        partner_category_id:
            draft.isGoalSpend || !draft.isShared
                ? null
                : draft.partnerCategoryId || null,
        date: draft.date || getTodayDateString(),
        time: draft.time || getCurrentSingaporeTime(),
        item: draft.item.trim(),
        ...buildExpenseFxFields(
            draft.amount,
            draft.currencyCode,
            draft.customExchangeRate,
        ),
        remarks: draft.remarks.trim() ? draft.remarks.trim() : null,
        is_shared: draft.isShared,
        split_ratio: draft.isShared ? draft.splitRatio : 0.0,
        goal_id: draft.isGoalSpend ? draft.selectedGoalId || null : null,
        tags: draft.tags.length > 0 ? draft.tags : undefined,
    };
}
