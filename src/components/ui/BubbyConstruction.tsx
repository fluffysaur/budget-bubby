import React from "react";

export interface BubbyConstructionProps {
    className?: string;
}

const INK = "#141414";
const FEATHER = "#2b333c";
const COIN = "#f6c344";
const COIN_SHINE = "#ffe999";

// Coin-bricks in a half-built wall, bottom row first: [x, y]
const BRICKS: [number, number][] = [
    [470, 470],
    [530, 470],
    [590, 470],
    [500, 432],
    [560, 432],
    [530, 394],
    [590, 394],
    [560, 356],
];

/**
 * Bubby the penguin in a hard hat, tapping a hammer on a stack of coin-bricks.
 * Used for "Under Construction" placeholders. The hammer swing is a CSS
 * animation (`animate-bubby-hammer`) that stops when reduced motion is on.
 */
export const BubbyConstruction: React.FC<BubbyConstructionProps> = ({
    className = "h-40 w-auto",
}) => {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="30 50 620 490"
            className={className}
            aria-hidden="true"
        >
            {/* Coin-brick wall */}
            {BRICKS.map(([x, y]) => (
                <g key={`${x}-${y}`}>
                    <rect
                        x={x}
                        y={y}
                        width="56"
                        height="34"
                        rx="9"
                        fill={COIN}
                        stroke={INK}
                        strokeWidth="7"
                    />
                    <circle
                        cx={x + 28}
                        cy={y + 17}
                        r="8"
                        fill={COIN_SHINE}
                        stroke={INK}
                        strokeWidth="4"
                    />
                </g>
            ))}

            {/* Ground */}
            <path
                d="M 50 512 L 640 512"
                stroke={INK}
                strokeWidth="10"
                strokeLinecap="round"
            />

            {/* Body */}
            <path
                d="M 106 512
                   C 104 436, 118 368, 128 316
                   C 134 282, 130 242, 144 198
                   C 164 134, 206 112, 260 112
                   C 314 112, 356 134, 376 198
                   C 390 242, 386 282, 392 316
                   C 402 368, 416 436, 414 512
                   Z"
                fill={FEATHER}
                stroke={INK}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Face mask and tummy */}
            <path
                d="M 260 258
                   C 246 190, 160 180, 150 256
                   C 142 312, 174 342, 168 368
                   C 158 412, 146 462, 146 512
                   L 374 512
                   C 374 462, 362 412, 352 368
                   C 346 342, 378 312, 370 256
                   C 360 180, 274 190, 260 258
                   Z"
                fill="#ffffff"
                stroke={INK}
                strokeWidth="11"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Resting left flipper */}
            <path
                d="M 134 330
                   C 96 360, 72 410, 86 432
                   C 98 450, 128 430, 140 410
                   Z"
                fill={FEATHER}
                stroke={INK}
                strokeWidth="12"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Hard hat */}
            <path
                d="M 158 150 C 158 72, 362 72, 362 150 Z"
                fill="var(--pastel-butter, #ffe999)"
                stroke={INK}
                strokeWidth="11"
                strokeLinejoin="round"
            />
            <path
                d="M 246 150 L 246 96 Q 260 84 274 96 L 274 150"
                fill="none"
                stroke={INK}
                strokeWidth="8"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            <rect
                x="136"
                y="140"
                width="248"
                height="24"
                rx="12"
                fill="var(--pastel-butter, #ffe999)"
                stroke={INK}
                strokeWidth="10"
            />

            {/* Focused eyes */}
            <path
                d="M 178 262 Q 197 242 216 262"
                fill="none"
                stroke={INK}
                strokeWidth="11"
                strokeLinecap="round"
            />
            <path
                d="M 304 262 Q 323 242 342 262"
                fill="none"
                stroke={INK}
                strokeWidth="11"
                strokeLinecap="round"
            />

            {/* Blush */}
            <ellipse cx="176" cy="296" rx="22" ry="12" fill="#f7a8c9" opacity="0.9" />
            <ellipse cx="344" cy="296" rx="22" ry="12" fill="#f7a8c9" opacity="0.9" />

            {/* Beak */}
            <path
                d="M 226 280
                   Q 260 260 294 280
                   Q 286 312 260 314
                   Q 234 312 226 280 Z"
                fill="#f59e42"
                stroke={INK}
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Hammer arm (swings around the shoulder) */}
            <g className="animate-bubby-hammer">
                <path
                    d="M 380 318
                       C 420 292, 462 284, 474 302
                       C 486 322, 446 346, 388 366
                       Z"
                    fill={FEATHER}
                    stroke={INK}
                    strokeWidth="12"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <path
                    d="M 462 314 L 516 226"
                    stroke={INK}
                    strokeWidth="30"
                    strokeLinecap="round"
                />
                <path
                    d="M 462 314 L 516 226"
                    stroke="#c98b4f"
                    strokeWidth="16"
                    strokeLinecap="round"
                />
                <rect
                    x="486"
                    y="206"
                    width="72"
                    height="38"
                    rx="9"
                    transform="rotate(32 522 225)"
                    fill="#9aa4b0"
                    stroke={INK}
                    strokeWidth="9"
                />
            </g>
        </svg>
    );
};

export default BubbyConstruction;
