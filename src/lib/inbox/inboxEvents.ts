/**
 * Inbox and logging events for the delight layer (feat/delight-bubby).
 * Typed wrappers over window CustomEvents, like the existing openQuickAdd.
 *
 * Celebrate only on `inbox:cleared` and `day:logged` with firstForDate,
 * never per confirmed item, so triage stays fast.
 */

export interface InboxEventMap {
    /** The pending count went up since the user last saw it. */
    "inbox:items-arrived": { newCount: number; pendingCount: number };
    "inbox:item-confirmed": {
        itemId: string;
        expenseId: string;
        amountSgd: number;
        categoryId: string | null;
        /** The confirmed category was the guess. */
        usedSuggestion: boolean;
        via: "swipe" | "button" | "batch" | "edit";
        /** Pending items left after this one. */
        remaining: number;
    };
    "inbox:item-discarded": {
        itemId: string;
        reason: "discarded" | "duplicate";
        remaining: number;
    };
    /** Inbox Zero: pending went from > 0 to 0 within one triage session. */
    "inbox:cleared": { clearedCount: number; durationMs: number; date: string };
    /**
     * A member's SGT date now has a daily_checkins row. Captured-but-unsorted
     * items don't count; confirming counts for the purchase date.
     */
    "day:logged": {
        memberId: string;
        date: string;
        source: "expense" | "inbox" | "no_spend";
        /** No check-in was cached for this member and date before. */
        firstForDate: boolean;
    };
}

export type InboxEventType = keyof InboxEventMap;

export function emitInboxEvent<T extends InboxEventType>(type: T, detail: InboxEventMap[T]): void {
    if (typeof window === "undefined") return;
    try {
        window.dispatchEvent(new CustomEvent(type, { detail }));
    } catch {
        // Listeners must never break saving
    }
}

/** Returns an unsubscribe function. */
export function onInboxEvent<T extends InboxEventType>(
    type: T,
    handler: (detail: InboxEventMap[T]) => void,
): () => void {
    if (typeof window === "undefined") return () => {};
    const listener = (e: Event) => handler((e as CustomEvent<InboxEventMap[T]>).detail);
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
}

/** Tracks one triage session and reports Inbox Zero once. */
export class InboxSessionTracker {
    private startCount: number | null = null;
    private startedAt = 0;
    private clearedFired = false;

    constructor(private readonly now: () => number = Date.now) {}

    /** Call whenever the pending count is known. Returns true when it emitted `inbox:cleared`. */
    update(pendingCount: number, date: string): boolean {
        if (this.startCount === null || (this.clearedFired && pendingCount > 0)) {
            if (pendingCount === 0) return false;
            this.startCount = pendingCount;
            this.startedAt = this.now();
            this.clearedFired = false;
            return false;
        }
        if (pendingCount > this.startCount) this.startCount = pendingCount;
        if (pendingCount === 0 && !this.clearedFired) {
            this.clearedFired = true;
            emitInboxEvent("inbox:cleared", {
                clearedCount: this.startCount,
                durationMs: this.now() - this.startedAt,
                date,
            });
            return true;
        }
        return false;
    }
}

export const INBOX_LAST_SEEN_KEY = "bb_inbox_last_seen_v1";

/** Emits `inbox:items-arrived` when the count rose since last seen. */
export function noteInboxCount(pendingCount: number): void {
    let lastSeen: number | null = null;
    try {
        const raw = window.localStorage.getItem(INBOX_LAST_SEEN_KEY);
        lastSeen = raw === null ? null : Number(raw);
    } catch {
        // Storage unavailable: treat as first visit
    }
    if (lastSeen !== null && Number.isFinite(lastSeen) && pendingCount > lastSeen) {
        emitInboxEvent("inbox:items-arrived", {
            newCount: pendingCount - lastSeen,
            pendingCount,
        });
    }
    try {
        window.localStorage.setItem(INBOX_LAST_SEEN_KEY, String(pendingCount));
    } catch {
        // Ignore
    }
}
