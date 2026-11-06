/**
 * One place for delight feedback, so the guardrails live together:
 * - sounds go through soundEffects (gated on the user's sound toggle)
 * - haptics go through `haptics` (gated on the toggle and reduced motion;
 *   a no-op on iOS Safari, which has no navigator.vibrate)
 * - confetti is skipped under prefers-reduced-motion
 * - at most one big celebration per 8s; extra ones degrade to a routine cue
 * - dedupe keys so a milestone plays once (e.g. inbox zero once a day)
 * - Bubby reactions are dispatched as `bubby:react`
 *
 * Nothing here awaits anything: callers fire it after their save resolves
 * and carry on closing or navigating.
 */

import { haptics } from "../haptics";
import {
    playChaChingSound,
    playSoftPop,
    playSuccessSound,
} from "../soundEffects";
import {
    emitAppEvent,
    type BubbyReaction,
    type MilestoneKind,
    type MilestoneToastAction,
} from "../appEvents";
import { hasCelebrated, markCelebrated } from "../bubby/storage";

export type RoutineKind =
    | "add"
    | "edit"
    | "delete"
    | "no-spend"
    | "triage"
    | "pet"
    | "goal-deposit"
    | "acknowledge"
    | "fab";

type HapticName = "tick" | "lightTap" | "success" | "celebrate" | "sweep" | "goalMilestone" | "destructive";
type SoundName = "chaChing" | "softPop" | "success";

interface Cue {
    haptic?: HapticName;
    sound?: SoundName;
    react?: BubbyReaction;
}

const ROUTINE_CUES: Record<RoutineKind, Cue> = {
    add: { haptic: "success", sound: "chaChing", react: "cheer" },
    edit: { haptic: "lightTap", sound: "softPop", react: "nod" },
    delete: { haptic: "destructive", react: "poof" },
    "no-spend": { haptic: "celebrate", sound: "chaChing", react: "munch" },
    triage: { haptic: "lightTap", sound: "softPop", react: "nod" },
    pet: { haptic: "lightTap", sound: "softPop", react: "pat" },
    "goal-deposit": { haptic: "goalMilestone", sound: "softPop", react: "cheer" },
    acknowledge: { sound: "softPop", react: "cheer" },
    fab: { haptic: "tick" },
};

interface MilestoneCue extends Cue {
    /** Big milestones get confetti and count towards the rate limit. */
    big: boolean;
}

const MILESTONE_CUES: Record<MilestoneKind, MilestoneCue> = {
    "inbox-zero": { haptic: "celebrate", sound: "success", react: "celebrate", big: true },
    "full-belly": { haptic: "celebrate", sound: "success", react: "pat", big: false },
    "weekly-treat": { haptic: "goalMilestone", sound: "success", react: "munch", big: false },
    "body-change": { haptic: "celebrate", sound: "success", react: "celebrate", big: true },
    reunion: { haptic: "celebrate", sound: "success", react: "reunion", big: false },
    "goal-complete": { haptic: "goalMilestone", sound: "success", react: "celebrate", big: true },
    sweep: { haptic: "sweep", sound: "chaChing", react: "celebrate", big: true },
};

export const BIG_CELEBRATION_COOLDOWN_MS = 8000;

let lastBigAt = -Infinity;
let lastMilestoneAt = -Infinity;

function now(): number {
    return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function prefersReducedMotion(): boolean {
    try {
        return (
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches
        );
    } catch {
        return false;
    }
}

function playSound(name: SoundName | undefined): void {
    if (!name) return;
    try {
        if (name === "chaChing") playChaChingSound();
        else if (name === "softPop") playSoftPop();
        else playSuccessSound();
    } catch (err) {
        console.debug("Feedback sound skipped:", err);
    }
}

function playHaptic(name: HapticName | undefined): void {
    if (!name) return;
    try {
        haptics[name]();
    } catch (err) {
        console.debug("Feedback haptic skipped:", err);
    }
}

function react(kind: BubbyReaction | undefined): void {
    if (!kind) return;
    emitAppEvent("bubby:react", { kind });
}

function runCue(cue: Cue): void {
    playHaptic(cue.haptic);
    playSound(cue.sound);
    react(cue.react);
}

export type MilestoneResult = "milestone" | "degraded" | "duplicate";

export interface MilestoneOptions {
    /** Celebrate once per key, across reloads (e.g. `inbox-zero:2026-11-05:mem-1`). */
    dedupeKey?: string;
    /** Toast copy. Without a title only the cue and confetti play. */
    title?: string;
    subtitle?: string;
    primary?: MilestoneToastAction;
    /** Override the big/lite tier (e.g. banking surplus without confetti). */
    big?: boolean;
}

export const feedback = {
    /** Everyday actions: subtle haptic, small sound, small Bubby reaction. */
    routine(kind: RoutineKind): void {
        runCue(ROUTINE_CUES[kind]);
    },

    /** Real milestones: chime, haptic, Bubby celebrate, optional confetti and toast. */
    milestone(kind: MilestoneKind, options: MilestoneOptions = {}): MilestoneResult {
        if (options.dedupeKey && hasCelebrated(options.dedupeKey)) {
            return "duplicate";
        }
        if (options.dedupeKey) markCelebrated(options.dedupeKey);

        const cue = MILESTONE_CUES[kind];
        const big = options.big ?? cue.big;
        const t = now();
        const rateLimited = big && t - lastBigAt < BIG_CELEBRATION_COOLDOWN_MS;
        lastMilestoneAt = t;

        if (rateLimited) {
            // A second big moment within 8s plays as a routine cue
            runCue({ haptic: "lightTap", sound: "softPop", react: "cheer" });
        } else {
            if (big) lastBigAt = t;
            runCue(cue);
        }

        emitAppEvent("delight:milestone", {
            kind,
            confetti: big && !rateLimited && !prefersReducedMotion(),
            title: options.title,
            subtitle: options.subtitle,
            primary: options.primary,
        });

        return rateLimited ? "degraded" : "milestone";
    },

    react,

    /** True if any milestone played in the last `ms` (used to skip the greeting). */
    hadRecentMilestone(ms: number): boolean {
        return now() - lastMilestoneAt < ms;
    },
};

/** Test helper: reset the rate limiter. */
export function resetFeedbackState(): void {
    lastBigAt = -Infinity;
    lastMilestoneAt = -Infinity;
}
