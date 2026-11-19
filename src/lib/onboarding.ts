/**
 * Per-device & per-member onboarding state (`bb_onboarding_v1`).
 * Tracks:
 * - Whether the first-launch Welcome Guide modal has been seen
 * - Completed starter quest visits (`budget`, `plan`) per member, combined
 *   with individual real-data signals
 * - Per-member Bubby hatch state (synced to `household_members.bubby_hatched_at`
 *   with a local optimistic cache in `hatchedByMember`)
 */

import { emitAppEvent } from "./appEvents";
import { addSnack } from "./bubby/storage";
import { feedback } from "./delight/feedback";

export const ONBOARDING_STORAGE_KEY = "bb_onboarding_v1";

/**
 * Dev-only `?debug=onboarding` flag: lets developers replay the first-launch
 * Welcome Guide and fresh 0/4 Starter Quests on localhost without touching
 * Supabase. Append `&ready=1` to pre-fill 4/4 and jump straight to hatching.
 */
export function isOnboardingDebugMode(): boolean {
    if (!import.meta.env.DEV || typeof window === "undefined") return false;
    return (
        new URLSearchParams(window.location.search).get("debug") ===
        "onboarding"
    );
}

export function isOnboardingDebugReady(): boolean {
    if (!isOnboardingDebugMode()) return false;
    return new URLSearchParams(window.location.search).get("ready") === "1";
}

let debugResetApplied = false;

/** Clears local onboarding state once per page load when `?debug=onboarding` is set. */
export function applyOnboardingDebugReset(): void {
    if (debugResetApplied || !isOnboardingDebugMode()) return;
    debugResetApplied = true;
    try {
        window.localStorage.removeItem(ONBOARDING_STORAGE_KEY);
    } catch {
        // Best-effort reset
    }
}

export type OnboardingTaskId = "budget" | "account" | "expense" | "plan";

export interface OnboardingTaskDef {
    id: OnboardingTaskId;
    label: string;
    description: string;
}

export interface OnboardingTask extends OnboardingTaskDef {
    done: boolean;
}

export interface OnboardingQuestSignals {
    hasBudget?: boolean;
    hasAccount?: boolean;
    hasExpense?: boolean;
    hasPlan?: boolean;
}

export interface OnboardingStore {
    seen?: boolean;
    /** Legacy/unscoped task visits (used when memberId is not yet known). */
    completedTasks?: OnboardingTaskId[];
    /** Per-member task visits so partners track their own starter quests. */
    completedTasksByMember?: Record<string, OnboardingTaskId[]>;
    /** Legacy/global hatched flag (also used by test suites to seed hatched state). */
    hatched?: boolean;
    /** Per-member hatch ISO timestamps (optimistic local cache of `bubby_hatched_at`). */
    hatchedByMember?: Record<string, string>;
    rewarded?: boolean;
}

export const ONBOARDING_SNACK = {
    id: "fish",
    week: "onboarding",
} as const;

export const ONBOARDING_TASK_DEFS: readonly OnboardingTaskDef[] = [
    {
        id: "budget",
        label: "Set up Budget",
        description: "Set your take-home flow and category caps",
    },
    {
        id: "account",
        label: "Add an Account",
        description: "Track your bank account or balance",
    },
    {
        id: "expense",
        label: "Log First Expense",
        description: "Add a spend item or check in",
    },
    {
        id: "plan",
        label: "Explore Plan",
        description: "Check goals, bills, and card statements",
    },
];

