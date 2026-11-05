/**
 * The shared household Bubby: check-ins -> growth, mood, accessories, and
 * the latest transient reaction.
 *
 * One `daily_checkins` query for all members (shared with StreakChip). It
 * refetches on focus at most once a minute so the partner's logs show up
 * when the app resumes. Pacing reads the cached household budget only, so
 * Bubby adds no requests on open.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { financeService } from "../services/financeService";
import { queryKeys, useBudgetDetailQuery } from "./useFinanceQueries";
import { useLoggedInMember } from "./useLoggedInMember";
import { onAppEvent, emitAppEvent, type BubbyReaction } from "../lib/appEvents";
import {
    deriveBubbyState,
    HATCHLING_STAGE,
    STAGES,
    type BubbyState,
    type StageDef,
} from "../lib/bubby/growth";
import {
    computePace,
    deriveBaseMood,
    REACTION_MS,
    type BubbyMood,
} from "../lib/bubby/moods";
import {
    getUnlocked,
    resolveEquipped,
    type AccessoryId,
    type AccessorySlot,
    type UnlockInputs,
} from "../lib/bubby/accessories";
import { readBubbyStore, updateBubbyStore } from "../lib/bubby/storage";
import {
    daysInMonthOf,
    sgtMinutesOfDay,
    timeToMinutes,
    toSgtDateString,
} from "../lib/bubby/dates";
import { DEFAULT_CHECKIN_TIME } from "../lib/reminders/rules";
import type { DailyCheckin, HouseholdMember } from "../types/finance";

const EMPTY_CHECKINS: DailyCheckin[] = [];
const DEFAULT_CHECKIN_MINUTES = timeToMinutes(DEFAULT_CHECKIN_TIME) ?? 18 * 60;

/** The member's check-in reminder time, from the cached notification prefs. */
function readCheckinMinutes(memberId: string | undefined): number {
    if (!memberId) return DEFAULT_CHECKIN_MINUTES;
    try {
        const raw = window.localStorage.getItem(`bb_notif_prefs_${memberId}`);
        const parsed = raw ? JSON.parse(raw) : null;
        return timeToMinutes(parsed?.checkin_time) ?? DEFAULT_CHECKIN_MINUTES;
    } catch {
        return DEFAULT_CHECKIN_MINUTES;
    }
}

/** SGT date and minute-of-day, refreshed every minute and on resume. */
export function useSgtClock(): { today: string; minutes: number } {
    const read = () => ({ today: toSgtDateString(), minutes: sgtMinutesOfDay() });
    const [clock, setClock] = useState(read);

    useEffect(() => {
        const tick = () =>
            setClock((prev) => {
                const next = read();
                return next.today === prev.today && next.minutes === prev.minutes ? prev : next;
            });
        const id = window.setInterval(tick, 60_000);
        const onVisible = () => {
            if (document.visibilityState === "visible") tick();
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => {
            window.clearInterval(id);
            document.removeEventListener("visibilitychange", onVisible);
        };
    }, []);

    return clock;
}

/** Latest Bubby reaction, cleared after its (≤400ms) animation. */
export function useBubbyReaction(stage: number): BubbyReaction | null {
    const [reaction, setReaction] = useState<{ kind: BubbyReaction; id: number } | null>(null);

    useEffect(() => {
        let timer: number | undefined;
        let seq = 0;
        const off = onAppEvent("bubby:react", ({ kind }) => {
            // Eggs respond to everything with a wiggle
            const shown: BubbyReaction = stage < HATCHLING_STAGE ? "wiggle" : kind;
            seq += 1;
            setReaction({ kind: shown, id: seq });
            window.clearTimeout(timer);
            timer = window.setTimeout(() => setReaction(null), REACTION_MS[shown]);
        });
        return () => {
            off();
            window.clearTimeout(timer);
        };
    }, [stage]);

    return reaction?.kind ?? null;
}

export interface UseBubbyResult {
    isReady: boolean;
    state: BubbyState;
    stage: number;
    stageDef: StageDef;
    mood: BubbyMood;
    reaction: BubbyReaction | null;
    equipped: Partial<Record<AccessorySlot, AccessoryId>>;
    unlocked: AccessoryId[];
    unlockInputs: UnlockInputs;
    me: HouseholdMember | null;
    partner: HouseholdMember | null;
    members: HouseholdMember[];
    checkins: DailyCheckin[];
    today: string;
    equip: (slot: AccessorySlot, id: AccessoryId | null) => void;
}

export function useBubby(): UseBubbyResult {
    const { me, members } = useLoggedInMember();
    const { today, minutes } = useSgtClock();
    // Per-device store; refreshed whenever this device changes it
    const [store, setStore] = useState(readBubbyStore);

    const { data, isSuccess } = useQuery<DailyCheckin[]>({
        queryKey: queryKeys.dailyCheckins(),
        queryFn: () => financeService.getDailyCheckins(),
        staleTime: 60_000,
        refetchOnWindowFocus: true,
    });
    const checkins = data ?? EMPTY_CHECKINS;

    const memberIds = useMemo(() => members.map((m) => m.id), [members]);
    const month = today.slice(0, 7);
    // Cache-only read of the household budget (Home fills it)
    const { data: budget } = useBudgetDetailQuery(month, "household", undefined, memberIds, {
        enabled: false,
    });

    useEffect(
        () => onAppEvent("bubby:prefs-changed", () => setStore(readBubbyStore())),
        [],
    );

    const state = useMemo(
        () => deriveBubbyState(checkins, memberIds, today, store.hwmPoints ?? 0),
        [checkins, memberIds, today, store.hwmPoints],
    );

    const unlockInputs = useMemo<UnlockInputs>(
        () => ({
            stage: state.stage,
            points: state.points,
            longestCoupleStreak: state.longestCoupleStreak,
            maxHouseholdDaysInMonth: state.maxHouseholdDaysInMonth,
            inboxZeroDays: store.inboxZeroDays?.length ?? 0,
        }),
        [state, store.inboxZeroDays],
    );
    const unlocked = useMemo(() => getUnlocked(unlockInputs), [unlockInputs]);
    const equipped = useMemo(
        () => resolveEquipped(unlocked, store.equipped),
        [unlocked, store.equipped],
    );

    const pace = useMemo(() => {
        if (!budget) return null;
        const day = Number(today.slice(8, 10));
        return computePace(
            budget.spendableSpent ?? 0,
            budget.spendableAllocated ?? 0,
            day,
            daysInMonthOf(today),
        );
    }, [budget, today]);

    const checkinMinutes = useMemo(() => readCheckinMinutes(me?.id), [me?.id]);
    const mood = useMemo(
        () => deriveBaseMood(state, pace, minutes, checkinMinutes),
        [state, pace, minutes, checkinMinutes],
    );
    const reaction = useBubbyReaction(state.stage);

    const partner = useMemo(
        () => members.find((m) => m.id !== me?.id) ?? null,
        [members, me],
    );

    const equip = useCallback((slot: AccessorySlot, id: AccessoryId | null) => {
        updateBubbyStore((prev) => ({ equipped: { ...(prev.equipped ?? {}), [slot]: id } }));
        emitAppEvent("bubby:prefs-changed", {});
    }, []);

    return {
        isReady: isSuccess,
        state,
        stage: state.stage,
        stageDef: STAGES[state.stage],
        mood,
        reaction,
        equipped,
        unlocked,
        unlockInputs,
        me,
        partner,
        members,
        checkins,
        today,
        equip,
    };
}
