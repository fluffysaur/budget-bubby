/**
 * Live Bubby in the header, where the streak chip used to be. Shows the
 * household Bubby's body, mood and reactions, with a tiny "fed today" dot
 * per partner. Tapping pets Bubby (food once a day) and opens the sheet.
 * The first log of the day floats a 🍤 pip off the avatar.
 */

import { useEffect, useState } from "react";
import { useBubby } from "../../hooks/useBubby";
import { emitAppEvent, onAppEvent } from "../../lib/appEvents";
import { Bubby } from "./Bubby";
import { FedTodayDots } from "./FedTodayDots";

export interface BubbyAvatarButtonProps {
    className?: string;
}

export function BubbyAvatarButton({ className = "" }: BubbyAvatarButtonProps) {
    const { body, mood, reaction, me, members, condition, pet } = useBubby();
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
            aria-label="Bubby"
            data-testid="bubby-avatar"
            data-body={body}
            data-mood={mood}
            onClick={() => {
                pet();
                emitAppEvent("bubby:open-sheet", {});
            }}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-transform ${className}`}
        >
            <span className="flex h-9 w-9 sm:h-10 sm:w-10 items-end justify-center rounded-xl bg-(--accent-lilac) border-2 border-(--border-ink) shadow-cute-sm overflow-hidden pt-0.5">
                <Bubby
                    body={body}
                    mood={mood}
                    reaction={reaction}
                    size="xs"
                    className="h-8 w-8 sm:h-9 sm:w-9"
                    decorative
                />
            </span>
            <FedTodayDots
                members={members}
                fedToday={condition.fedToday}
                size="xs"
                className="pointer-events-none absolute -bottom-0.5 left-1/2 -translate-x-1/2"
            />
            {pipKey > 0 && (
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
