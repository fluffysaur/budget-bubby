/**
 * A Bubby each: feed events -> one penguin per household member (body, mood,
 * meters, reaction), plus the household's quests, snacks and "fed today".
 * Your own penguin comes first; its body and mood are the top-level ones.
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
    useAccountsQuery,
    useAccountSnapshotsQuery,
    useCreditCardStatementsQuery,
    useExpensesQuery,
    useGoalsQuery,
} from "./useFinanceQueries";
import { useMonthEndSurplus } from "./useMonthEndSurplus";
import { useLoggedInMember } from "./useLoggedInMember";
import { onAppEvent, emitAppEvent, type BubbyReaction } from "../lib/appEvents";
import { collectFeedEvents, type BonusEventLike } from "../lib/bubby/sources";
import {
    deriveCondition,
    type BubbyBody,
    type BubbyCondition,
    type BubbyMood,
} from "../lib/bubby/body";
import {
    dailyQuests,
    monthlyQuests,
    weeklyQuests,
    type Quest,
} from "../lib/bubby/quests";
import { isSleepy, REACTION_MS } from "../lib/bubby/moods";
import { scarfFor } from "../lib/bubby/anchors";
import { addPet, readBubbyStore, type SnackEntry } from "../lib/bubby/storage";
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
    Account,
    AccountSnapshot,
    CreditCardStatement,
    DailyCheckin,
    Expense,
    HouseholdMember,
    SavingsGoal,
} from "../types/finance";

const EMPTY_CHECKINS: DailyCheckin[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_SNAPSHOTS: AccountSnapshot[] = [];
const EMPTY_ACCOUNTS: Account[] = [];
const EMPTY_STATEMENTS: CreditCardStatement[] = [];
const EMPTY_GOALS: SavingsGoal[] = [];
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

export interface BubbyReactionState {
    kind: BubbyReaction;
    /** The penguin it is for, or every penguin. */
    memberId?: string;
}

