/**
 * Per-device Bubby state in one localStorage key (`bb_bubby_v2`).
 * Every access is wrapped in try/catch and the app works with an empty key.
 *
 * Only things with no table behind them live here: petting (who petted,
 * and which penguins they tapped), local exercise (and who did it)
 * records (goal adds, month-end actions, recap reads, inbox clears), the
 * snack collection, and "already celebrated" flags. Food comes from data.
 */

export const BUBBY_STORAGE_KEY = "bb_bubby_v2";

/** Local exercise records: SGT dates the action happened on this device. */
export type LocalExerciseKind =
    | "inbox-clear"
    | "balances"
    | "goal-add"
    | "month-end"
    | "recap-read";

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
    /** `${petterId}|${date}` -> penguins petted (missing: their own). */
    petTargets?: Record<string, string[]>;
    exercise?: Partial<Record<LocalExerciseKind, string[]>>;
    /** Who did each local exercise: kind -> date -> memberIds. */
    exerciseBy?: Partial<Record<LocalExerciseKind, Record<string, string[]>>>;
    snacks?: SnackEntry[];
    /** Your penguin's body and mood last shown here (change and reunion moments). */
    lastBody?: string;
    /** memberId -> their penguin's body last shown on this device. */
    lastBodies?: Record<string, string>;
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

/** Keep only entries whose date is still in the retained days. */
function pruneByDate<T>(
    map: Record<string, T> | undefined,
    keep: readonly string[],
): Record<string, T> {
    const days = new Set(keep);
    return Object.fromEntries(
        Object.entries(map ?? {}).filter(([date]) => days.has(date)),
    );
}

export function addLocalExercise(
    kind: LocalExerciseKind,
    date: string,
    memberId?: string | null,
): void {
    updateBubbyStore((prev) => {
        const days = addDay(prev.exercise?.[kind], date);
        const by = pruneByDate(prev.exerciseBy?.[kind], days);
        if (memberId) {
            by[date] = Array.from(new Set([...(by[date] ?? []), memberId]));
        }
        return {
            exercise: { ...(prev.exercise ?? {}), [kind]: days },
            exerciseBy: { ...(prev.exerciseBy ?? {}), [kind]: by },
        };
    });
}

/** `petterId` petted these penguins today: pet credit for each, once a day. */
export function addPet(
    petterId: string,
    penguinIds: readonly string[],
    date: string,
): void {
    updateBubbyStore((prev) => {
        const days = addDay(prev.petDays?.[petterId], date);
        const key = `${petterId}|${date}`;
        // Drop targets for days that aged out of each petter's list
        const targets = Object.fromEntries(
            Object.entries(prev.petTargets ?? {}).filter(([k]) => {
                const [who, day] = k.split("|");
                const kept = who === petterId ? days : prev.petDays?.[who];
                return (kept ?? []).includes(day);
            }),
        );
        // A day with no targets recorded was a pet of their own penguin
        const had =
            targets[key] ??
            ((prev.petDays?.[petterId] ?? []).includes(date) ? [petterId] : []);
        targets[key] = Array.from(new Set([...had, ...penguinIds]));
        return {
            petDays: { ...(prev.petDays ?? {}), [petterId]: days },
            petTargets: targets,
        };
    });
}

export function addPetDay(memberId: string, date: string): void {
    addPet(memberId, [memberId], date);
}

export function addSnack(entry: SnackEntry): void {
    updateBubbyStore((prev) => {
        const snacks = prev.snacks ?? [];
        if (snacks.some((s) => s.week === entry.week)) return {};
        return { snacks: [...snacks, entry] };
    });
}
