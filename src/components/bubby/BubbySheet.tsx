/**
 * Bubby sheet (lazy): a penguin per partner side by side (tap one to pet
 * it), each with a name and two unlabelled meters; then
 * today's, this week's and this month's quests, and the shared snack
 * collection. A solo household sees one penguin. Penguins breathe and
 * tilt while the sheet is open, and sleepy ones yawn as it opens. No
 * numbers and no lifetime stats.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
    BookOpen,
    Check,
    ChevronRight,
    HelpCircle,
    Lock,
    Sparkles,
} from "lucide-react";
import { emitAppEvent } from "../../lib/appEvents";
import type { OnboardingTask, OnboardingTaskId } from "../../lib/onboarding";
import { yawnTarget } from "../../lib/bubby/moods";

import { AnimatedModal, ModalBody, ModalHeader } from "../ui/AnimatedModal";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { MeterBar } from "../ui/MeterBar";
import { TooltipPopover } from "../ui/TooltipPopover";
import { TruncatedText } from "../ui/TruncatedText";
import { useBubby, type BubbyPenguin } from "../../hooks/useBubby";
import { useOptionalNavigate } from "../../hooks/useOptionalNavigate";
import { snackLabel } from "../../lib/bubby/snacks";
import { Bubby } from "./Bubby";
import { BubbyEgg } from "./BubbyEgg";
import { FedTodayDots } from "./FedTodayDots";
import { HatchStage } from "./HatchStage";
import { NoSpendButton } from "./NoSpendButton";
import { QuestList } from "./QuestList";
import {
    isQuestSelectable,
    useQuestActions,
} from "../../hooks/useQuestActions";
import { SnackArt } from "./SnackArt";

/** Let the sheet slide in before the yawn. */
const SHEET_YAWN_DELAY_MS = 350;

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
                    className="h-full rounded-full bg-(--pastel-lilac) progress-fill"
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
            renderTrigger={(props, isOpen) => (
                <button
                    type="button"
                    aria-expanded={isOpen}
                    {...props}
                    className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-(--border-ink) px-2.5 text-xs font-bold text-(--text-ink) hover:bg-(--pastel-lilac-light) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer ${
                        isOpen ? "bg-(--pastel-lilac-light)" : "bg-(--bg-cream)"
                    }`}
                >
                    <HelpCircle
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                    />
                    <span>How it grows</span>
                </button>
            )}
        >
            <div className="space-y-2 text-left">
                <div className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="shrink-0">
                        🍤
                    </span>
                    <span>Log spend, pet Bubby</span>
                </div>
                <div className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="shrink-0">
                        💪
                    </span>
                    <span>
                        Sort inbox, update balances, add to goals, sweep, pay
                        card bills, read recap
                    </span>
                </div>
                <div className="flex items-start gap-2.5">
                    <span aria-hidden="true" className="shrink-0">
                        🤝
                    </span>
                    <span>Shared spend and joint accounts feed everyone</span>
                </div>
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
                    idle
                    sleepy={penguin.sleepy}
                    decorative
                />
            </button>
            <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
                <span
                    aria-hidden="true"
                    data-fed={fed ? "true" : "false"}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-(--border-ink) text-2xs font-black leading-none ${
                        fed
                            ? "bg-(--pastel-mint) text-(--text-on-pastel)"
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

const EMPTY_ONBOARDING_QUESTS: OnboardingTask[] = [];
const NOOP = () => {};

/** Unhatched egg card for couple mode: egg + partner name underneath. */
function EggCard({
    penguin,
    cracks,
    wobbling,
    onTap,
}: {
    penguin: BubbyPenguin;
    cracks: number;
    wobbling: boolean;
    onTap: () => void;
}) {
    const name = penguin.member.display_name;
    const whose = penguin.isMe ? "your" : `${name}'s`;
    return (
        <li
            className="flex min-w-0 flex-col items-center gap-2"
            data-testid="bubby-egg-card"
            data-member={penguin.member.id}
        >
            <button
                type="button"
                aria-label={`Tap ${whose} Bubby egg`}
                onClick={onTap}
                className="min-h-11 rounded-3xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
            >
                <BubbyEgg
                    cracks={cracks}
                    accent={penguin.scarf}
                    size="pair"
                    wobbling={wobbling}
                    decorative
                />
            </button>
            <TruncatedText
                text={name}
                className="min-w-0 text-xs font-black text-(--text-ink)"
            />
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
        sleepy,
        fedToday,
        pet,
        hatched = true,
        onboardingQuests = EMPTY_ONBOARDING_QUESTS,
        hatch = NOOP,
    } = useBubby();
    const navigate = useOptionalNavigate();
    const paired = penguins.length > 1;
    const myPenguin = penguins.find((p) => p.isMe) ?? penguins[0];
    const [isHatching, setIsHatching] = useState(false);
    const [eggWobbling, setEggWobbling] = useState(false);
    const wobbleTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => {
        if (!isOpen) setIsHatching(false);
    }, [isOpen]);

    const handleTapEgg = useCallback(() => {
        setEggWobbling(true);
        window.clearTimeout(wobbleTimerRef.current);
        wobbleTimerRef.current = window.setTimeout(
            () => setEggWobbling(false),
            900,
        );
    }, []);

    useEffect(
        () => () => {
            window.clearTimeout(wobbleTimerRef.current);
        },
        [],
    );

    const handleSelectOnboardingQuest = useCallback(
        (id: OnboardingTaskId) => {
            onClose();
            if (id === "budget") {
                navigate?.("/spend?tab=budget");
            } else if (id === "account") {
                navigate?.("/accounts");
            } else if (id === "expense") {
                window.dispatchEvent(new Event("openQuickAdd"));
            } else if (id === "plan") {
                navigate?.("/plan");
            }
        },
        [navigate, onClose],
    );

    const onboardingDoneCount = onboardingQuests.filter((q) => q.done).length;
    const readyToHatch =
        !hatched &&
        onboardingQuests.length > 0 &&
        onboardingDoneCount >= onboardingQuests.length;

    // Sleepy penguins yawn as the sheet opens (not when one wakes mid-sheet)
    const sleepyRef = useRef<{ id: string; sleepy: boolean }[]>([]);
    useEffect(() => {
        sleepyRef.current =
            penguins.length > 0
                ? penguins.map((p) => ({ id: p.member.id, sleepy: p.sleepy }))
                : [{ id: "", sleepy }];
    }, [penguins, sleepy]);
    useEffect(() => {
        if (!isOpen || !hatched) return;
        const timer = window.setTimeout(() => {
            const target = yawnTarget(sleepyRef.current);
            if (target)
                emitAppEvent("bubby:react", { kind: "yawn", ...target });
        }, SHEET_YAWN_DELAY_MS);
        return () => window.clearTimeout(timer);
    }, [isOpen, hatched]);
    const onSelectQuest = useQuestActions(onClose);

    return (
        <>
            <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <ModalHeader
                title="Bubby"
                onClose={onClose}
                actions={
                    <div className="flex items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => {
                                onClose();
                                emitAppEvent("onboarding:open", {});
                            }}
                            className="inline-flex h-8 items-center gap-1.5 rounded-full border border-(--border-ink) bg-(--bg-cream) px-2.5 text-xs font-bold text-(--text-ink) hover:bg-(--pastel-lilac-light) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                        >
                            <BookOpen
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                            />
                            <span>Guide</span>
                        </button>
                        <GrowTips />
                    </div>
                }
            />
            <ModalBody className="space-y-5">
                {!hatched ? (
                    <>
                        <div className="flex flex-col items-center gap-3">
                            {paired ? (
                                <ul
                                    aria-label="Bubby eggs"
                                    className="grid w-full grid-cols-2 gap-3"
                                >
                                    {penguins.map((p) =>
                                        p.hatched === false || p.isMe ? (
                                            <EggCard
                                                key={p.member.id}
                                                penguin={p}
                                                cracks={
                                                    p.isMe
                                                        ? onboardingDoneCount
                                                        : 0
                                                }
                                                wobbling={eggWobbling}
                                                onTap={handleTapEgg}
                                            />
                                        ) : (
                                            <PenguinCard
                                                key={p.member.id}
                                                penguin={p}
                                                fed={fedToday.has(p.member.id)}
                                                onPet={() => pet([p.member.id])}
                                            />
                                        ),
                                    )}
                                </ul>
                            ) : (
                                <button
                                    type="button"
                                    aria-label="Tap Bubby egg"
                                    onClick={handleTapEgg}
                                    className="rounded-3xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <BubbyEgg
                                        cracks={onboardingDoneCount}
                                        size="lg"
                                        wobbling={eggWobbling}
                                        decorative
                                    />
                                </button>
                            )}

                            <div className="w-full space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-(--text-muted)">
                                        {readyToHatch
                                            ? "All starter quests done! Tap to hatch."
                                            : "Complete starter quests to hatch Bubby."}
                                    </p>
                                    <Badge
                                        variant={
                                            readyToHatch ? "mint" : "butter"
                                        }
                                        size="sm"
                                        className="shrink-0"
                                    >
                                        {onboardingDoneCount}/
                                        {onboardingQuests.length}
                                    </Badge>
                                </div>
                                <MeterBar
                                    value={onboardingDoneCount}
                                    max={Math.max(1, onboardingQuests.length)}
                                    tone={readyToHatch ? "ok" : "near"}
                                    aria-label="Hatch progress"
                                />
                            </div>

                            {readyToHatch && (
                                <Button
                                    variant="primary"
                                    size="md"
                                    leftIcon={
                                        <Sparkles
                                            className="h-4 w-4"
                                            strokeWidth={2.5}
                                        />
                                    }
                                    onClick={() => setIsHatching(true)}
                                    data-testid="hatch-bubby-btn"
                                    className="w-full"
                                >
                                    Hatch Bubby
                                </Button>
                            )}
                        </div>

                        <section
                            aria-label="Starter Quests"
                            className="space-y-2"
                        >
                            <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                Starter Quests
                            </h3>
                            <ul
                                aria-label="Starter quests"
                                className="flex flex-col gap-2"
                            >
                                {onboardingQuests.map((task) => (
                                    <li
                                        key={task.id}
                                        data-done={task.done ? "true" : "false"}
                                        className={`rounded-2xl border-2 transition-colors ${
                                            task.done
                                                ? "border-(--border-subtle) bg-(--bg-cream) opacity-75"
                                                : "border-(--border-ink) bg-(--bg-card) shadow-cute-sm"
                                        }`}
                                    >
                                        <button
                                            type="button"
                                            disabled={task.done}
                                            onClick={() =>
                                                handleSelectOnboardingQuest(
                                                    task.id,
                                                )
                                            }
                                            className={`flex min-h-11 w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-bold ${
                                                task.done
                                                    ? "text-(--text-muted)"
                                                    : "cursor-pointer text-(--text-ink) active:translate-x-0.5 active:translate-y-0.5"
                                            }`}
                                        >
                                            <span
                                                aria-hidden="true"
                                                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                                                    task.done
                                                        ? "border-(--border-ink) bg-(--pastel-mint-light)"
                                                        : "border-(--border-subtle) bg-(--bg-cream)"
                                                }`}
                                            >
                                                {task.done && (
                                                    <Check
                                                        className="h-3.5 w-3.5 text-(--text-ink)"
                                                        strokeWidth={3}
                                                    />
                                                )}
                                            </span>
                                            <span className="flex min-w-0 flex-1 flex-col">
                                                <span
                                                    className={`truncate ${task.done ? "line-through" : ""}`}
                                                >
                                                    {task.label}
                                                </span>
                                                <span className="truncate text-xs font-medium text-(--text-muted)">
                                                    {task.description}
                                                </span>
                                            </span>
                                            {!task.done && (
                                                <ChevronRight
                                                    className="h-4 w-4 shrink-0 text-(--text-muted)"
                                                    strokeWidth={2.5}
                                                    aria-hidden="true"
                                                />
                                            )}
                                            {task.done && (
                                                <span className="sr-only">
                                                    Done
                                                </span>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <div className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-(--border-subtle) bg-(--bg-cream) px-3 py-2.5 text-xs font-medium text-(--text-muted)">
                            <Lock
                                className="h-3.5 w-3.5 shrink-0"
                                aria-hidden="true"
                            />
                            <span>
                                Daily, weekly &amp; monthly quests unlock after
                                Bubby hatches.
                            </span>
                        </div>
                    </>
                ) : (
                    <>
                        {paired ? (
                    <div className="flex flex-col items-center gap-3">
                        <ul
                            aria-label="Penguins"
                            className="grid w-full grid-cols-2 gap-3"
                        >
                            {penguins.map((p) =>
                                p.hatched === false ? (
                                    <EggCard
                                        key={p.member.id}
                                        penguin={p}
                                        cracks={0}
                                        wobbling={eggWobbling}
                                        onTap={handleTapEgg}
                                    />
                                ) : (
                                    <PenguinCard
                                        key={p.member.id}
                                        penguin={p}
                                        fed={fedToday.has(p.member.id)}
                                        onPet={() => pet([p.member.id])}
                                    />
                                ),
                            )}
                        </ul>
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
                                idle
                                sleepy={sleepy}
                                decorative
                            />
                        </button>
                        <div className="w-full max-w-xs space-y-1.5">
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
                                    <div className="px-3 pb-2.5 pl-10">
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
                    </>
                )}
            </ModalBody>
        </AnimatedModal>
            {isOpen && isHatching && (
                <HatchStage
                    body={myPenguin?.body ?? body}
                    scarf={myPenguin?.scarf}
                    onHatched={hatch}
                    onContinue={() => setIsHatching(false)}
                />
            )}
        </>
    );
}

export default BubbySheet;
