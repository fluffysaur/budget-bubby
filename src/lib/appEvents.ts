/**
 * Typed app-wide events over `window` CustomEvents.
 *
 * Same mechanism as the existing `expenseAdded` / `openQuickAdd` events, so a
 * plain `window.dispatchEvent(new CustomEvent("inbox:cleared", { detail }))`
 * is picked up by the same listeners. Prefer the typed helpers below.
 *
 * The inbox events follow docs/plans/capture-inbox.md §10.2. `emitLoggingEvent`
 * and `onLoggingEvent` are aliases with the names that plan uses.
 */

import type { Expense } from "../types/finance";

/** Transient Bubby reactions (≤400ms each). */
export type BubbyReaction =
    | "cheer"
    | "nod"
    | "poof"
    | "wave"
    | "munch"
    | "pat"
    | "reunion"
    | "celebrate";

export type ExpenseAddedSource = "form" | "bulk" | "inbox" | "fast-log";

/** `expenseAdded` detail: the created expense, plus where it came from. */
export type ExpenseAddedDetail = Expense & { source?: ExpenseAddedSource };

export type MilestoneKind =
    | "inbox-zero"
    | "full-belly"
    | "weekly-treat"
    | "body-change"
    | "reunion"
    | "goal-complete"
    | "sweep"
    | "bill-paid";

export interface MilestoneToastAction {
    label: string;
    /** App event to dispatch when tapped (keeps toasts serialisable). */
    event?: "bubby:open-sheet";
}

export interface MilestoneDetail {
    kind: MilestoneKind;
    /** Full-screen confetti (already false under reduced motion or rate limit). */
    confetti: boolean;
    title?: string;
    subtitle?: string;
    primary?: MilestoneToastAction;
}

export interface AppEventMap {
    expenseAdded: ExpenseAddedDetail;
    "bubby:react": { kind: BubbyReaction };
    "bubby:open-sheet": Record<string, never>;
    /** Local Bubby state (petting, exercise, snacks) changed on this device. */
    "bubby:store-changed": Record<string, never>;
    "delight:milestone": MilestoneDetail;
    "inbox:items-arrived": { newCount: number; pendingCount: number };
    "inbox:item-confirmed": {
        itemId: string;
        expenseId: string;
        amountSgd: number;
        categoryId: string | null;
        usedSuggestion: boolean;
        via: "swipe" | "button" | "batch" | "edit";
        remaining: number;
    };
    "inbox:item-discarded": {
        itemId: string;
        reason: "discarded" | "duplicate";
        remaining: number;
    };
    "inbox:cleared": { clearedCount: number; durationMs: number; date: string };
    "day:logged": {
        memberId: string;
        date: string;
        source: "expense" | "inbox" | "no_spend";
        firstForDate: boolean;
    };
}

export type AppEventType = keyof AppEventMap;

export function emitAppEvent<K extends AppEventType>(
    type: K,
    detail: AppEventMap[K],
): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(type, { detail }));
}

/** Subscribe to an app event. Returns an unsubscribe function. */
export function onAppEvent<K extends AppEventType>(
    type: K,
    handler: (detail: AppEventMap[K]) => void,
): () => void {
    if (typeof window === "undefined") return () => {};
    const listener = (e: Event) => {
        handler((e as CustomEvent<AppEventMap[K]>).detail);
    };
    window.addEventListener(type, listener);
    return () => window.removeEventListener(type, listener);
}

/** Aliases with the names used in docs/plans/capture-inbox.md. */
export const emitLoggingEvent = emitAppEvent;
export const onLoggingEvent = onAppEvent;
