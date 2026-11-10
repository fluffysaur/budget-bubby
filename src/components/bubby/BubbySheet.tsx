/**
 * Bubby sheet (lazy): a penguin per partner side by side (tap one to pet
 * it, or pet both), each with a name and two unlabelled meters; then
 * today's, this week's and this month's quests, and the shared snack
 * collection. A solo household sees one penguin. No numbers and no
 * lifetime stats.
 */

import { AnimatedModal, ModalBody, ModalHeader } from "../ui/AnimatedModal";
import { TooltipPopover } from "../ui/TooltipPopover";
import { Button } from "../ui/Button";
import { TruncatedText } from "../ui/TruncatedText";
import { useBubby, type BubbyPenguin } from "../../hooks/useBubby";
import { snackLabel } from "../../lib/bubby/snacks";
import { Bubby } from "./Bubby";
import { FedTodayDots } from "./FedTodayDots";
import { NoSpendButton } from "./NoSpendButton";
import { QuestList } from "./QuestList";
import {
    isQuestSelectable,
    useQuestActions,
} from "../../hooks/useQuestActions";
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
        <div
            className="flex min-w-0 items-center gap-2"
            role="img"
            aria-label={label}
        >
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

function GrowTips() {
    return (
        <TooltipPopover
            title="How Bubby grows"
            ariaLabel="How Bubby grows"
            align="right"
        >
            <div className="space-y-1 text-left">
                <div>🍤 Log spend, pet Bubby</div>
                <div>
                    💪 Sort inbox, update balances, add to goals, sweep, pay
                    card bills, read recap
                </div>
                <div>🤝 Shared spend and joint accounts feed everyone</div>
            </div>
        </TooltipPopover>
    );
}

/** One partner's penguin: tap to pet, name with a fed-today dot, meters. */
function PenguinCard({
    penguin,
    fed,
    onPet,
}: {
    penguin: BubbyPenguin;
    fed: boolean;
    onPet: () => void;
}) {
    const { member, isMe, condition } = penguin;
    const name = member.display_name;
    const whose = isMe ? "your" : `${name}'s`;
    return (
        <li
            className="flex min-w-0 flex-col items-center gap-2"
            data-testid="bubby-penguin"
            data-member={member.id}
            data-body={penguin.body}
            data-mood={penguin.mood}
        >
            <button
                type="button"
                aria-label={`Pet ${whose} Bubby`}
                onClick={onPet}
                className="min-h-11 rounded-3xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            >
                <Bubby
                    body={penguin.body}
                    mood={penguin.mood}
                    reaction={penguin.reaction}
                    scarf={penguin.scarf}
                    size="pair"
                    decorative
                />
            </button>
            <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
                <span
                    aria-hidden="true"
                    data-fed={fed ? "true" : "false"}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-(--border-ink) text-[9px] font-black leading-none ${
                        fed
                            ? "bg-(--pastel-mint) text-(--text-ink)"
                            : "bg-(--bg-cream) text-(--text-faint) opacity-60"
                    }`}
                >
                    {name.charAt(0).toUpperCase()}
                </span>
                <TruncatedText
                    text={name}
                    className="min-w-0 text-xs font-black text-(--text-ink)"
                    aria-label={`${name}${fed ? ", fed Bubby today" : ""}`}
                />
            </div>
            <div className="w-full space-y-1.5">
                <Meter
                    value={condition.nourishment}
                    icon="🍤"
                    label={`Nourishment, ${whose} Bubby`}
                />
                <Meter
                    value={condition.fitness}
                    icon="💪"
                    label={`Fitness, ${whose} Bubby`}
                />
            </div>
        </li>
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
        monthlyQuests,
        snacks,
        penguins,
        fedToday,
        pet,
    } = useBubby();
    const paired = penguins.length > 1;
    const onSelectQuest = useQuestActions(onClose);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <ModalHeader title="Bubby" onClose={onClose} />
            <ModalBody className="space-y-5">
                {paired ? (
                    <div className="flex flex-col items-center gap-3">
                        <ul
                            aria-label="Penguins"
                            className="grid w-full grid-cols-2 gap-3"
                        >
                            {penguins.map((p) => (
                                <PenguinCard
                                    key={p.member.id}
                                    penguin={p}
                                    fed={fedToday.has(p.member.id)}
                                    onPet={() => pet([p.member.id])}
                                />
                            ))}
                        </ul>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="min-h-11"
                                onClick={() =>
                                    pet(penguins.map((p) => p.member.id))
                                }
                            >
                                {penguins.length === 2 ? "Pet Both" : "Pet All"}
                            </Button>
                            <GrowTips />
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-3">
                        <button
                            type="button"
                            aria-label="Pet Bubby"
                            onClick={() => pet()}
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
                            <GrowTips />
                        </div>
                        <FedTodayDots members={members} fedToday={fedToday} />
                    </div>
                )}

                <section aria-label="Quests" className="space-y-3">
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            Today
                        </h3>
                        <QuestList
                            quests={dailyQuests}
                            label="Today's quests"
                            onSelect={onSelectQuest}
                            isSelectable={isQuestSelectable}
                            renderExtra={(q) =>
                                q.id === "log" && !q.done ? (
                                    <div className="pb-1.5 pl-7">
                                        <NoSpendButton />
                                    </div>
                                ) : null
                            }
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
                            isSelectable={isQuestSelectable}
                            className="mt-1.5"
                        />
                    </div>
                    {monthlyQuests.length > 0 && (
                        <div>
                            <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                This Month
                            </h3>
                            <QuestList
                                quests={monthlyQuests}
                                label="This month's quests"
                                onSelect={onSelectQuest}
                                isSelectable={isQuestSelectable}
                                className="mt-1.5"
                            />
                        </div>
                    )}
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
