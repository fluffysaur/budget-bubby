/**
 * QuestCard: compact Home card with today's quests, who fed Bubby today,
 * and a one-tap "No Spend" log (food for Bubby).
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { m } from "motion/react";
import { Card } from "../ui/Card";
import { Button } from "../ui/Button";
import { Bubby } from "../bubby/Bubby";
import { FedTodayDots } from "../bubby/FedTodayDots";
import { QuestList } from "../bubby/QuestList";
import { useBubby } from "../../hooks/useBubby";
import {
    isQuestSelectable,
    useQuestActions,
} from "../../hooks/useQuestActions";
import { financeService } from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import { emitAppEvent } from "../../lib/appEvents";
import { toSgtDateString } from "../../lib/bubby/dates";

export function QuestCard() {
    const { body, mood, reaction, me, members, condition, dailyQuests } =
        useBubby();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const onSelectQuest = useQuestActions();
    const loggedToday = dailyQuests.find((q) => q.id === "log")?.done ?? false;

    const handleNoSpend = async () => {
        if (!me || isSubmitting) return;
        try {
            setIsSubmitting(true);
            const today = toSgtDateString();
            await financeService.recordDailyCheckin(me.id, today, "no_spend");
            // Cha-ching, celebrate haptic and Bubby munching
            feedback.routine("no-spend");
            emitAppEvent("day:logged", {
                memberId: me.id,
                date: today,
                source: "no_spend",
                firstForDate: true,
            });
        } catch (err) {
            console.error("Failed to record no-spend day:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card
            role="region"
            aria-label="Quests"
            elevation="sm"
            padding="sm"
            data-testid="quest-card"
        >
            <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 truncate text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Bubby's Tasks
                </h2>
                <FedTodayDots
                    members={members}
                    fedToday={condition.fedToday}
                    className="shrink-0"
                />
            </div>
            <div className="mt-1.5 flex items-center gap-3">
                <button
                    type="button"
                    aria-label="Open Bubby"
                    onClick={() => emitAppEvent("bubby:open-sheet", {})}
                    className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-(--accent-lilac) pt-0.5 cursor-pointer"
                >
                    <m.div whileTap={{ y: -4 }} className="h-13 w-13">
                        <Bubby
                            body={body}
                            mood={mood}
                            reaction={reaction}
                            size="sm"
                            className="h-13 w-13"
                            decorative
                        />
                    </m.div>
                </button>
                <QuestList
                    quests={dailyQuests}
                    label="Today's quests"
                    onSelect={onSelectQuest}
                    isSelectable={isQuestSelectable}
                    className="min-w-0 flex-1"
                />
            </div>
            {!loggedToday && me && (
                <div className="mt-2.5 flex justify-end">
                    <Button
                        variant="secondary"
                        size="sm"
                        data-testid="no-spend-checkin-btn"
                        isLoading={isSubmitting}
                        leftIcon={
                            <Sparkles
                                className="h-3.5 w-3.5"
                                strokeWidth={2.5}
                            />
                        }
                        onClick={handleNoSpend}
                    >
                        No Spend
                    </Button>
                </div>
            )}
        </Card>
    );
}

export default QuestCard;
