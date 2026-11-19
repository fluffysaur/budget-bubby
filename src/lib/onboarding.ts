/**
 * Per-device onboarding guide state (`bb_onboarding_v1`).
 * Tracks whether the first-launch guide has been seen, which starter tasks
 * have been completed, and whether the welcome Bubby snack has been granted.
 */

import { emitAppEvent } from "./appEvents";
import { addSnack } from "./bubby/storage";
import { feedback } from "./delight/feedback";

export const ONBOARDING_STORAGE_KEY = "bb_onboarding_v1";

export type OnboardingTaskId = "budget" | "spend" | "plan" | "bubby";

export interface OnboardingTaskDef {
    id: OnboardingTaskId;
    label: string;
    description: string;
}

export interface OnboardingTask extends OnboardingTaskDef {
    done: boolean;
}

export interface OnboardingStore {
    seen?: boolean;
    completedTasks?: OnboardingTaskId[];
    rewarded?: boolean;
}

export const ONBOARDING_SNACK = {
    id: "fish",
    week: "onboarding",
} as const;

export const ONBOARDING_TASK_DEFS: readonly OnboardingTaskDef[] = [
    {
        id: "budget",
        label: "Check Budget",
        description: "Set take-home flow and category caps",
    },
    {
        id: "spend",
        label: "Explore Spend",
        description: "Log an expense or sort your inbox",
    },
    {
        id: "plan",
        label: "Review Plan",
        description: "Track goals, bills, and card statements",
    },
    {
        id: "bubby",
        label: "Meet Bubby",
        description: "Pet Bubby or check daily quests",
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
}

export function getOnboardingTasks(
    store: OnboardingStore = readOnboardingStore(),
): OnboardingTask[] {
    const doneSet = new Set(store.completedTasks ?? []);
    return ONBOARDING_TASK_DEFS.map((def) => ({
        ...def,
        done: doneSet.has(def.id),
    }));
}

export function isOnboardingRewarded(
    store: OnboardingStore = readOnboardingStore(),
): boolean {
    return Boolean(store.rewarded);
}

function maybeGrantOnboardingReward(store: OnboardingStore): {
    store: OnboardingStore;
    rewardedNow: boolean;
} {
    const doneSet = new Set(store.completedTasks ?? []);
    const allComplete = ONBOARDING_TASK_DEFS.every((def) =>
        doneSet.has(def.id),
    );
    if (!allComplete || store.rewarded) {
        return { store, rewardedNow: false };
    }

    const updated = updateOnboardingStore({ rewarded: true });
    addSnack({ ...ONBOARDING_SNACK });
    emitAppEvent("bubby:store-changed", {});
    feedback.milestone("weekly-treat", {
        dedupeKey: "onboarding-snack",
        title: "Treat: Fish!",
        subtitle: "Starter tasks done",
        primary: { label: "See Bubby", event: "bubby:open-sheet" },
    });
    return { store: updated, rewardedNow: true };
}

export function completeOnboardingTask(id: OnboardingTaskId): {
    tasks: OnboardingTask[];
    rewardedNow: boolean;
} {
    const prev = readOnboardingStore();
    const set = new Set<OnboardingTaskId>(prev.completedTasks ?? []);
    if (set.has(id)) {
        const res = maybeGrantOnboardingReward(prev);
        return {
            tasks: getOnboardingTasks(res.store),
            rewardedNow: res.rewardedNow,
        };
    }
    set.add(id);
    const next = updateOnboardingStore({
        completedTasks: Array.from(set),
    });
    const res = maybeGrantOnboardingReward(next);
    return {
        tasks: getOnboardingTasks(res.store),
        rewardedNow: res.rewardedNow,
    };
}

export function toggleOnboardingTask(id: OnboardingTaskId): {
    tasks: OnboardingTask[];
    rewardedNow: boolean;
} {
    const prev = readOnboardingStore();
    const set = new Set<OnboardingTaskId>(prev.completedTasks ?? []);
    if (set.has(id)) {
        set.delete(id);
    } else {
        set.add(id);
    }
    const next = updateOnboardingStore({
        completedTasks: Array.from(set),
    });
    const res = maybeGrantOnboardingReward(next);
    return {
        tasks: getOnboardingTasks(res.store),
        rewardedNow: res.rewardedNow,
    };
}
