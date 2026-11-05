/**
 * Per-device Bubby state in one localStorage key (`bb_bubby_v1`).
 * Every access is wrapped in try/catch and the app works with an empty key.
 * "Seen" flags are per device on purpose: each partner gets their own
 * "Bubby grew!" moment.
 */

export const BUBBY_STORAGE_KEY = "bb_bubby_v1";

export type EquippedPrefs = Partial<Record<string, string | null>>;

export interface BubbySnapshot {
    stage: number;
    equipped: Record<string, string>;
}

export interface BubbyStore {
    /** Highest points ever derived on this device, so growth never regresses. */
    hwmPoints?: number;
    /** Stage index last celebrated on this device. */
    seenStage?: number;
    seenAccessories?: string[];
    /** Slot -> accessory id, or null when the user took the slot off. */
    equipped?: EquippedPrefs;
    /** Epoch ms of the last app-open greeting. */
    lastGreetingAt?: number;
    /** Monday (YYYY-MM-DD) of the last acknowledged weekly recap. */
    recapSeenWeek?: string;
    /** SGT dates the inbox reached zero on this device. */
    inboxZeroDays?: string[];
    /** Dedupe keys of milestones already celebrated (most recent last). */
    celebrated?: string[];
    /** Last rendered stage and equipped items, for components outside providers. */
    snapshot?: BubbySnapshot;
}

const MAX_CELEBRATED = 60;
const MAX_INBOX_ZERO_DAYS = 120;

export function readBubbyStore(): BubbyStore {
    try {
        if (typeof window === "undefined" || !window.localStorage) return {};
        const raw = window.localStorage.getItem(BUBBY_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? (parsed as BubbyStore) : {};
    } catch {
        return {};
    }
}

export function writeBubbyStore(store: BubbyStore): void {
    try {
        if (typeof window === "undefined" || !window.localStorage) return;
        window.localStorage.setItem(BUBBY_STORAGE_KEY, JSON.stringify(store));
    } catch {
        // Storage full or blocked: delight state is best-effort
    }
}

export function updateBubbyStore(
    patch: Partial<BubbyStore> | ((prev: BubbyStore) => Partial<BubbyStore>),
): BubbyStore {
    const prev = readBubbyStore();
    const changes = typeof patch === "function" ? patch(prev) : patch;
    const next = { ...prev, ...changes };
    writeBubbyStore(next);
    return next;
}

export function hasCelebrated(key: string): boolean {
    return (readBubbyStore().celebrated ?? []).includes(key);
}

export function markCelebrated(key: string): void {
    updateBubbyStore((prev) => {
        const list = (prev.celebrated ?? []).filter((k) => k !== key);
        list.push(key);
        return { celebrated: list.slice(-MAX_CELEBRATED) };
    });
}

export function addInboxZeroDay(date: string): void {
    updateBubbyStore((prev) => {
        const days = new Set(prev.inboxZeroDays ?? []);
        days.add(date);
        return {
            inboxZeroDays: Array.from(days).sort().slice(-MAX_INBOX_ZERO_DAYS),
        };
    });
}