export function readOnboardingStore(): OnboardingStore {
    try {
        if (typeof window === "undefined" || !window.localStorage) return {};
        const raw = window.localStorage.getItem(ONBOARDING_STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object"
            ? (parsed as OnboardingStore)
            : {};
    } catch {
        return {};
    }
}

export function writeOnboardingStore(store: OnboardingStore): void {
    try {
        if (typeof window === "undefined" || !window.localStorage) return;
        window.localStorage.setItem(
            ONBOARDING_STORAGE_KEY,
            JSON.stringify(store),
        );
    } catch {
        // Best-effort persistence
    }
}

export function updateOnboardingStore(
    patch:
        | Partial<OnboardingStore>
        | ((prev: OnboardingStore) => Partial<OnboardingStore>),
): OnboardingStore {
    const prev = readOnboardingStore();
    const changes = typeof patch === "function" ? patch(prev) : patch;
    const next = { ...prev, ...changes };
    writeOnboardingStore(next);
    return next;
}

export function isFirstLaunch(): boolean {
    return !readOnboardingStore().seen;
}

export function markOnboardingSeen(): void {
    updateOnboardingStore({ seen: true });
    emitAppEvent("onboarding:changed", {});
}

export function isMemberBubbyHatched(
    memberId?: string,
    dbHatchedAt?: string | null,
    store: OnboardingStore = readOnboardingStore(),
): boolean {
    if (dbHatchedAt && !isOnboardingDebugMode()) return true;
    if (store.hatched) return true;
    if (memberId && store.hatchedByMember?.[memberId]) return true;
    return false;
}

export function isBubbyHatched(
    store: OnboardingStore = readOnboardingStore(),
    memberId?: string,
    dbHatchedAt?: string | null,
): boolean {
    return isMemberBubbyHatched(memberId, dbHatchedAt, store);
}

export function isOnboardingRewarded(
    store: OnboardingStore = readOnboardingStore(),
): boolean {
    return Boolean(store.rewarded);
}

export function getOnboardingTasks(
    store: OnboardingStore = readOnboardingStore(),
    signals: OnboardingQuestSignals = {},
    memberId?: string,
): OnboardingTask[] {
    const memberTasks = memberId
        ? (store.completedTasksByMember?.[memberId] ?? [])
        : [];
    const doneSet = new Set<OnboardingTaskId>([
        ...(store.completedTasks ?? []),
        ...memberTasks,
    ]);
    return ONBOARDING_TASK_DEFS.map((def) => {
        const signalDone =
            (def.id === "budget" && Boolean(signals.hasBudget)) ||
            (def.id === "account" && Boolean(signals.hasAccount)) ||
            (def.id === "expense" && Boolean(signals.hasExpense)) ||
            (def.id === "plan" && Boolean(signals.hasPlan));
        return {
            ...def,
            done: doneSet.has(def.id) || signalDone,
        };
    });
}

export function completeOnboardingTask(
    id: OnboardingTaskId,
    memberId?: string,
): OnboardingTask[] {
    const prev = readOnboardingStore();
    if (memberId) {
        const existing = prev.completedTasksByMember?.[memberId] ?? [];
        const set = new Set<OnboardingTaskId>(existing);
        if (set.has(id)) {
            return getOnboardingTasks(prev, {}, memberId);
        }
        set.add(id);
        const next = updateOnboardingStore({
            completedTasksByMember: {
                ...(prev.completedTasksByMember ?? {}),
                [memberId]: Array.from(set),
            },
        });
        emitAppEvent("onboarding:changed", {});
        return getOnboardingTasks(next, {}, memberId);
    }

    const set = new Set<OnboardingTaskId>(prev.completedTasks ?? []);
    if (set.has(id)) {
        return getOnboardingTasks(prev);
    }
    set.add(id);
    const next = updateOnboardingStore({
        completedTasks: Array.from(set),
    });
    emitAppEvent("onboarding:changed", {});
    return getOnboardingTasks(next);
}

/**
 * Hatches ONLY the given member's Bubby (falling back to global flag when
 * memberId is omitted), awards the welcome Fish snack once, and triggers the
 * celebration milestone.
 */
export function hatchBubby(memberId?: string): {
    hatchedNow: boolean;
    rewardedNow: boolean;
} {
    const prev = readOnboardingStore();
    const alreadyHatched = memberId
        ? Boolean(prev.hatchedByMember?.[memberId] || prev.hatched)
        : Boolean(prev.hatched);
    if (alreadyHatched) {
        return { hatchedNow: false, rewardedNow: false };
    }

    const now = new Date().toISOString();
    const rewardedNow = !prev.rewarded;

    if (memberId) {
        updateOnboardingStore({
            hatchedByMember: {
                ...(prev.hatchedByMember ?? {}),
                [memberId]: now,
            },
            rewarded: true,
        });
    } else {
        updateOnboardingStore({ hatched: true, rewarded: true });
    }

    if (rewardedNow) {
        addSnack({ ...ONBOARDING_SNACK });
        emitAppEvent("bubby:store-changed", {});
    }
    emitAppEvent("onboarding:changed", {});

    feedback.milestone("weekly-treat", {
        dedupeKey: `onboarding-hatch-${memberId ?? "local"}`,
        title: "Bubby Hatched!",
        subtitle: "Welcome Fish snack unlocked",
        primary: { label: "See Bubby", event: "bubby:open-sheet" },
    });

    return { hatchedNow: true, rewardedNow };
}
