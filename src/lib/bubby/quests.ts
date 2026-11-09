/**
 * Quests: small, optional, no penalty. Unfinished ones simply vanish.
 *
 * Daily (per member): log today 🍤, pet Bubby 🍤, clear your inbox 💪
 * ("nothing to clear" counts as done). All three: a full-belly moment.
 * Weekly (household): update balances 💪, read the recap 💪, and add to a goal
 * 💪 (only while a goal is active). All shown: a snack treat for the
 * collection.
 * Monthly (household): pay the card statements due this month 💪 and sweep
 * last month's surplus 💪. Each shows only when it applies; all shown done:
 * a monthly treat moment.
 */

import type {
    AccountSnapshot,
    CreditCardStatement,
    DailyCheckin,
    Expense,
} from "../../types/finance";
import type { BubbyStore } from "./storage";
import { addDays, mondayOf } from "./dates";
import { loggedDateOf } from "./sources";

export interface Quest {
    id:
        | "log"
        | "pet"
        | "inbox"
        | "balances"
        | "recap"
        | "goal"
        | "cards"
        | "sweep";
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
    /** The goal quest only shows while the household has an active goal. */
    hasActiveGoal?: boolean;
}

function inWeek(date: string, monday: string): boolean {
    return date >= monday && date <= addDays(monday, 6);
}

export function weeklyQuests({
    today,
    snapshots,
    store,
    hasActiveGoal = false,
}: WeeklyQuestInputs): Quest[] {
    const monday = mondayOf(today);
    const balances =
        snapshots.some((s) => inWeek(s.snapshot_date, monday)) ||
        (store.exercise?.balances ?? []).some((d) => inWeek(d, monday));
    const recap = (store.exercise?.["recap-read"] ?? []).some((d) =>
        inWeek(d, monday),
    );
    const quests: Quest[] = [
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
    if (hasActiveGoal) {
        quests.push({
            id: "goal",
            label: "Add to a goal",
            reward: "exercise",
            done: (store.exercise?.["goal-add"] ?? []).some((d) =>
                inWeek(d, monday),
            ),
        });
    }
    return quests;
}

export interface MonthlyQuestInputs {
    today: string;
    statements: readonly CreditCardStatement[];
    /** Last month left unspent surplus that has not been swept or banked. */
    surplusPending: boolean;
    store: BubbyStore;
}

/** Statements due in the SGT month of `today`, whichever month they bill. */
function dueThisMonth(
    statements: readonly CreditCardStatement[],
    today: string,
): CreditCardStatement[] {
    const month = today.slice(0, 7);
    return statements.filter((s) => s.due_date.slice(0, 7) === month);
}

export function monthlyQuests({
    today,
    statements,
    surplusPending,
    store,
}: MonthlyQuestInputs): Quest[] {
    const month = today.slice(0, 7);
    const quests: Quest[] = [];
    const due = dueThisMonth(statements, today);
    if (due.length > 0) {
        quests.push({
            id: "cards",
            label: "Pay card bills",
            reward: "exercise",
            done: due.every((s) => s.is_paid),
        });
    }
    const swept = (store.exercise?.["month-end"] ?? []).some((d) =>
        d.startsWith(month),
    );
    if (surplusPending || swept) {
        quests.push({
            id: "sweep",
            label: "Sweep the surplus",
            reward: "exercise",
            done: swept,
        });
    }
    return quests;
}

export const allDone = (quests: readonly Quest[]) =>
    quests.length > 0 && quests.every((q) => q.done);
