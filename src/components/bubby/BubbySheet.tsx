/**
 * Bubby sheet (lazy): Bubby (tap to pet), two unlabelled meters, who fed
 * Bubby today, today's and this week's quests, and the snack collection.
 * No numbers and no lifetime stats.
 */

import { AnimatedModal, ModalBody, ModalHeader } from "../ui/AnimatedModal";
import { TooltipPopover } from "../ui/TooltipPopover";
import { useBubby } from "../../hooks/useBubby";
import { snackLabel } from "../../lib/bubby/snacks";
import { Bubby } from "./Bubby";
import { FedTodayDots } from "./FedTodayDots";
import { QuestList } from "./QuestList";
import { useQuestActions } from "../../hooks/useQuestActions";
import { SnackArt } from "./SnackArt";

export interface BubbySheetProps {
    isOpen: boolean;
    onClose: () => void;
}

function Meter({
    value,
    icon,
    label,
}: {
    value: number;
    icon: string;
    label: string;
}) {
    return (
        <div className="flex items-center gap-2" role="img" aria-label={label}>
            <span aria-hidden="true" className="w-5 text-center text-sm">
                {icon}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full border border-(--border-ink)/30 bg-(--bg-cream)">
                <div
                    className="h-full rounded-full bg-(--pastel-lilac) transition-all"
                    style={{
                        width: `${Math.round(Math.max(0.04, value) * 100)}%`,
                    }}
                />
            </div>
        </div>
    );
}

export function BubbySheet({ isOpen, onClose }: BubbySheetProps) {
    const {
        body,
        mood,
        reaction,
        condition,
        members,
        dailyQuests,
        weeklyQuests,
        snacks,
        pet,
    } = useBubby();
    const onSelectQuest = useQuestActions(onClose);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <ModalHeader title="Bubby" onClose={onClose} />
            <ModalBody className="space-y-5">
                <div className="flex flex-col items-center gap-3">
                    <button
                        type="button"
                        aria-label="Pet Bubby"
                        onClick={pet}
                        className="rounded-3xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <Bubby
                            body={body}
                            mood={mood}
                            reaction={reaction}
                            size="lg"
                            decorative
                        />
                    </button>
                    <div className="flex w-full max-w-xs items-center gap-2">
                        <div className="flex-1 space-y-1.5">
                            <Meter
                                value={condition.nourishment}
                                icon="🍤"
                                label="Nourishment"
                            />
                            <Meter
                                value={condition.fitness}
                                icon="💪"
                                label="Fitness"
                            />
                        </div>
                        <TooltipPopover
                            title="How Bubby grows"
                            ariaLabel="How Bubby grows"
                            align="right"
                        >
                            <div className="space-y-1 text-left">
                                <div>🍤 Log spend, pet Bubby</div>
                                <div>
                                    💪 Sort inbox, update balances, add to
                                    goals, sweep, read recap
                                </div>
                            </div>
                        </TooltipPopover>
                    </div>
                    <FedTodayDots
                        members={members}
                        fedToday={condition.fedToday}
                    />
                </div>

                <section aria-label="Quests" className="space-y-3">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            Today
                        </h3>
                        <QuestList
                            quests={dailyQuests}
                            label="Today's quests"
                            onSelect={onSelectQuest}
                            className="mt-1.5"
                        />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            This Week
                        </h3>
                        <QuestList
                            quests={weeklyQuests}
                            label="This week's quests"
                            onSelect={onSelectQuest}
                            className="mt-1.5"
                        />
                    </div>
                </section>

                <section aria-label="Snacks">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                        Snacks
                    </h3>
                    {snacks.length === 0 ? (
                        <div className="mt-1.5 space-y-0.5">
                            <p className="text-xs font-bold text-(--text-ink)">
                                No Snacks
                            </p>
                            <p className="text-xs font-medium text-(--text-muted)">
                                Finish a week's quests to earn a treat.
                            </p>
                        </div>
                    ) : (
                        <ul className="mt-1.5 flex flex-wrap gap-1.5">
                            {snacks.map((s) => (
                                <li
                                    key={s.week}
                                    title={snackLabel(s.id)}
                                    aria-label={snackLabel(s.id)}
                                    className="flex h-11 w-11 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-butter-light)"
                                >
                                    <SnackArt id={s.id} />
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </ModalBody>
        </AnimatedModal>
    );
}

export default BubbySheet;
