/**
 * Bubby, the household penguin: one layered inline SVG for every stage.
 * Motion is CSS only (keyframes on `.bubby-*` classes keyed off
 * `data-reaction`) and stops under prefers-reduced-motion.
 */

import { useId } from "react";
import { STAGES, HATCHLING_STAGE } from "../../lib/bubby/growth";
import { ANCHORS, INK } from "../../lib/bubby/anchors";
import { MOOD_FACE, type BubbyMood, type EyeShape, type BeakShape } from "../../lib/bubby/moods";
import type { AccessoryId, AccessorySlot } from "../../lib/bubby/accessories";
import type { BubbyReaction } from "../../lib/appEvents";
import { CoinNest, StageBody } from "./parts/StageBody";
import { Beak, Brows, Cheeks, Eyes } from "./parts/Face";
import { Dust, GlowRing, Hearts, HeldCoin, Sparkles, Zzz } from "./parts/Fx";
import { AccessoryArt } from "./accessories/AccessoryArt";

export type BubbySize = "xs" | "sm" | "md" | "lg";

const SIZE_CLASS: Record<BubbySize, string> = {
    xs: "h-7 w-7",
    sm: "h-12 w-12",
    md: "h-24 w-24",
    lg: "h-40 w-40",
};

export interface BubbyProps {
    stage: number;
    mood?: BubbyMood;
    reaction?: BubbyReaction | null;
    equipped?: Partial<Record<AccessorySlot, AccessoryId>>;
    size?: BubbySize;
    className?: string;
    /** Hide from screen readers (e.g. inside a labelled button). */
    decorative?: boolean;
}

function blinkDelayFor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    // Spread blinks over ±1s around the 5s loop
    return `${(Math.abs(hash) % 20) / 10 - 1}s`;
}

export function Bubby({
    stage,
    mood = "happy",
    reaction = null,
    equipped = {},
    size = "md",
    className = "",
    decorative = false,
}: BubbyProps) {
    const instanceId = useId();
    const safeStage = Math.min(Math.max(stage, 0), STAGES.length - 1);
    const stageDef = STAGES[safeStage];
    const anchors = ANCHORS[stageDef.id];
    const hasFace = safeStage >= HATCHLING_STAGE && Boolean(anchors);
    const compact = size === "xs";
    const face = MOOD_FACE[mood];

    let eyes: EyeShape = face.eyes;
    let beak: BeakShape = face.beak;
    if (reaction === "celebrate") {
        eyes = "sparkle";
        beak = "open";
    } else if (reaction === "cheer" || reaction === "poof") {
        eyes = "arc";
        beak = "open";
    } else if (reaction === "munch") {
        beak = "munch";
    }

    const neck = equipped.neck ?? (mood === "snug" ? "scarf" : undefined);
    const hand = equipped.hand;
    const label = `Bubby, ${stageDef.name.toLowerCase()}, ${mood}`;

    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 512 512"
            className={`bubby ${SIZE_CLASS[size]} ${className}`}
            data-stage={stageDef.id}
            data-mood={mood}
            data-reaction={reaction ?? undefined}
            data-blink={eyes === "dot" ? "" : undefined}
            {...(decorative
                ? { "aria-hidden": true }
                : { role: "img", "aria-label": label })}
        >
            <g data-layer="ground">
                <ellipse cx="256" cy="476" rx="140" ry="14" fill={INK} opacity="0.12" />
                {safeStage < HATCHLING_STAGE && <CoinNest />}
            </g>

            {!compact && (
                <g data-layer="fx-back">{reaction === "celebrate" && <GlowRing />}</g>
            )}

            <g data-layer="body" className="bubby-body">
                <StageBody stage={stageDef.id} part="body" showShell={!equipped.head} />

                {hasFace && anchors && (
                    <>
                        <g data-layer="flipper-l" className="bubby-flipper-l">
                            <StageBody stage={stageDef.id} part="flipperL" />
                        </g>
                        <g data-layer="flipper-r">
                            <StageBody stage={stageDef.id} part="flipperR" />
                        </g>
                        <g data-layer="face" transform={anchors.face}>
                            <Eyes shape={eyes} blinkDelay={blinkDelayFor(instanceId)} />
                            {face.brows && <Brows />}
                            {face.blush && <Cheeks lines={!compact} />}
                            <Beak shape={beak} />
                        </g>
                        <g data-layer="acc-neck" transform={anchors.neck}>
                            {neck && <AccessoryArt id={neck} />}
                        </g>
                        <g data-layer="acc-face" transform={anchors.face}>
                            {equipped.face && <AccessoryArt id={equipped.face} />}
                        </g>
                        <g data-layer="acc-head" transform={anchors.head}>
                            {equipped.head && <AccessoryArt id={equipped.head} />}
                        </g>
                        <g data-layer="acc-hand" transform={anchors.handR}>
                            {hand ? <AccessoryArt id={hand} /> : face.fx === "coin" && <HeldCoin />}
                        </g>
                    </>
                )}
            </g>

            {!compact && (
                <g data-layer="fx-front">
                    {face.fx === "zzz" && !reaction && <Zzz />}
                    {(face.fx === "hearts" || (reaction === "celebrate" && mood === "proud")) && <Hearts />}
                    {reaction === "celebrate" && <Sparkles />}
                    {reaction === "poof" && <Dust />}
                </g>
            )}
        </svg>
    );
}

export default Bubby;
