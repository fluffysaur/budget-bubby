/**
 * Bubby effects and mood overlays: glow, hearts, sparkles, dust, a rumbly
 * tummy, tears, and a little "miss you" sign.
 */

import { COIN, INK, PINK, SIGN, TEAR } from "../../../lib/bubby/anchors";

const STAR = "M 0 -22 L 6 -6 L 22 0 L 6 6 L 0 22 L -6 6 L -22 0 L -6 -6 Z";
const HEART = "M 0 8 C -14 -10 -34 4 0 30 C 34 4 14 -10 0 8 Z";

export function GlowRing() {
    return (
        <circle
            className="bubby-glow"
            cx="256"
            cy="310"
            r="200"
            fill="var(--pastel-butter, #ffe999)"
            opacity="0.55"
        />
    );
}

export function Hearts() {
    return (
        <g className="bubby-sparkles">
            {[
                [392, 176, 1],
                [122, 196, 0.8],
            ].map(([x, y, s]) => (
                <path
                    key={x}
                    d={HEART}
                    transform={`translate(${x} ${y}) scale(${s})`}
                    fill={PINK}
                    stroke={INK}
                    strokeWidth="5"
                    strokeLinejoin="round"
                />
            ))}
        </g>
    );
}

export function Sparkles() {
    return (
        <g className="bubby-sparkles">
            {[
                [108, 168, 1, COIN],
                [404, 140, 1.2, "var(--pastel-lilac, #dfc2ff)"],
                [432, 300, 0.8, COIN],
            ].map(([x, y, s, fill]) => (
                <path
                    key={String(x)}
                    d={STAR}
                    transform={`translate(${x} ${y}) scale(${s})`}
                    fill={String(fill)}
                    stroke={INK}
                    strokeWidth="4"
                    strokeLinejoin="round"
                />
            ))}
        </g>
    );
}

export function Dust() {
    return (
        <g className="bubby-dust" fill="#d8d0c7" stroke={INK} strokeWidth="4">
            <circle cx="164" cy="446" r="22" />
            <circle cx="346" cy="448" r="20" />
            <circle cx="256" cy="474" r="16" />
        </g>
    );
}

/** Rumbly tummy: little wavy lines beside the belly. */
export function Rumble() {
    const wave = "M 0 0 q 8 -10 16 0 q 8 10 16 0 q 8 -10 16 0";
    return (
        <g
            data-overlay="rumble"
            fill="none"
            stroke={INK}
            strokeWidth="6"
            strokeLinecap="round"
            opacity="0.7"
        >
            <path d={wave} transform="translate(184 404) rotate(-12)" />
            <path d={wave} transform="translate(282 412) rotate(10)" />
        </g>
    );
}

/** Tears under the eyes (face coordinates). */
export function Tears() {
    const drop = "M 0 0 C -9 13 -9 24 0 26 C 9 24 9 13 0 0 Z";
    return (
        <g data-overlay="tears">
            {[-63, 63].map((x) => (
                <path
                    key={x}
                    d={drop}
                    transform={`translate(${x} 4)`}
                    fill={TEAR}
                    stroke={INK}
                    strokeWidth="4"
                />
            ))}
        </g>
    );
}

/** A little sign held up beside Bubby. */
export function MissYouSign({ compact }: { compact: boolean }) {
    return (
        <g data-overlay="sign">
            <path
                d="M 404 456 L 404 352"
                stroke={INK}
                strokeWidth="9"
                strokeLinecap="round"
            />
            <rect
                x="336"
                y="288"
                width="138"
                height="70"
                rx="12"
                fill={SIGN}
                stroke={INK}
                strokeWidth="7"
            />
            <path
                d={HEART}
                transform="translate(360 312) scale(0.6)"
                fill={PINK}
                stroke={INK}
                strokeWidth="5"
            />
            {!compact && (
                <text
                    x="420"
                    y="331"
                    textAnchor="middle"
                    fontSize="22"
                    fontWeight="800"
                    fill={INK}
                    fontFamily="inherit"
                >
                    miss you
                </text>
            )}
        </g>
    );
}
