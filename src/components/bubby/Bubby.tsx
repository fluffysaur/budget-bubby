/**
 * Bubby, the household penguin: one layered inline SVG. Four body shapes
 * (regular, chubby, lean, buff) with visual mood overlays (rumbly tummy,
 * tears, a little "miss you" sign). Moods are never named in the UI.
 * Motion is CSS only (keyframes keyed off `data-reaction`) and stops under
 * prefers-reduced-motion.
 */

import { useId } from "react";
import { FACE_ANCHOR, INK } from "../../lib/bubby/anchors";
import {
    MOOD_FACE,
    type EyeShape,
    type BeakShape,
} from "../../lib/bubby/moods";
import type { BubbyBody, BubbyMood } from "../../lib/bubby/body";
import type { BubbyReaction } from "../../lib/appEvents";
import { BodyShape } from "./parts/BodyShape";
import { Beak, Cheeks, Eyes } from "./parts/Face";
import {
    Dust,
    GlowRing,
    Hearts,
    MissYouSign,
    Rumble,
    Sparkles,
    Tears,
} from "./parts/Fx";

export type BubbySize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<BubbySize, string> = {
    xs: "h-7 w-7",
    sm: "h-12 w-12",
    md: "h-24 w-24",
    lg: "h-40 w-40",
};

export interface BubbyProps {
    body?: BubbyBody;
    mood?: BubbyMood;
    reaction?: BubbyReaction | null;
    size?: BubbySize;
    className?: string;
    /** Hide from screen readers (e.g. inside a labelled button). */
    decorative?: boolean;
}

function blinkDelayFor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++)
        hash = (hash * 31 + id.charCodeAt(i)) | 0;
    // Spread blinks over ±1s around the 5s loop
    return `${(Math.abs(hash) % 20) / 10 - 1}s`;
}

export function Bubby({
    body = "regular",
    mood = "normal",
    reaction = null,
    size = "md",
    className = "",
    decorative = false,
}: BubbyProps) {
    const instanceId = useId();
    const compact = size === "xs";
    // A reaction (e.g. the reunion after a feed) shows the happy face
    const face = MOOD_FACE[reaction ? "normal" : mood];

    let eyes: EyeShape = face.eyes;
    let beak: BeakShape = face.beak;
    if (reaction === "celebrate") {
        eyes = "sparkle";
        beak = "open";
    } else if (reaction === "munch") {
        beak = "munch";
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className={`bubby ${SIZE_CLASS[size]} ${className}`}
            data-body={body}
            data-mood={mood}
            data-reaction={reaction ?? undefined}
            data-blink={eyes === "dot" ? "" : undefined}
            {...(decorative
                ? { "aria-hidden": true }
                : { role: "img", "aria-label": "Bubby" })}
        >
            <g data-layer="ground">
                <ellipse
                    cx="256"
                    cy="476"
                    rx="140"
                    ry="14"
                    fill={INK}
                    opacity="0.12"
                />
            </g>

            {!compact && (
                <g data-layer="fx-back">
                    {reaction === "celebrate" && <GlowRing />}
                </g>
            )}

            <g data-layer="body" className="bubby-body">
                <BodyShape body={body} part="body" />
                {face.overlay === "rumble" && <Rumble />}
                <g data-layer="flipper-l" className="bubby-flipper-l">
                    <BodyShape body={body} part="flipperL" />
                </g>
                <g data-layer="flipper-r">
                    <BodyShape body={body} part="flipperR" />
                </g>
                <g data-layer="face" transform={FACE_ANCHOR[body]}>
                    <Eyes shape={eyes} blinkDelay={blinkDelayFor(instanceId)} />
                    {face.blush && <Cheeks lines={!compact} />}
                    <Beak shape={beak} />
                    {face.overlay === "tears" && <Tears />}
                </g>
                {face.overlay === "sign" && <MissYouSign compact={compact} />}
            </g>

            {!compact && (
                <g data-layer="fx-front">
                    {reaction === "celebrate" && <Sparkles />}
                    {reaction === "reunion" && <Hearts />}
                    {reaction === "poof" && <Dust />}
                </g>
            )}
        </svg>
    );
}

export default Bubby;
