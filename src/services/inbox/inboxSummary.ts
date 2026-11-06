import { convertToSGD } from "../../lib/currencyConverter";
import type { InboxItem, InboxSummary } from "../../types/finance";

export const UNAVAILABLE_INBOX_SUMMARY: InboxSummary = {
    available: false,
    pendingCount: 0,
    pendingTotalSgd: 0,
    oldestCapturedAt: null,
};

/** Approximate SGD value of an inbox item, from cached FX rates. */
export function inboxItemSgd(item: Pick<InboxItem, "amount" | "currency">): number {
    return convertToSGD(Number(item.amount), item.currency).amountInSGD;
}

/** Summary of pending items (callers pass pending items only). */
export function summarizeInbox(
    pending: Pick<InboxItem, "amount" | "currency" | "captured_at">[],
): InboxSummary {
    let total = 0;
    let oldest: string | null = null;
    for (const item of pending) {
        total += inboxItemSgd(item);
        if (!oldest || item.captured_at < oldest) oldest = item.captured_at;
    }
    return {
        available: true,
        pendingCount: pending.length,
        pendingTotalSgd: Math.round(total * 100) / 100,
        oldestCapturedAt: oldest,
    };
}