/** Latest Bubby reaction, cleared after its (≤400ms) animation. */
export function useBubbyReaction(): BubbyReactionState | null {
    const [reaction, setReaction] = useState<BubbyReactionState | null>(null);

    useEffect(() => {
        let timer: number | undefined;
        const off = onAppEvent("bubby:react", ({ kind, memberId }) => {
            setReaction(memberId ? { kind, memberId } : { kind });
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

function reactionFor(
    state: BubbyReactionState | null,
    memberId: string | undefined,
): BubbyReaction | null {
    if (!state) return null;
    return !state.memberId || state.memberId === memberId ? state.kind : null;
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

/** One member's penguin. */
export interface BubbyPenguin {
    member: HouseholdMember;
    isMe: boolean;
    condition: BubbyCondition;
    body: BubbyBody;
    mood: BubbyMood;
    reaction: BubbyReaction | null;
    /** Scarf colour telling partners apart (none for a solo household). */
    scarf?: string;
    /** Night, or unfed for 3+ days: yawns while idle. */
    sleepy: boolean;
}

export interface UseBubbyResult {
    isReady: boolean;
    weeklyQuestsReady: boolean;
    monthlyQuestsReady: boolean;
    /** Your penguin's look (the household's before members load). */
    body: BubbyBody;
    mood: BubbyMood;
    condition: BubbyCondition;
    reaction: BubbyReaction | null;
    /** One penguin per member, yours first. Empty before members load. */
    penguins: BubbyPenguin[];
    /** Your penguin is sleepy (night, or unfed for 3+ days). */
    sleepy: boolean;
    /** Members who fed any penguin today. */
    fedToday: Set<string>;
    dailyQuests: Quest[];
    weeklyQuests: Quest[];
    monthlyQuests: Quest[];
    snacks: SnackEntry[];
    me: HouseholdMember | null;
    partner: HouseholdMember | null;
    members: HouseholdMember[];
    today: string;
    /** SGT minutes since midnight (refreshed every minute). */
    minutes: number;
    /** The logged-in member's check-in reminder time, in minutes. */
    checkinMinutes: number;
    /** Pet penguins (default: yours): hearts every time, food once a day. */
    pet: (memberIds?: readonly string[]) => void;
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
    const { data: accountsData, isSuccess: accountsReady } =
        useAccountsQuery("household");
    const { data: statementsData, isPending: statementsPending } =
        useCreditCardStatementsQuery();
    const { data: goalsData, isPending: goalsPending } = useGoalsQuery();
    const { pending: surplusPending, settled: surplusSettled } =
        useMonthEndSurplus(today.slice(0, 7));
    const bonusEvents = useBonusEventsForBubby();

    useEffect(
        () =>
            onAppEvent("bubby:store-changed", () => setStore(readBubbyStore())),
        [],
    );

    const checkins = checkinsData ?? EMPTY_CHECKINS;
    const snapshots = snapshotsData ?? EMPTY_SNAPSHOTS;
    const accounts = accountsData ?? EMPTY_ACCOUNTS;
    const expenses = useMemo(
        () => [
            ...(thisMonth ?? EMPTY_EXPENSES),
            ...(lastMonth ?? EMPTY_EXPENSES),
        ],
        [thisMonth, lastMonth],
    );

    const events = useMemo(
        () =>
            collectFeedEvents({
                checkins,
                expenses,
                snapshots,
                bonusEvents,
                store,
                accounts,
            }),
        [checkins, expenses, snapshots, bonusEvents, store, accounts],
    );
    const household = useMemo(
        () => deriveCondition(events, today),
        [events, today],
    );
    const reactionState = useBubbyReaction();
    const conditions = useMemo(() => {
        const ordered = [
            ...members.filter((m) => m.id === me?.id),
            ...members.filter((m) => m.id !== me?.id),
        ];
        return ordered.map((member) => ({
            member,
            isMe: member.id === me?.id,
            condition: deriveCondition(events, today, member.id),
            scarf:
                members.length > 1
                    ? scarfFor(members.findIndex((m) => m.id === member.id))
                    : undefined,
        }));
    }, [events, today, members, me?.id]);
    const penguins = useMemo<BubbyPenguin[]>(
        () =>
            conditions.map((p) => ({
                ...p,
                body: p.condition.body,
                mood: p.condition.mood,
                reaction: reactionFor(reactionState, p.member.id),
                sleepy: isSleepy(minutes, p.condition.daysSinceFed),
            })),
        [conditions, reactionState, minutes],
    );
    const condition = conditions.find((p) => p.isMe)?.condition ?? household;

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
    const statements = statementsData ?? EMPTY_STATEMENTS;
    const goals = goalsData ?? EMPTY_GOALS;
    const hasActiveGoal = useMemo(
        () => goals.some((g) => g.status !== "achieved"),
        [goals],
    );
    const weekly = useMemo(
        () => weeklyQuests({ today, snapshots, store, hasActiveGoal }),
        [today, snapshots, store, hasActiveGoal],
    );
    const monthly = useMemo(
        () => monthlyQuests({ today, statements, surplusPending, store }),
        [today, statements, surplusPending, store],
    );

    const checkinMinutes = useMemo(() => readCheckinMinutes(me?.id), [me?.id]);
    const reaction = reactionFor(reactionState, me?.id);
    const partner = useMemo(
        () => members.find((m) => m.id !== me?.id) ?? null,
        [members, me],
    );

    const meId = me?.id;
    const pet = useCallback(
        (memberIds?: readonly string[]) => {
            const targets = memberIds?.length ? memberIds : meId ? [meId] : [];
            // One penguin gets the hearts; "pet both" cheers everyone
            feedback.routine(
                "pet",
                targets.length === 1 ? targets[0] : undefined,
            );
            if (!meId) return;
            addPet(meId, targets, toSgtDateString());
            emitAppEvent("bubby:store-changed", {});
        },
        [meId],
    );

    return {
        // Every input loaded, so body and mood changes are real
        isReady:
            isSuccess &&
            thisMonthReady &&
            lastMonthReady &&
            snapshotsReady &&
            accountsReady,
        // The goal and monthly inputs have loaded (or failed), so those quest
        // sets are complete and a treat for them cannot fire early
        weeklyQuestsReady: !goalsPending,
        monthlyQuestsReady:
            !statementsPending && !goalsPending && surplusSettled,
        body: condition.body,
        mood: condition.mood,
        condition,
        reaction,
        penguins,
        sleepy: isSleepy(minutes, condition.daysSinceFed),
        fedToday: household.fedToday,
        dailyQuests: daily,
        weeklyQuests: weekly,
        monthlyQuests: monthly,
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
