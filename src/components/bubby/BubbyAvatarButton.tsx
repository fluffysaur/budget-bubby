/**
 * Live Bubby in the header (mobile) and sidebar (desktop).
 * Shows the household Bubby's stage, mood, equipped items and reactions.
 * Tapping opens the Bubby sheet. The first log of the day floats a
 * "+1 🐾" pip off the avatar.
 */

import { useEffect, useState } from "react";
import { useBubby } from "../../hooks/useBubby";
import { emitAppEvent, onAppEvent } from "../../lib/appEvents";
import { Bubby } from "./Bubby";

export interface BubbyAvatarButtonProps {
    /** Visual tile size: header (mobile) or sidebar (desktop). */
    variant?: "header" | "sidebar";
    className?: string;
}

export function BubbyAvatarButton({ variant = "header", className = "" }: BubbyAvatarButtonProps) {
    const { stage, mood, reaction, equipped, me } = useBubby();
    const [pipKey, setPipKey] = useState(0);
    const meId = me?.id;

    useEffect(
        () =>
            onAppEvent("day:logged", (detail) => {
                if (detail.firstForDate && detail.memberId === meId && detail.source !== "no_spend") {
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

    const tile = variant === "sidebar" ? "h-9 w-9" : "h-8 w-8";
    const art = variant === "sidebar" ? "h-8 w-8" : "h-7 w-7";

    return (
        <button
            type="button"
            aria-label="Bubby"
            data-testid="bubby-avatar"
            data-mood={mood}
            onClick={() => emitAppEvent("bubby:open-sheet", {})}
            className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl cursor-pointer active:translate-x-0.5 active:translate-y-0.5 transition-transform ${className}`}
        >
            <span
                className={`flex ${tile} items-end justify-center rounded-xl bg-(--accent-lilac) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) overflow-hidden pt-0.5`}
            >
                <Bubby
                    stage={stage}
                    mood={mood}
                    reaction={reaction}
                    equipped={equipped}
                    size="xs"
                    className={art}
                    decorative
                />
            </span>
            {pipKey > 0 && (
                <span
                    key={pipKey}
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full border-2 border-(--border-ink) bg-(--pastel-butter) px-1.5 text-[10px] font-black text-(--text-ink) animate-pip-float"
                >
                    +1 🐾
                </span>
            )}
        </button>
    );
}

export default BubbyAvatarButton;
