import type { StageId } from "../../../lib/bubby/growth";
import {
    BEAK,
    COIN,
    COIN_SHINE,
    CREAM,
    EGG,
    FEATHER,
    FLUFF,
    INK,
    SPECKLE,
} from "../../../lib/bubby/anchors";

const STROKE = {
    stroke: INK,
    strokeWidth: 11,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
};

/** Coin nest under the egg stages (ground layer). */
export function CoinNest() {
    return (
        <g>
            {[
                [176, 452],
                [226, 464],
                [286, 464],
                [336, 452],
            ].map(([cx, cy]) => (
                <g key={cx}>
                    <ellipse cx={cx} cy={cy} rx="32" ry="13" fill={COIN} stroke={INK} strokeWidth="7" />
                    <ellipse cx={cx} cy={cy - 2} rx="12" ry="4" fill={COIN_SHINE} />
                </g>
            ))}
        </g>
    );
}

function Egg({ cracked }: { cracked: boolean }) {
    return (
        <g>
            <path
                d="M 256 140 C 334 140 376 262 376 344 C 376 418 324 462 256 462 C 188 462 136 418 136 344 C 136 262 178 140 256 140 Z"
                fill={EGG}
                {...STROKE}
            />
            {[
                [210, 250, 9],
                [300, 222, 7],
                [322, 340, 10],
                [194, 372, 7],
                [266, 412, 8],
            ].map(([cx, cy, r]) => (
                <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={r} fill={SPECKLE} />
            ))}
            <ellipse cx="206" cy="208" rx="18" ry="8" transform="rotate(-32 206 208)" fill="#ffffff" opacity="0.85" />
            {cracked && (
                <g>
                    <path
                        d="M 146 300 L 188 284 L 212 312 L 248 288 L 280 314 L 316 290 L 366 304"
                        fill="none"
                        stroke={INK}
                        strokeWidth="8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                    <circle cx="232" cy="312" r="7" fill={INK} />
                    <circle cx="282" cy="312" r="7" fill={INK} />
                </g>
            )}
        </g>
    );
}

function Feet({ y = 466, rx = 28 }: { y?: number; rx?: number }) {
    return (
        <g>
            <ellipse cx="222" cy={y} rx={rx} ry="10" fill={BEAK} stroke={INK} strokeWidth="7" />
            <ellipse cx="290" cy={y} rx={rx} ry="10" fill={BEAK} stroke={INK} strokeWidth="7" />
        </g>
    );
}

function Tufts({ y }: { y: number }) {
    return (
        <path
            d={`M 232 ${y + 6} q 8 -30 22 -8 q 12 -28 24 4`}
            fill="none"
            stroke={INK}
            strokeWidth="8"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
    );
}

/** Half an eggshell worn as a hat by the hatchling. */
export function ShellHat() {
    return (
        <g>
            <path
                d="M 178 300 C 178 214 334 214 334 300 L 314 284 L 294 304 L 274 282 L 256 304 L 236 282 L 216 304 L 198 284 Z"
                fill={EGG}
                {...STROKE}
                strokeWidth="9"
            />
            <circle cx="228" cy="252" r="6" fill={SPECKLE} />
            <circle cx="290" cy="244" r="5" fill={SPECKLE} />
        </g>
    );
}

interface BodyParts {
    body: React.ReactNode;
    flipperL: React.ReactNode;
    flipperR: React.ReactNode;
}

export interface StageBodyProps {
    stage: StageId;
    part: keyof BodyParts;
    /** Hatchling wears its shell unless a head accessory is on. */
    showShell?: boolean;
}

/** One part (body, left or right flipper) of a stage's body. */
export function StageBody({ stage, part, showShell = true }: StageBodyProps) {
    return <>{stageParts(stage, showShell)[part]}</>;
}

