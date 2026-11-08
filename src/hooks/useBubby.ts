/**
 * The shared household Bubby: feed events -> body, mood, quests, snacks,
 * and the latest transient reaction.
 *
 * Reads the shared check-ins query (refetched on focus at most once a
 * minute, so the partner's logs show up on resume), this and last month's
 * expenses, and account snapshots. Petting, local exercise records and
 * snacks come from bb_bubby_v2.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { financeService } from "../services/financeService";
import {
    queryKeys,
    useAccountSnapshotsQuery,
    useExpensesQuery,
} from "./useFinanceQueries";
import { useLoggedInMember } from "./useLoggedInMember";
import { onAppEvent, emitAppEvent, type BubbyReaction } from "../lib/appEvents";
import { collectFeedEvents, type BonusEventLike } from "../lib/bubby/sources";
import {
    deriveCondition,
    type BubbyBody,
    type BubbyCondition,
    type BubbyMood,
} from "../lib/bubby/body";
import { dailyQuests, weeklyQuests, type Quest } from "../lib/bubby/quests";
import { REACTION_MS } from "../lib/bubby/moods";
import {
    addPetDay,
    readBubbyStore,
    type SnackEntry,
} from "../lib/bubby/storage";
import {
    addDays,
    sgtMinutesOfDay,
    timeToMinutes,
    toSgtDateString,
} from "../lib/bubby/dates";
import { getInboxPending } from "../lib/delight/inboxState";
import { feedback } from "../lib/delight/feedback";
import { DEFAULT_CHECKIN_TIME } from "../lib/reminders/rules";
import type {
    AccountSnapshot,
    DailyCheckin,
    Expense,
    HouseholdMember,
} from "../types/finance";

const EMPTY_CHECKINS: DailyCheckin[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_SNAPSHOTS: AccountSnapshot[] = [];
const NO_BONUS_EVENTS: BonusEventLike[] = [];
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

/**
 * Bonus entries feed Bubby once feat/bonus-log lands: swap this stub for a
 * `bonus_events` query. On this branch there is no table, so it is empty.
 */
function useBonusEventsForBubby(): BonusEventLike[] {
    return NO_BONUS_EVENTS;
}

/** SGT date and minute-of-day, refreshed every minute and on resume. */
export function useSgtClock(): { today: string; minutes: number } {
    const read = () => ({
        today: toSgtDateString(),
        minutes: sgtMinutesOfDay(),
    });
    const [clock, setClock] = useState(read);

    useEffect(() => {
        const tick = () =>
            setClock((prev) => {
                const next = read();
                return next.today === prev.today &&
                    next.minutes === prev.minutes
                    ? prev
                    : next;
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
export function useBubbyReaction(): BubbyReaction | null {
    const [reaction, setReaction] = useState<BubbyReaction | null>(null);

    useEffect(() => {
        let timer: number | undefined;
        const off = onAppEvent("bubby:react", ({ kind }) => {
            setReaction(kind);
            window.clearTimeout(timer);
            timer = window.setTimeout(
                () => setReaction(null),
                REACTION_MS[kind],
            );
        });
        return () => {
            off();
            window.clearTimeout(timer);
        };
    }, []);

    return reaction;
}

/** All members' check-ins, shared app-wide. */
export function useHouseholdCheckinsQuery() {
    return useQuery<DailyCheckin[]>({
        queryKey: queryKeys.dailyCheckins(),
        queryFn: () => financeService.getDailyCheckins(),
        staleTime: 60_000,
        refetchOnWindowFocus: true,
    });
}

export interface UseBubbyResult {
    isReady: boolean;
    body: BubbyBody;
    mood: BubbyMood;
    condition: BubbyCondition;
    reaction: BubbyReaction | null;
    dailyQuests: Quest[];
    weeklyQuests: Quest[];
    snacks: SnackEntry[];
    me: HouseholdMember | null;
    partner: HouseholdMember | null;
    members: HouseholdMember[];
    today: string;
    /** SGT minutes since midnight (refreshed every minute). */
    minutes: number;
    /** The logged-in member's check-in reminder time, in minutes. */
    checkinMinutes: number;
    /** Pet Bubby: a soft cue every time, food once a day. */
    pet: () => void;
}

export function useBubby(): UseBubbyResult {
    const { me, members } = useLoggedInMember();
    const { today, minutes } = useSgtClock();
    const [store, setStore] = useState(readBubbyStore);

    const { data: checkinsData, isSuccess } = useHouseholdCheckinsQuery();
    const { data: thisMonth, isSuccess: thisMonthReady } = useExpensesQuery({
        month: today.slice(0, 7),
    });
    const { data: lastMonth, isSuccess: lastMonthReady } = useExpensesQuery({
        month: addDays(today.slice(0, 7) + "-01", -1).slice(0, 7),
    });
    const { data: snapshotsData, isSuccess: snapshotsReady } =
        useAccountSnapshotsQuery("household");
    const bonusEvents = useBonusEventsForBubby();

    useEffect(
        () =>
            onAppEvent("bubby:store-changed", () => setStore(readBubbyStore())),
        [],
    );

    const checkins = checkinsData ?? EMPTY_CHECKINS;
    const snapshots = snapshotsData ?? EMPTY_SNAPSHOTS;
    const expenses = useMemo(
        () => [
            ...(thisMonth ?? EMPTY_EXPENSES),
            ...(lastMonth ?? EMPTY_EXPENSES),
        ],
        [thisMonth, lastMonth],
    );

    const condition = useMemo(
        () =>
            deriveCondition(
                collectFeedEvents({
                    checkins,
                    expenses,
                    snapshots,
                    bonusEvents,
                    store,
                }),
                today,
            ),
        [checkins, expenses, snapshots, bonusEvents, store, today],
    );

    const daily = useMemo(
        () =>
            dailyQuests({
                memberId: me?.id,
                today,
                checkins,
                expenses,
                store,
                inboxPending: getInboxPending(),
            }),
        [me?.id, today, checkins, expenses, store],
    );
    const weekly = useMemo(
        () => weeklyQuests({ today, snapshots, store }),
        [today, snapshots, store],
    );

    const checkinMinutes = useMemo(() => readCheckinMinutes(me?.id), [me?.id]);
    const reaction = useBubbyReaction();
    const partner = useMemo(
        () => members.find((m) => m.id !== me?.id) ?? null,
        [members, me],
    );

    const meId = me?.id;
    const pet = useCallback(() => {
        feedback.routine("pet");
        if (!meId) return;
        addPetDay(meId, toSgtDateString());
        emitAppEvent("bubby:store-changed", {});
    }, [meId]);

    return {
        // Every input loaded, so body and mood changes are real
        isReady:
            isSuccess && thisMonthReady && lastMonthReady && snapshotsReady,
        body: condition.body,
        mood: condition.mood,
        condition,
        reaction,
        dailyQuests: daily,
        weeklyQuests: weekly,
        snacks: store.snacks ?? [],
        me,
        partner,
        members,
        today,
        minutes,
        checkinMinutes,
        pet,
    };
}
