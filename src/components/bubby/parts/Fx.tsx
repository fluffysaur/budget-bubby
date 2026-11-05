/**
 * Bubby effects: glow ring behind, Zzz / hearts / sparkles / dust in front.
 */

import { COIN, COIN_SHINE, INK, PINK } from "../../../lib/bubby/anchors";

const STAR = "M 0 -22 L 6 -6 L 22 0 L 6 6 L 0 22 L -6 6 L -22 0 L -6 -6 Z";
const HEART = "M 0 8 C -14 -10 -34 4 0 30 C 34 4 14 -10 0 8 Z";

export function GlowRing() {
    return <circle className="bubby-glow" cx="256" cy="310" r="200" fill="var(--pastel-butter, #ffe999)" opacity="0.55" />;
}

export function Zzz() {
    const z = (x: number, y: number, s: number) => (
        <path
            key={x}
            d="M 0 0 L 24 0 L 0 26 L 24 26"
            transform={`translate(${x} ${y}) scale(${s})`}
            fill="none"
            stroke={INK}
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    );
    return <g className="bubby-zzz">{[z(372, 160, 1), z(410, 112, 0.7)]}</g>;
}

export function Hearts() {
    return (
        <g>
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

/** A single coin held by a lonely Bubby (placed at the hand anchor). */
export function HeldCoin() {
    return (
        <g>
            <circle cx="0" cy="0" r="22" fill={COIN} stroke={INK} strokeWidth="7" />
            <circle cx="0" cy="0" r="9" fill={COIN_SHINE} />
        </g>
    );
}