function stageParts(stage: StageId, showShell: boolean): BodyParts {
    switch (stage) {
        case "egg":
        case "wobbly":
            return { body: <Egg cracked={stage === "wobbly"} />, flipperL: null, flipperR: null };
        case "hatchling":
            return {
                body: (
                    <g>
                        <Feet y={466} rx={20} />
                        <circle cx="256" cy="372" r="100" fill={FLUFF} {...STROKE} />
                        <ellipse cx="256" cy="396" rx="62" ry="52" fill={CREAM} />
                        {showShell ? <ShellHat /> : <Tufts y={276} />}
                    </g>
                ),
                flipperL: (
                    <ellipse cx="164" cy="388" rx="18" ry="34" transform="rotate(28 164 388)" fill={FLUFF} {...STROKE} strokeWidth="9" />
                ),
                flipperR: (
                    <ellipse cx="348" cy="388" rx="18" ry="34" transform="rotate(-28 348 388)" fill={FLUFF} {...STROKE} strokeWidth="9" />
                ),
            };
        case "chick":
            return {
                body: (
                    <g>
                        <Feet y={466} rx={24} />
                        <ellipse cx="256" cy="340" rx="128" ry="124" fill={FLUFF} {...STROKE} />
                        <Tufts y={222} />
                        <ellipse cx="256" cy="320" rx="88" ry="70" fill={CREAM} />
                        <ellipse cx="256" cy="414" rx="66" ry="40" fill={CREAM} />
                    </g>
                ),
                flipperL: (
                    <path d="M 138 318 C 100 330 88 366 104 380 C 118 392 140 372 146 352 Z" fill={FLUFF} {...STROKE} strokeWidth="10" />
                ),
                flipperR: (
                    <path d="M 374 318 C 412 330 424 366 408 380 C 394 392 372 372 366 352 Z" fill={FLUFF} {...STROKE} strokeWidth="10" />
                ),
            };
        case "fledgling":
            return {
                body: (
                    <g>
                        <Feet />
                        <path
                            d="M 148 462 C 128 392 134 318 146 262 C 162 192 204 158 256 158 C 308 158 350 192 366 262 C 378 318 384 392 364 462 Z"
                            fill={FEATHER}
                            {...STROKE}
                        />
                        <path
                            d="M 256 264 C 244 214 182 208 174 262 C 168 306 190 326 186 352 C 180 392 180 430 192 460 L 320 460 C 332 430 332 392 326 352 C 322 326 344 306 338 262 C 330 208 268 214 256 264 Z"
                            fill="#ffffff"
                            {...STROKE}
                            strokeWidth="10"
                        />
                        <circle cx="256" cy="166" r="16" fill={FLUFF} stroke={INK} strokeWidth="6" />
                        <circle cx="210" cy="430" r="14" fill={FLUFF} stroke={INK} strokeWidth="5" />
                        <circle cx="306" cy="420" r="12" fill={FLUFF} stroke={INK} strokeWidth="5" />
                    </g>
                ),
                flipperL: (
                    <path d="M 150 300 C 112 268 84 262 82 286 C 80 312 110 350 148 366 Z" fill={FEATHER} {...STROKE} />
                ),
                flipperR: (
                    <path d="M 360 312 C 398 342 418 380 406 398 C 396 412 372 400 358 382 Z" fill={FEATHER} {...STROKE} />
                ),
            };
        case "adult":
        default:
            return {
                body: (
                    <g>
                        <Feet rx={30} />
                        <path d="M 250 130 C 238 100 212 92 210 108 C 208 120 226 130 240 136 Z" fill={FEATHER} {...STROKE} />
                        <path d="M 262 130 C 272 94 304 88 304 106 C 304 120 286 130 270 136 Z" fill={FEATHER} {...STROKE} />
                        <path
                            d="M 136 462 C 116 384 124 304 136 246 C 152 166 198 124 256 124 C 314 124 360 166 376 246 C 388 304 396 384 376 462 Z"
                            fill={FEATHER}
                            {...STROKE}
                        />
                        <ellipse cx="190" cy="168" rx="18" ry="8" transform="rotate(-28 190 168)" fill="#ffffff" opacity="0.88" />
                        <path
                            d="M 256 262 C 244 200 166 192 158 260 C 152 312 180 336 176 362 C 168 404 166 436 178 460 L 334 460 C 346 436 344 404 336 362 C 332 336 360 312 354 260 C 346 192 268 200 256 262 Z"
                            fill="#ffffff"
                            {...STROKE}
                        />
                    </g>
                ),
                flipperL: (
                    <path d="M 144 286 C 106 248 62 220 58 248 C 54 280 82 344 138 378 Z" fill={FEATHER} {...STROKE} />
                ),
                flipperR: (
                    <path d="M 368 330 C 410 358 438 398 426 420 C 416 438 386 428 366 408 Z" fill={FEATHER} {...STROKE} />
                ),
            };
    }
}
