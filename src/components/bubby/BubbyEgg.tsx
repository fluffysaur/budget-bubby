/**
 * Unhatched Bubby egg: Warm Oat SVG matching Bubby's stroke weight and palette.
 * Shows progressive cracks (`cracks`: 0..4) as onboarding quests complete, and
 * wobbles gently when tapped or ready to hatch (`cracks >= 4`).
 */

import { INK } from "../../lib/bubby/anchors";
import type { BubbySize } from "./Bubby";

const SIZE_CLASS: Record<BubbySize, string> = {
    mini: "h-6 w-6",
    xs: "h-7 w-7",
    sm: "h-12 w-12",
    md: "h-24 w-24",
    pair: "h-28 w-28 sm:h-32 sm:w-32",
    lg: "h-40 w-40",
};

const STROKE = {
    stroke: INK,
    strokeWidth: 11,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

export interface BubbyEggProps {
    /** Number of completed starter quests (0..4) controlling crack stages. */
    cracks?: number;
    size?: BubbySize;
    className?: string;
    /** Optional partner accent colour (matches scarf palette in couple mode). */
    accent?: string;
    /** Triggers a short wobble animation when tapped. */
    wobbling?: boolean;
    /** Hide from screen readers (e.g. inside a labelled button). */
    decorative?: boolean;
    label?: string;
}

export function BubbyEgg({
    cracks = 0,
    size = "md",
    className = "",
    accent,
    wobbling = false,
    decorative = false,
    label = "Bubby egg",
}: BubbyEggProps) {
    const stage = Math.max(0, Math.min(4, Math.floor(cracks)));
    const ready = stage >= 4;
    const compact = size === "xs" || size === "mini";
    const speckleColor = accent ?? "var(--pastel-lilac, #e9d5ff)";

    return (
        <svg
            viewBox="0 0 512 512"
            width={512}
            height={512}
            role={decorative ? undefined : "img"}
            aria-label={decorative ? undefined : label}
            aria-hidden={decorative || undefined}
            data-testid="bubby-egg"
            data-stage={stage}
            data-wobble={wobbling || ready ? "true" : undefined}
            className={`bubby-egg inline-block select-none shrink-0 ${SIZE_CLASS[size]} ${className}`}
        >
            {/* Soft ground shadow */}
            <ellipse
                cx="256"
                cy="458"
                rx="116"
                ry="18"
                fill="var(--border-subtle, #e2d9cd)"
                opacity="0.7"
            />

            <g className="bubby-egg-shell">
                {/* Ready-to-hatch warm aura behind egg */}
                {ready && !compact && (
                    <ellipse
                        cx="256"
                        cy="284"
                        rx="148"
                        ry="168"
                        fill="var(--pastel-butter-light, #fef9c3)"
                        opacity="0.7"
                    />
                )}

                {/* Egg shell */}
                <path
                    d="M 256 106 C 328 106 382 214 382 314 C 382 398 328 450 256 450 C 184 450 130 398 130 314 C 130 214 184 106 256 106 Z"
                    fill="var(--bg-card, #fffdf7)"
                    {...STROKE}
                />

                {/* Soft highlight */}
                <path
                    d="M 184 218 C 174 248 170 282 174 312"
                    fill="none"
                    stroke="var(--bg-cream, #f8f3eb)"
                    strokeWidth="16"
                    strokeLinecap="round"
                />

                {/* Cute speckles */}
                <circle cx="198" cy="348" r="20" fill={speckleColor} />
                <circle
                    cx="320"
                    cy="252"
                    r="16"
                    fill="var(--pastel-butter, #fde68a)"
                />
                <circle
                    cx="296"
                    cy="376"
                    r="13"
                    fill="var(--pastel-mint, #bbf7d0)"
                />
                {!compact && (
                    <circle
                        cx="224"
                        cy="188"
                        r="11"
                        fill={speckleColor}
                        opacity="0.85"
                    />
                )}

                {/* Stage 1+: first hairline crack */}
                {stage >= 1 && (
                    <path
                        d="M 288 186 L 266 222 L 292 246 L 274 274"
                        fill="none"
                        stroke={INK}
                        strokeWidth={compact ? 14 : 10}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Stage 2+: branch crack on the left */}
                {stage >= 2 && (
                    <path
                        d="M 266 222 L 234 236 L 214 218"
                        fill="none"
                        stroke={INK}
                        strokeWidth={compact ? 13 : 9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Stage 3+: lower zigzag crack */}
                {stage >= 3 && (
                    <path
                        d="M 274 274 L 312 296 L 344 282 M 234 236 L 212 276 L 178 292"
                        fill="none"
                        stroke={INK}
                        strokeWidth={compact ? 13 : 9}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Stage 4: ready-to-hatch sparkles */}
                {ready && !compact && (
                    <g fill="var(--pastel-butter, #fde68a)" stroke={INK} strokeWidth="6">
                        <path d="M 116 164 L 124 184 L 144 192 L 124 200 L 116 220 L 108 200 L 88 192 L 108 184 Z" />
                        <path d="M 398 152 L 404 168 L 420 174 L 404 180 L 398 196 L 392 180 L 376 174 L 392 168 Z" />
                    </g>
                )}
            </g>
        </svg>
    );
}

export default BubbyEgg;
