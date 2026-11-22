/**
 * Live Bubby in the header, showing the logged-in user's own penguin (or
 * unhatched egg before starter quests are complete) plus the household's
 * "fed today" dots. Tapping opens the Bubby sheet (which shows both
 * partners' Bubbies in couple households) and pets your penguin once hatched.
 * The first log of the day floats a 🍤 pip off the avatar.
 */

import { useEffect, useState } from "react";
import { useBubby } from "../../hooks/useBubby";
import { emitAppEvent, onAppEvent } from "../../lib/appEvents";
import { Bubby } from "./Bubby";
import { BubbyEgg } from "./BubbyEgg";
import { FedTodayDots } from "./FedTodayDots";
import { Skeleton } from "../ui";

export interface BubbyAvatarButtonProps {
    className?: string;
}

export function BubbyAvatarButton({ className = "" }: BubbyAvatarButtonProps) {
    const {
        body,
        mood,
        reaction,
        me,
        members,
        penguins,
        fedToday,
        pet,
        hatched = true,
        isMemberLoading = false,
        onboardingQuests = [],
    } = useBubby();
    const myPenguin = penguins.find((p) => p.isMe) ?? penguins[0];
    const doneCount = onboardingQuests.filter((q) => q.done).length;
    const readyToHatch =
        !hatched &&
        onboardingQuests.length > 0 &&
        doneCount >= onboardingQuests.length;
    const [pipKey, setPipKey] = useState(0);
    const meId = me?.id;

    useEffect(
        () =>
            onAppEvent("day:logged", (detail) => {
                if (detail.firstForDate && detail.memberId === meId) {
                    setPipKey((k) => k + 1);
                }
            }),
        [meId],
    );

    useEffect(() => {
        if (!pipKey) return;
        const timer = window.setTimeout(() => setPipKey(0), 450);
        return () => window.clearTimeout(timer);
    }, [pipKey]);

    return (
        <button
            type="button"
            aria-label={
                isMemberLoading
                    ? "Loading Bubby"
                    : hatched
                      ? "Bubby"
                      : "Bubby Egg"
            }
            aria-busy={isMemberLoading || undefined}
            data-testid="bubby-avatar"
            data-body={myPenguin?.body ?? body}
            data-mood={myPenguin?.mood ?? mood}
            data-hatched={
                isMemberLoading ? "loading" : hatched ? "true" : "false"
            }
            onClick={() => {
                if (isMemberLoading) return;
                if (hatched) pet();
                emitAppEvent("bubby:open-sheet", {});
            }}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-transform ${className}`}
        >
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-end justify-center rounded-xl bg-(--accent-lilac) border-2 border-(--border-ink) shadow-cute-sm overflow-hidden pt-0.5">
                {isMemberLoading ? (
                    <Skeleton
                        data-testid="bubby-avatar-skeleton"
                        className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg self-center"
                    />
                ) : !hatched ? (
                    <BubbyEgg
                        cracks={doneCount}
                        accent={myPenguin?.scarf}
                        size="xs"
                        className="h-8 w-8 sm:h-9 sm:w-9"
                        decorative
                    />
                ) : (
                    <Bubby
                        body={myPenguin?.body ?? body}
                        mood={myPenguin?.mood ?? mood}
                        reaction={myPenguin?.reaction ?? reaction}
                        scarf={myPenguin?.scarf}
                        size="xs"
                        className="h-8 w-8 sm:h-9 sm:w-9"
                        decorative
                    />
                )}
            </span>
            {!isMemberLoading && hatched && (
                <FedTodayDots
                    members={members}
                    fedToday={fedToday}
                    size="xs"
                    className="pointer-events-none absolute -bottom-0.5 left-1/2 -translate-x-1/2"
                />
            )}
            {!isMemberLoading && readyToHatch && (
                <span
                    aria-hidden="true"
                    data-testid="bubby-egg-ready-dot"
                    className="pointer-events-none absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-(--border-ink) bg-(--pastel-butter)"
                />
            )}
            {!isMemberLoading && hatched && pipKey > 0 && (
                <span
                    key={pipKey}
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 rounded-full border-2 border-(--border-ink) bg-(--pastel-butter) px-1 text-[10px] leading-4 animate-pip-float"
                >
                    🍤
                </span>
            )}
        </button>
    );
}

export default BubbyAvatarButton;
