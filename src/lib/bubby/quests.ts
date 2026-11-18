/**
 * Quests: small, optional, no penalty. Unfinished ones simply vanish.
 *
 * Daily (per member): log today 🍤, pet Bubby 🍤, and clear your inbox 💪
 * (shown only when items are pending or cleared today). All shown: a
 * full-belly moment.
 * Weekly (household): update balances 💪 and read the weekly recap 💪 (shown
 * Mon-Wed while available or already read this week). All shown: a snack
 * treat for the collection.
 * Monthly (household): pay the card statements due this month 💪 and bank
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
import { recapWeekFor } from "./recap";
import { loggedDateOf } from "./sources";

export interface Quest {
    id: "log" | "pet" | "inbox" | "balances" | "recap" | "cards" | "sweep";
    label: string;
    description?: string;
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
    const clearedToday = Boolean(
        store.exercise?.["inbox-clear"]?.includes(today),
    );
    const quests: Quest[] = [
        {
            id: "log",
            label: "Log today",
            description: "Add an expense or tap No spend",
            reward: "food",
            done: logged,
        },
        {
            id: "pet",
            label: "Pet Bubby",
            description: "Tap Bubby above to say hi",
            reward: "food",
            done: petted,
        },
    ];
    if (inboxPending > 0 || clearedToday) {
        quests.push({
            id: "inbox",
            label: "Clear inbox",
            description: "Confirm or dismiss pending items",
            reward: "exercise",
            done: inboxPending === 0 || clearedToday,
        });
    }
    return quests;
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
    const recapAvailable = recapWeekFor(today, store.recapSeenWeek) !== null;
    const quests: Quest[] = [
        {
            id: "balances",
            label: "Update balances",
            description: "Snapshot your account balances",
            reward: "exercise",
            done: balances,
        },
    ];
    if (recapAvailable || recap) {
        quests.push({
            id: "recap",
            label: "Read weekly recap",
            description: "Check Last Week on Home",
            reward: "exercise",
            done: recap,
        });
    }
    return quests;
}

export interface MonthlyQuestInputs {
    today: string;
    statements: readonly CreditCardStatement[];
    /** Last month left unspent surplus that has not been banked. */
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
            description: "Mark due statements paid",
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
            label: "Bank surplus",
            description: "Bank last month's leftover",
            reward: "exercise",
            done: swept,
        });
    }
    return quests;
}

export const allDone = (quests: readonly Quest[]) =>
    quests.length > 0 && quests.every((q) => q.done);
