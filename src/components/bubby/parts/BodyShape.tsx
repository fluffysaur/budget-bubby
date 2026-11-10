/**
 * Bubby's four body shapes. Always a penguin; the shape shows how well fed
 * (Chubby), how active (Lean), or both (Buff) the household keeps Bubby.
 */

import type { BubbyBody } from "../../../lib/bubby/body";
import { BEAK, FEATHER, INK, SCARF_ANCHOR } from "../../../lib/bubby/anchors";

const STROKE = {
    stroke: INK,
    strokeWidth: 11,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

interface Shape {
    body: string;
    mask: string;
    flipperL: string;
    flipperR: string;
    headband?: { y: number; half: number; color: string };
}

const SHAPES: Record<BubbyBody, Shape> = {
    regular: {
        body: "M 136 462 C 116 384 124 304 136 246 C 152 166 198 124 256 124 C 314 124 360 166 376 246 C 388 304 396 384 376 462 Z",
        mask: "M 256 262 C 244 200 166 192 158 260 C 152 312 180 336 176 362 C 168 404 166 436 178 460 L 334 460 C 346 436 344 404 336 362 C 332 336 360 312 354 260 C 346 192 268 200 256 262 Z",
        flipperL: "M 144 286 C 106 248 62 220 58 248 C 54 280 82 344 138 378 Z",
        flipperR:
            "M 368 330 C 410 358 438 398 426 420 C 416 438 386 428 366 408 Z",
    },
    chubby: {
        body: "M 112 462 C 84 400 96 320 128 262 C 156 180 200 136 256 136 C 312 136 356 180 384 262 C 416 320 428 400 400 462 Z",
        mask: "M 256 272 C 244 212 170 206 162 270 C 156 310 168 326 158 352 C 136 400 144 440 164 460 L 348 460 C 368 440 376 400 354 352 C 344 326 356 310 350 270 C 342 206 268 212 256 272 Z",
        flipperL: "M 132 304 C 96 274 58 256 56 282 C 54 310 84 352 126 378 Z",
        flipperR:
            "M 384 334 C 428 362 452 400 440 422 C 430 440 400 430 380 410 Z",
    },
    lean: {
        body: "M 160 462 C 146 384 150 300 158 240 C 170 160 208 112 256 112 C 304 112 342 160 354 240 C 362 300 366 384 352 462 Z",
        mask: "M 256 252 C 246 194 186 188 180 250 C 176 300 198 330 194 360 C 188 404 188 436 198 460 L 314 460 C 324 436 324 404 318 360 C 314 330 336 300 332 250 C 326 188 266 194 256 252 Z",
        flipperL:
            "M 164 284 C 132 248 96 224 92 248 C 88 274 116 336 160 372 Z",
        flipperR:
            "M 348 326 C 382 356 402 396 392 416 C 384 432 360 422 346 404 Z",
        headband: { y: 176, half: 92, color: "var(--pastel-mint, #bbf7d0)" },
    },
    buff: {
        body: "M 150 462 C 140 400 136 330 124 274 C 114 222 172 128 256 128 C 340 128 398 222 388 274 C 376 330 372 400 362 462 Z",
        mask: "M 256 262 C 244 202 168 194 160 262 C 154 312 180 336 176 362 C 168 404 168 436 180 460 L 332 460 C 344 436 344 404 336 362 C 332 336 358 312 352 262 C 344 194 268 202 256 262 Z",
        flipperL:
            "M 132 304 C 88 296 50 256 68 222 C 82 196 112 212 120 238 C 134 236 150 252 146 276 Z",
        flipperR:
            "M 380 304 C 424 296 462 256 444 222 C 430 196 400 212 392 238 C 378 236 362 252 366 276 Z",
        headband: { y: 172, half: 108, color: "var(--pastel-coral, #fecdd3)" },
    },
};

export interface BodyShapeProps {
    body: BubbyBody;
    part: "body" | "flipperL" | "flipperR";
}

/** One part of a body: the torso (with feet, mask and extras) or a flipper. */
export function BodyShape({ body, part }: BodyShapeProps) {
    const shape = SHAPES[body];
    if (part === "flipperL")
        return <path d={shape.flipperL} fill={FEATHER} {...STROKE} />;
    if (part === "flipperR")
        return <path d={shape.flipperR} fill={FEATHER} {...STROKE} />;

    const footRx = body === "chubby" ? 34 : 30;
    return (
        <g>
            <ellipse
                cx="220"
                cy="466"
                rx={footRx}
                ry="11"
                fill={BEAK}
                stroke={INK}
                strokeWidth="7"
            />
            <ellipse
                cx="292"
                cy="466"
                rx={footRx}
                ry="11"
                fill={BEAK}
                stroke={INK}
                strokeWidth="7"
            />
            <path d={shape.body} fill={FEATHER} {...STROKE} />
            <ellipse
                cx="192"
                cy="172"
                rx="18"
                ry="8"
                transform="rotate(-28 192 172)"
                fill="#ffffff"
                opacity="0.88"
            />
            <path d={shape.mask} fill="#ffffff" {...STROKE} />
            {shape.headband && (
                <path
                    d={`M ${256 - shape.headband.half} ${shape.headband.y + 6} Q 256 ${shape.headband.y - 18} ${256 + shape.headband.half} ${shape.headband.y + 6}`}
                    fill="none"
                    stroke={INK}
                    strokeWidth="26"
                    strokeLinecap="round"
                />
            )}
            {shape.headband && (
                <path
                    d={`M ${256 - shape.headband.half} ${shape.headband.y + 6} Q 256 ${shape.headband.y - 18} ${256 + shape.headband.half} ${shape.headband.y + 6}`}
                    fill="none"
                    stroke={shape.headband.color}
                    strokeWidth="14"
                    strokeLinecap="round"
                />
            )}
            {body === "buff" && (
                <path
                    d="M 232 392 q 24 10 48 0 M 232 420 q 24 10 48 0 M 256 380 L 256 440"
                    fill="none"
                    stroke={INK}
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.35"
                />
            )}
            {body === "chubby" && (
                <path
                    d="M 226 430 q 30 16 60 0"
                    fill="none"
                    stroke={INK}
                    strokeWidth="5"
                    strokeLinecap="round"
                    opacity="0.3"
                />
            )}
        </g>
    );
}

export interface ScarfProps {
    body: BubbyBody;
    color: string;
    /** Thicker lines so the scarf still reads at header size. */
    compact?: boolean;
}

/** A partner's scarf: a band round the neck with a short tail. */
export function Scarf({ body, color, compact = false }: ScarfProps) {
    const { y, half } = SCARF_ANCHOR[body];
    const band = `M ${256 - half} ${y} Q 256 ${y + 30} ${256 + half} ${y}`;
    const width = compact ? 46 : 30;
    const tail = `M 288 ${y + 14} L 296 ${y + 50} L 324 ${y + 46} L 316 ${y + 8} Z`;
    return (
        <g data-layer="scarf" data-scarf={color}>
            <path
                d={band}
                fill="none"
                stroke={INK}
                strokeWidth={width + 14}
                strokeLinecap="round"
            />
            <path
                d={band}
                fill="none"
                stroke={color}
                strokeWidth={width}
                strokeLinecap="round"
            />
            {!compact && <path d={tail} fill={color} {...STROKE} />}
        </g>
    );
}
