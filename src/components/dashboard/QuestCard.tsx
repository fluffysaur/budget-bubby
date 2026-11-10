/**
 * QuestCard: compact Home card with a progress bar per quest tier (today,
 * week, month). The whole card is one tap target that opens the Bubby sheet,
 * where the quests themselves live.
 */

import { useMemo } from "react";
import { m } from "motion/react";
import { Card } from "../ui/Card";
import { Bubby } from "../bubby/Bubby";
import { FedTodayDots } from "../bubby/FedTodayDots";
import { QuestProgressBars } from "../bubby/QuestProgressBars";
import { useBubby } from "../../hooks/useBubby";
import { emitAppEvent } from "../../lib/appEvents";

export function QuestCard() {
    const {
        body,
        mood,
        reaction,
        sleepy,
        members,
        fedToday,
        dailyQuests,
        weeklyQuests,
        monthlyQuests,
    } = useBubby();

    const tiers = useMemo(
        () => [
            { label: "Today", quests: dailyQuests },
            { label: "Week", quests: weeklyQuests },
            { label: "Month", quests: monthlyQuests },
        ],
        [dailyQuests, weeklyQuests, monthlyQuests],
    );

    return (
        <Card
            role="region"
            aria-label="Quests"
            elevation="sm"
            padding="sm"
            interactive
            data-testid="quest-card"
            onClick={() => emitAppEvent("bubby:open-sheet", {})}
        >
            <div className="flex items-center justify-between gap-2">
                <h2 className="min-w-0 truncate text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                    Bubby's Tasks
                </h2>
                <FedTodayDots
                    members={members}
                    fedToday={fedToday}
                    className="shrink-0"
                />
            </div>
            <div className="mt-1.5 flex items-center gap-3">
                {/* Keyboard entry point; mouse and touch taps bubble to the card */}
                <button
                    type="button"
                    aria-label="Open Bubby"
                    className="flex h-14 w-14 shrink-0 items-end justify-center overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-(--accent-lilac) pt-0.5 cursor-pointer"
                >
                    <m.div whileTap={{ y: -4 }} className="h-13 w-13">
                        <Bubby
                            body={body}
                            mood={mood}
                            reaction={reaction}
                            size="sm"
                            className="h-13 w-13"
                            idle
                            sleepy={sleepy}
                            decorative
                        />
                    </m.div>
                </button>
                <QuestProgressBars tiers={tiers} className="min-w-0 flex-1" />
            </div>
        </Card>
    );
}

export default QuestCard;
