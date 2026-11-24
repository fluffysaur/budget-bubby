/**
 * Fullscreen darkened vignette hatch spotlight.
 * Tapping the egg 3 times progressively cracks it open with a tactile shake,
 * then splits & fades the eggshell away as Bubby pops out celebrating.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { INK } from "../../lib/bubby/anchors";
import type { BubbyBody } from "../../lib/bubby/body";
import { playEggCrack, playHatchFanfare } from "../../lib/soundEffects";
import { AnimatedModal } from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Bubby } from "./Bubby";
import { BubbyEgg } from "./BubbyEgg";

const TAPS_REQUIRED = 3;
const NOOP = () => {};
const HATCH_BACKDROP_STYLE = {
    background:
        "radial-gradient(circle at center, rgba(255, 236, 179, 0.16) 0%, rgba(16, 14, 22, 0.84) 46%, rgba(6, 5, 10, 0.96) 100%)",
    backdropFilter: "blur(6px)",
};

export interface HatchStageProps {
    body?: BubbyBody;
    scarf?: string;
    onHatched: () => void;
    onContinue: () => void;
}

/** Upper & lower eggshell halves that split apart behind Bubby and fade immediately. */
function SplitEggshell({ accent }: { accent?: string }) {
    const speckle = accent ?? "var(--pastel-lilac, #e9d5ff)";
    return (
        <svg
            viewBox="0 0 512 512"
            width={512}
            height={512}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 h-44 w-44"
        >
            <g className="animate-shell-top">
                <path
                    d="M 138 268 L 194 242 L 246 276 L 304 236 L 374 268 C 366 184 318 106 256 106 C 194 106 146 184 138 268 Z"
                    fill="var(--bg-card, #fffdf7)"
                    stroke={INK}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="224" cy="188" r="12" fill={speckle} />
            </g>
            <g className="animate-shell-bottom">
                <path
                    d="M 138 286 L 194 260 L 246 294 L 304 254 L 374 286 C 380 300 382 312 382 322 C 382 400 328 450 256 450 C 184 450 130 400 130 322 C 130 312 132 300 138 286 Z"
                    fill="var(--bg-card, #fffdf7)"
                    stroke={INK}
                    strokeWidth="11"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />
                <circle cx="198" cy="356" r="18" fill={speckle} />
                <circle
                    cx="296"
                    cy="380"
                    r="13"
                    fill="var(--pastel-mint, #bbf7d0)"
                />
            </g>
        </svg>
    );
}

export function HatchStage({
    body = "regular",
    scarf,
    onHatched,
    onContinue,
}: HatchStageProps) {
    const [taps, setTaps] = useState(0);
    const isHatched = taps >= TAPS_REQUIRED;
    const meetBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (isHatched) {
            meetBtnRef.current?.focus({ preventScroll: true });
        }
    }, [isHatched]);

    const handleTap = useCallback(() => {
        if (isHatched) return;
        const next = taps + 1;
        setTaps(next);
        try {
            playEggCrack(Math.min(3, next) as 1 | 2 | 3);
        } catch {
            // Audio optional in headless/muted environments
        }
        if (next >= TAPS_REQUIRED) {
            try {
                playHatchFanfare();
            } catch {
                // Audio optional in headless/muted environments
            }
            onHatched();
        }
    }, [isHatched, taps, onHatched]);

    const prompt =
        taps === 0
            ? "Tap the egg to hatch!"
            : taps === 1
              ? "Keep tapping!"
              : "One more tap!";

    return (
        <AnimatedModal
            isOpen={true}
            onClose={isHatched ? onContinue : NOOP}
            variant="spotlight"
            closeOnBackdropClick={false}
            closeOnEscape={isHatched}
            ariaLabel="Hatch Bubby"
            data-testid="hatch-stage"
            backdropStyle={HATCH_BACKDROP_STYLE}
        >
            <div className="flex w-full max-w-xs flex-col items-center gap-5 text-center">
                {!isHatched ? (
                    <>
                        <button
                            type="button"
                            data-testid="hatch-egg-target"
                            aria-label={`Tap egg to hatch (${TAPS_REQUIRED - taps} left)`}
                            onClick={handleTap}
                            className="relative flex h-48 w-48 items-center justify-center rounded-full border-2 border-(--border-ink) bg-(--pastel-butter-light) shadow-cute-lg cursor-pointer active:scale-95 transition-transform"
                        >
                            <span
                                key={taps}
                                className={
                                    taps > 0 ? "animate-egg-tap" : undefined
                                }
                            >
                                <BubbyEgg
                                    cracks={Math.min(4, taps + 2)}
                                    accent={scarf}
                                    size="lg"
                                    wobbling={taps === 0}
                                    decorative
                                />
                            </span>
                        </button>

                        <div className="space-y-2.5">
                            <p className="text-xl font-black font-display tracking-tight text-white drop-shadow-sm">
                                {prompt}
                            </p>
                            <div
                                className="flex items-center justify-center gap-2"
                                aria-hidden="true"
                            >
                                {Array.from({ length: TAPS_REQUIRED }).map(
                                    (_, idx) => (
                                        <span
                                            key={idx}
                                            className={`h-3 w-3 rounded-full border-2 border-(--border-ink) transition-colors ${
                                                idx < taps
                                                    ? "bg-(--pastel-mint)"
                                                    : "bg-white/25"
                                            }`}
                                        />
                                    ),
                                )}
                            </div>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="relative flex h-48 w-48 items-center justify-center rounded-full bg-(--pastel-butter-light)/20">
                            <SplitEggshell accent={scarf} />
                            <div className="relative z-10 animate-bubby-hatch-pop">
                                <Bubby
                                    body={body}
                                    mood="normal"
                                    reaction="celebrate"
                                    scarf={scarf}
                                    size="lg"
                                    idle
                                    decorative
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <h3 className="text-2xl font-black font-display tracking-tight text-white drop-shadow-sm">
                                Bubby Hatched!
                            </h3>
                            <p className="text-sm font-medium text-white/80">
                                Welcome Fish snack unlocked.
                            </p>
                        </div>

                        <Button
                            ref={meetBtnRef}
                            variant="primary"
                            size="md"
                            leftIcon={
                                <Sparkles
                                    className="h-4 w-4"
                                    strokeWidth={2.5}
                                />
                            }
                            onClick={onContinue}
                            data-testid="meet-bubby-btn"
                            className="w-full"
                        >
                            Meet Bubby
                        </Button>
                    </>
                )}
            </div>
        </AnimatedModal>
    );
}

export default HatchStage;
