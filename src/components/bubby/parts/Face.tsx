/**
 * Bubby face parts, drawn around the face origin (centre between the eyes).
 * Eyes sit at x = ±63, cheeks at ±84, the beak just below.
 */

import type { BeakShape, EyeShape } from "../../../lib/bubby/moods";
import {
    BEAK,
    BLUSH,
    BLUSH_LINE,
    COIN,
    INK,
    PINK,
} from "../../../lib/bubby/anchors";

const EYE_X = [-63, 63];

export function Eyes({
    shape,
    blinkDelay,
}: {
    shape: EyeShape;
    blinkDelay?: string;
}) {
    const line = {
        fill: "none",
        stroke: INK,
        strokeWidth: 11,
        strokeLinecap: "round" as const,
    };
    return (
        <g
            className="bubby-eyes"
            style={blinkDelay ? { animationDelay: blinkDelay } : undefined}
        >
            {EYE_X.map((cx) => {
                switch (shape) {
                    case "arc":
                        return (
                            <path
                                key={cx}
                                d={`M ${cx - 21} -6 Q ${cx} -34 ${cx + 21} -6`}
                                {...line}
                            />
                        );
                    case "droop": {
                        const outer = cx < 0 ? cx - 22 : cx + 22;
                        const inner = cx < 0 ? cx + 18 : cx - 18;
                        return (
                            <g key={cx}>
                                <circle cx={cx} cy="-8" r="11" fill={INK} />
                                <path
                                    d={`M ${outer} -20 L ${inner} -28`}
                                    {...line}
                                    strokeWidth={8}
                                />
                            </g>
                        );
                    }
                    case "sparkle":
                        return (
                            <path
                                key={cx}
                                d={`M ${cx} -40 L ${cx + 7} -21 L ${cx + 26} -14 L ${cx + 7} -7 L ${cx} 12 L ${cx - 7} -7 L ${cx - 26} -14 L ${cx - 7} -21 Z`}
                                fill={INK}
                            />
                        );
                    case "dot":
                    default:
                        return (
                            <g key={cx}>
                                <circle cx={cx} cy="-14" r="14" fill={INK} />
                                <circle
                                    cx={cx + 5}
                                    cy="-19"
                                    r="4.5"
                                    fill="#ffffff"
                                />
                            </g>
                        );
                }
            })}
        </g>
    );
}

export function Cheeks({ lines }: { lines: boolean }) {
    return (
        <g>
            {[-84, 84].map((cx) => (
                <g key={cx}>
                    <ellipse
                        cx={cx}
                        cy="26"
                        rx="23"
                        ry="12.5"
                        fill={BLUSH}
                        opacity="0.9"
                    />
                    {lines &&
                        [-8, 0, 8].map((dx) => (
                            <line
                                key={dx}
                                x1={cx + dx - 3}
                                y1="30"
                                x2={cx + dx + 2}
                                y2="22"
                                stroke={BLUSH_LINE}
                                strokeWidth="3.5"
                                strokeLinecap="round"
                            />
                        ))}
                </g>
            ))}
        </g>
    );
}

export function Beak({ shape }: { shape: BeakShape }) {
    const outline = {
        stroke: INK,
        strokeLinecap: "round" as const,
        strokeLinejoin: "round" as const,
    };
    if (shape === "closed") {
        return (
            <g className="bubby-beak">
                <path
                    d="M -32 10 Q 0 -10 32 10 Q 22 40 0 42 Q -22 40 -32 10 Z"
                    fill={BEAK}
                    {...outline}
                    strokeWidth="10"
                />
                <path
                    d="M -24 17 Q 0 25 24 17"
                    fill="none"
                    {...outline}
                    strokeWidth="5"
                />
            </g>
        );
    }
    return (
        <g className="bubby-beak">
            <path
                d="M -36 8 Q 0 -16 36 8 Q 30 52 0 56 Q -30 52 -36 8 Z"
                fill={BEAK}
                {...outline}
                strokeWidth="10"
            />
            <path
                d="M -23 15 Q 0 24 23 15 Q 17 44 0 46 Q -17 44 -23 15 Z"
                fill="#9a1b1b"
                {...outline}
                strokeWidth="6"
            />
            <path
                d="M -14 32 Q 0 25 14 32 Q 9 45 0 46 Q -9 45 -14 32 Z"
                fill={PINK}
            />
            {shape === "munch" && (
                <ellipse
                    cx="0"
                    cy="44"
                    rx="16"
                    ry="14"
                    fill={COIN}
                    stroke={INK}
                    strokeWidth="6"
                />
            )}
        </g>
    );
}
