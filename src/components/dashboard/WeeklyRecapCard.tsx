/**
 * WeeklyRecapCard (lazy): "Last Week" on Home, Monday to Wednesday, until
 * acknowledged. Neutral comparison (no red/green judgement), the top
 * category, one win, and two actions: See Spend and Nice!.
 */

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { WEEKLY_RECAP_ID } from "../../hooks/useQuestActions";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { CategoryBadge } from "../ui/CategoryBadge";
import { CurrencyText } from "../ui/CurrencyText";
import { Bubby } from "../bubby/Bubby";
import { FedTodayDots } from "../bubby/FedTodayDots";
import { useBubby, useHouseholdCheckinsQuery } from "../../hooks/useBubby";
import {
    useAccountSnapshotsQuery,
    useCategoriesQuery,
    useExpensesQuery,
} from "../../hooks/useFinanceQueries";
import {
    buildWeeklyRecap,
    recapMonths,
    type RecapWeek,
} from "../../lib/bubby/recap";
import { collectFeedEvents } from "../../lib/bubby/sources";
import {
    addLocalExercise,
    readBubbyStore,
    updateBubbyStore,
} from "../../lib/bubby/storage";
import { toSgtDateString } from "../../lib/bubby/dates";
import { emitAppEvent } from "../../lib/appEvents";
import { feedback } from "../../lib/delight/feedback";
import type {
    AccountSnapshot,
    DailyCheckin,
    Expense,
} from "../../types/finance";

const NO_EXPENSES: Expense[] = [];
const NO_CHECKINS: DailyCheckin[] = [];
const NO_SNAPSHOTS: AccountSnapshot[] = [];
const DAY_LETTERS = ["S", "M", "T", "W", "T", "F", "S"];

export interface WeeklyRecapCardProps {
    week: RecapWeek;
    /** Pro-rata weekly spendable budget (household), if known. */
    weeklyBudget?: number | null;
    onSeeSpend?: () => void;
}

export function WeeklyRecapCard({
    week,
    weeklyBudget,
    onSeeSpend,
}: WeeklyRecapCardProps) {
    const [dismissed, setDismissed] = useState(false);
    const { body, members, me } = useBubby();
    const { data: checkinsData } = useHouseholdCheckinsQuery();
    const { data: snapshotsData } = useAccountSnapshotsQuery("household");
    const [monthA, monthB] = recapMonths(week);
    const { data: expensesA } = useExpensesQuery({ month: monthA });
    const { data: expensesB } = useExpensesQuery({ month: monthB });
    const { data: categories } = useCategoriesQuery();

    const recap = useMemo(() => {
        const a = expensesA ?? NO_EXPENSES;
        const b = monthA === monthB ? NO_EXPENSES : (expensesB ?? NO_EXPENSES);
        const expenses = [...a, ...b];
        const checkins = checkinsData ?? NO_CHECKINS;
        const events = collectFeedEvents({
            checkins,
            expenses,
            snapshots: snapshotsData ?? NO_SNAPSHOTS,
            bonusEvents: [],
            store: readBubbyStore(),
        });
        return buildWeeklyRecap({
            week,
            expenses,
            checkins,
            events,
            weeklyBudget,
        });
    }, [
        expensesA,
        expensesB,
        monthA,
        monthB,
        week,
        checkinsData,
        snapshotsData,
        weeklyBudget,
    ]);

    const topCategory = recap.topCategory
        ? categories?.find((c) => c.id === recap.topCategory?.categoryId)
        : undefined;

    // Reading the recap is exercise 💪 (once a week)
    const acknowledge = () => {
        updateBubbyStore({ recapSeenWeek: week.start });
        addLocalExercise("recap-read", toSgtDateString(), me?.id);
        emitAppEvent("bubby:store-changed", {});
        setDismissed(true);
    };

    if (dismissed) return null;

    const change = recap.changePct;

    return (
        <Card
            id={WEEKLY_RECAP_ID}
            role="region"
            aria-label="Last Week"
            elevation="sm"
            padding="md"
        >
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                        Last Week
                    </span>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-(--text-ink)">
                        <CurrencyText amount={recap.spent} size="lg" />
                        {change !== null && change !== 0 && (
                            <Badge variant="slate" size="sm">
                                {change < 0 ? "↓" : "↑"} {Math.abs(change)}%
                            </Badge>
                        )}
                    </div>
                    {recap.topCategory && (
                        <div className="mt-2 flex min-w-0 items-center gap-2 text-xs font-semibold text-(--text-muted)">
                            <span className="min-w-0">
                                <CategoryBadge
                                    name={topCategory?.name ?? "Top category"}
                                    color={topCategory?.color}
                                    icon={topCategory?.icon}
                                    size="sm"
                                />
                            </span>
                            <span className="shrink-0 font-mono-num">
                                <CurrencyText
                                    amount={recap.topCategory.amount}
                                />
                            </span>
                        </div>
                    )}
                    <p className="mt-2 flex items-center gap-1 text-sm font-black text-(--text-ink) font-display">
                        <Sparkles
                            className="h-4 w-4 shrink-0 text-amber-500"
                            strokeWidth={2.5}
                        />
                        <span className="min-w-0 truncate">
                            {recap.win.text}
                        </span>
                    </p>
                    {members.length > 0 && (
                        <ol
                            aria-label="Days Bubby was fed"
                            className="mt-2 flex items-center gap-1.5"
                        >
                            {recap.days.map((d) => (
                                <li
                                    key={d.date}
                                    className="flex flex-col items-center gap-0.5"
                                >
                                    <FedTodayDots
                                        members={members}
                                        fedToday={new Set(d.fed)}
                                        size="xs"
                                    />
                                    <span className="text-[9px] font-bold text-(--text-faint)">
                                        {
                                            DAY_LETTERS[
                                                new Date(
                                                    `${d.date}T00:00:00Z`,
                                                ).getUTCDay()
                                            ]
                                        }
                                    </span>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
                <Bubby
                    body={body}
                    size="md"
                    className="h-20 w-20 shrink-0"
                    decorative
                />
            </div>
            <div className="mt-3 flex items-center gap-2">
                <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                        acknowledge();
                        onSeeSpend?.();
                    }}
                >
                    See Spend
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                        feedback.routine("acknowledge");
                        acknowledge();
                    }}
                >
                    Nice!
                </Button>
            </div>
        </Card>
    );
}

export default WeeklyRecapCard;
