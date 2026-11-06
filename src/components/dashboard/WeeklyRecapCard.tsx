/**
 * WeeklyRecapCard (lazy): "Last Week" on Home, Monday to Wednesday, until
 * acknowledged. Neutral comparison (no red/green judgement), the top
 * category, one win, and two actions: See Spend and Nice!.
 */

import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { Card } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { CategoryBadge } from "../ui/CategoryBadge";
import { CurrencyText } from "../ui/CurrencyText";
import { Bubby } from "../bubby/Bubby";
import { useBubby } from "../../hooks/useBubby";
import { useCategoriesQuery, useExpensesQuery } from "../../hooks/useFinanceQueries";
import { buildWeeklyRecap, recapMonths, type RecapWeek } from "../../lib/bubby/recap";
import { readBubbyStore, updateBubbyStore } from "../../lib/bubby/storage";
import { feedback } from "../../lib/delight/feedback";
import type { Expense } from "../../types/finance";

const NO_EXPENSES: Expense[] = [];

export interface WeeklyRecapCardProps {
    week: RecapWeek;
    /** Pro-rata weekly spendable budget (household), if known. */
    weeklyBudget?: number | null;
    onSeeSpend?: () => void;
}

export function WeeklyRecapCard({ week, weeklyBudget, onSeeSpend }: WeeklyRecapCardProps) {
    const [dismissed, setDismissed] = useState(false);
    const { stage, equipped, checkins, members } = useBubby();
    const [monthA, monthB] = recapMonths(week);
    const { data: expensesA } = useExpensesQuery({ month: monthA });
    const { data: expensesB } = useExpensesQuery({ month: monthB });
    const { data: categories } = useCategoriesQuery();

    const recap = useMemo(() => {
        const a = expensesA ?? NO_EXPENSES;
        const b = monthA === monthB ? NO_EXPENSES : (expensesB ?? NO_EXPENSES);
        return buildWeeklyRecap({
            week,
            expenses: [...a, ...b],
            checkins,
            memberIds: members.map((m) => m.id),
            inboxZeroDays: readBubbyStore().inboxZeroDays,
            weeklyBudget,
        });
    }, [expensesA, expensesB, monthA, monthB, week, checkins, members, weeklyBudget]);

    const topCategory = recap.topCategory
        ? categories?.find((c) => c.id === recap.topCategory?.categoryId)
        : undefined;

    const acknowledge = () => {
        updateBubbyStore({ recapSeenWeek: week.start });
        setDismissed(true);
    };

    if (dismissed) return null;

    const change = recap.changePct;

    return (
        <Card role="region" aria-label="Last Week" elevation="sm" padding="md">
            <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                    <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">Last Week</span>
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
                                <CurrencyText amount={recap.topCategory.amount} />
                            </span>
                        </div>
                    )}
                    <p className="mt-2 flex items-center gap-1 text-sm font-black text-(--text-ink) font-display">
                        <Sparkles className="h-4 w-4 shrink-0 text-amber-500" strokeWidth={2.5} />
                        <span className="min-w-0 truncate">{recap.win.text}</span>
                    </p>
                </div>
                <Bubby stage={stage} mood="proud" equipped={equipped} size="md" className="h-20 w-20 shrink-0" decorative />
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
