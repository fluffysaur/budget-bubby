/**
 * Bubby, a household member's penguin: one layered inline SVG. An optional
 * scarf colour tells partners' penguins apart. Four body shapes
 * (regular, chubby, lean, buff) with visual mood overlays (rumbly tummy,
 * tears, a little "miss you" sign). Moods are never named in the UI.
 * Motion is CSS only (keyframes keyed off `data-reaction`, `data-idle` and
 * `data-loop`) and stops under prefers-reduced-motion. `idle` adds a
 * breathing sway with a random head tilt (and yawns when sleepy); `loop`
 * repeats a moment, e.g. the loading screen's waddle.
 */

import { useId } from "react";
import { FACE_ANCHOR, INK } from "../../lib/bubby/anchors";
import {
    CALM_REACTIONS,
    MOOD_FACE,
    type EyeShape,
    type BeakShape,
} from "../../lib/bubby/moods";
import { useBubbyIdle } from "../../hooks/useBubbyIdle";
import type { BubbyBody, BubbyMood } from "../../lib/bubby/body";
import type { BubbyReaction } from "../../lib/appEvents";
import { BodyShape, Scarf } from "./parts/BodyShape";
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

export type BubbySize = "mini" | "xs" | "sm" | "md" | "pair" | "lg";

const SIZE_CLASS: Record<BubbySize, string> = {
    mini: "h-6 w-6",
    xs: "h-7 w-7",
    sm: "h-12 w-12",
    md: "h-24 w-24",
    pair: "h-28 w-28 sm:h-32 sm:w-32",
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
    /** Scarf colour for this member's penguin (none when solo). */
    scarf?: string;
    /** Accessible name when not decorative. */
    label?: string;
    /** Sits on screen: breathe, sway and tilt now and then. */
    idle?: boolean;
    /** Night or unfed: idle Bubby also yawns. */
    sleepy?: boolean;
    /** Repeat a moment forever (loading screen). */
    loop?: "waddle";
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
    scarf,
    label = "Bubby",
    idle = false,
    sleepy = false,
    loop,
}: BubbyProps) {
    const instanceId = useId();
    const idleAct = useBubbyIdle(idle && !loop, sleepy);
    const compact = size === "xs" || size === "mini";
    // Feedback wins over the idle cycle
    const active = reaction ?? idleAct;
    // A feedback reaction (e.g. the reunion after a feed) shows the happy
    // face; calm moments keep the mood's face
    const happy = Boolean(active && !CALM_REACTIONS.has(active));
    const face = MOOD_FACE[happy ? "normal" : mood];

    let eyes: EyeShape = face.eyes;
    let beak: BeakShape = face.beak;
    if (active === "celebrate") {
        eyes = "sparkle";
        beak = "open";
    } else if (active === "munch") {
        beak = "munch";
    } else if (active === "yawn") {
        eyes = "droop";
        beak = "open";
    }

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className={`bubby ${SIZE_CLASS[size]} ${className}`}
            data-body={body}
            data-mood={mood}
            data-reaction={active ?? undefined}
            data-idle={idle && !loop ? "" : undefined}
            data-loop={loop}
            data-blink={eyes === "dot" ? "" : undefined}
            {...(decorative
                ? { "aria-hidden": true }
                : { role: "img", "aria-label": label })}
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
                    {active === "celebrate" && <GlowRing />}
                </g>
            )}

            <g data-layer="idle" className="bubby-idle">
                <g data-layer="body" className="bubby-body">
                    <BodyShape body={body} part="body" />
                    {face.overlay === "rumble" && <Rumble />}
                    {scarf && (
                        <Scarf body={body} color={scarf} compact={compact} />
                    )}
                    <g data-layer="flipper-l" className="bubby-flipper-l">
                        <BodyShape body={body} part="flipperL" />
                    </g>
                    <g data-layer="flipper-r">
                        <BodyShape body={body} part="flipperR" />
                    </g>
                    <g data-layer="face" transform={FACE_ANCHOR[body]}>
                        <g className="bubby-face">
                            <Eyes
                                shape={eyes}
                                blinkDelay={blinkDelayFor(instanceId)}
                            />
                            {face.blush && <Cheeks lines={!compact} />}
                            <Beak shape={beak} />
                            {face.overlay === "tears" && <Tears />}
                        </g>
                    </g>
                    {face.overlay === "sign" && (
                        <MissYouSign compact={compact} />
                    )}
                </g>
            </g>

            {!compact && (
                <g data-layer="fx-front">
                    {active === "celebrate" && <Sparkles />}
                    {active === "reunion" && <Hearts />}
                    {active === "poof" && <Dust />}
                </g>
            )}
        </svg>
    );
}

export default Bubby;
