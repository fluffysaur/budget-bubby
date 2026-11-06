/**
 * What happens after an inbox item is confirmed, wherever it was confirmed
 * (triage card, batch, Edit form, From Inbox chip): remember the merchant's
 * category, tell listeners, and refresh the inbox.
 */

import { financeService } from "../../services/financeService";
import { queryClient } from "../queryClient";
import { storeLastSplit } from "../lastSplit";
import { dispatchInboxExpenseAdded } from "../capture/inboxExpense";
import { emitInboxEvent, type InboxEventMap } from "./inboxEvents";
import type { CreateExpenseInput, InboxItem, InboxItemsResult } from "../../types/finance";

export const INBOX_ITEMS_QUERY_KEY = ["finance", "inbox", "items", "pending"] as const;

/** Pending items left in the cached inbox list. */
export function cachedPendingCount(): number {
    const cached = queryClient.getQueryData<InboxItemsResult>(INBOX_ITEMS_QUERY_KEY);
    return cached?.items.length ?? 0;
}

export async function afterInboxConfirmed(params: {
    item: Pick<InboxItem, "id" | "merchant_key" | "suggested_category_id">;
    expenseId: string;
    input: CreateExpenseInput;
    via: InboxEventMap["inbox:item-confirmed"]["via"];
    guessedCategoryId: string | null;
    /** Pending items left; defaults to the cached list minus this item. */
    remaining?: number;
}): Promise<void> {
    const { item, expenseId, input, via, guessedCategoryId } = params;
    storeLastSplit(input.is_shared);
    dispatchInboxExpenseAdded(expenseId, input);

    const remaining =
        params.remaining ??
        (queryClient.getQueryData<InboxItemsResult>(INBOX_ITEMS_QUERY_KEY)?.items ?? []).filter(
            (i) => i.id !== item.id,
        ).length;

    emitInboxEvent("inbox:item-confirmed", {
        itemId: item.id,
        expenseId,
        amountSgd: input.amount,
        categoryId: input.category_id ?? null,
        usedSuggestion: Boolean(guessedCategoryId) && guessedCategoryId === (input.category_id ?? null),
        via,
        remaining,
    });

    // Remember merchant -> category (and Mine/Shared). Best effort.
    if (input.category_id) {
        try {
            await financeService.upsertMerchantRule({
                merchant_key: item.merchant_key,
                action: "categorise",
                category_id: input.category_id,
                is_shared: input.is_shared,
                hit_increment: 1,
            });
        } catch (err) {
            console.debug("Merchant rule not saved:", err);
        }
    }
}
