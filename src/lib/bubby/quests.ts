/**
 * Quests: small, optional, no penalty. Unfinished ones simply vanish.
 *
 * Daily (per member): log today 🍤, pet Bubby 🍤, clear your inbox 💪
 * ("nothing to clear" counts as done). All three: a full-belly moment.
 * Weekly (household): update balances 💪, read the recap 💪. Both: a snack
 * treat for the collection.
 */

import type {
    AccountSnapshot,
    DailyCheckin,
    Expense,
} from "../../types/finance";
import type { BubbyStore } from "./storage";
import { addDays, mondayOf } from "./dates";
import { loggedDateOf } from "./sources";

export interface Quest {
    id: "log" | "pet" | "inbox" | "balances" | "recap";
    label: string;
    reward: "food" | "exercise";
    done: boolean;
}

export interface DailyQuestInputs {
    memberId: string | undefined;
    today: string;
    checkins: readonly DailyCheckin[];
    expenses: readonly Expense[];
    store: BubbyStore;
    inboxPending: number;
}

export function dailyQuests({
    memberId,
    today,
    checkins,
    expenses,
    store,
    inboxPending,
}: DailyQuestInputs): Quest[] {
    const logged = Boolean(
        memberId &&
        (checkins.some(
            (c) => c.member_id === memberId && c.checkin_date === today,
        ) ||
            expenses.some(
                (e) => e.payer_id === memberId && loggedDateOf(e) === today,
            )),
    );
    const petted = Boolean(
        memberId && store.petDays?.[memberId]?.includes(today),
    );
    const inboxDone =
        inboxPending === 0 ||
        Boolean(store.exercise?.["inbox-clear"]?.includes(today));
    return [
        { id: "log", label: "Log today", reward: "food", done: logged },
        { id: "pet", label: "Pet Bubby", reward: "food", done: petted },
        {
            id: "inbox",
            label: "Clear your inbox",
            reward: "exercise",
            done: inboxDone,
        },
    ];
}

export interface WeeklyQuestInputs {
    today: string;
    snapshots: readonly AccountSnapshot[];
    store: BubbyStore;
}

function inWeek(date: string, monday: string): boolean {
    return date >= monday && date <= addDays(monday, 6);
}

export function weeklyQuests({
    today,
    snapshots,
    store,
}: WeeklyQuestInputs): Quest[] {
    const monday = mondayOf(today);
    const balances =
        snapshots.some((s) => inWeek(s.snapshot_date, monday)) ||
        (store.exercise?.balances ?? []).some((d) => inWeek(d, monday));
    const recap = (store.exercise?.["recap-read"] ?? []).some((d) =>
        inWeek(d, monday),
    );
    return [
        {
            id: "balances",
            label: "Update balances",
            reward: "exercise",
            done: balances,
        },
        {
            id: "recap",
            label: "Read the recap",
            reward: "exercise",
            done: recap,
        },
    ];
}

export const allDone = (quests: readonly Quest[]) =>
    quests.length > 0 && quests.every((q) => q.done);
