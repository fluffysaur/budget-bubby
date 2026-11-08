/**
 * Per-device Bubby state in one localStorage key (`bb_bubby_v2`).
 * Every access is wrapped in try/catch and the app works with an empty key.
 *
 * Only things with no table behind them live here: petting, local exercise
 * records (goal adds, month-end actions, recap reads, inbox clears), the
 * snack collection, and "already celebrated" flags. Food comes from data.
 */

export const BUBBY_STORAGE_KEY = "bb_bubby_v2";

/** Local exercise records: SGT dates the action happened on this device. */
export type LocalExerciseKind =
    "inbox-clear" | "balances" | "goal-add" | "month-end" | "recap-read";

export interface SnackEntry {
    id: string;
    /** Monday (YYYY-MM-DD) of the week it was earned. */
    week: string;
}

export interface BubbySnapshot {
    body: string;
    mood: string;
}

export interface BubbyStore {
    /** memberId -> SGT dates this member petted Bubby (on this device). */
    petDays?: Record<string, string[]>;
    exercise?: Partial<Record<LocalExerciseKind, string[]>>;
    snacks?: SnackEntry[];
    /** Body and mood last shown on this device (for change and reunion moments). */
    lastBody?: string;
    lastMood?: string;
    /** Epoch ms of the last app-open greeting. */
    lastGreetingAt?: number;
    /** Monday (YYYY-MM-DD) of the last acknowledged weekly recap. */
    recapSeenWeek?: string;
    /** Dedupe keys of moments already celebrated (most recent last). */
    celebrated?: string[];
    /** Last rendered look, for components outside the providers (save toast). */
    snapshot?: BubbySnapshot;
}

const MAX_CELEBRATED = 80;
const MAX_DAYS = 120;

export function readBubbyStore(): BubbyStore {
    try {
        if (typeof window === "undefined" || !window.localStorage) return {};
        const raw = window.localStorage.getItem(BUBBY_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object"
            ? (parsed as BubbyStore)
            : {};
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

function addDay(list: string[] | undefined, date: string): string[] {
    const days = new Set(list ?? []);
    days.add(date);
    return Array.from(days).sort().slice(-MAX_DAYS);
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

export function addLocalExercise(kind: LocalExerciseKind, date: string): void {
    updateBubbyStore((prev) => ({
        exercise: {
            ...(prev.exercise ?? {}),
            [kind]: addDay(prev.exercise?.[kind], date),
        },
    }));
}

export function addPetDay(memberId: string, date: string): void {
    updateBubbyStore((prev) => ({
        petDays: {
            ...(prev.petDays ?? {}),
            [memberId]: addDay(prev.petDays?.[memberId], date),
        },
    }));
}

export function addSnack(entry: SnackEntry): void {
    updateBubbyStore((prev) => {
        const snacks = prev.snacks ?? [];
        if (snacks.some((s) => s.week === entry.week)) return {};
        return { snacks: [...snacks, entry] };
    });
}
