/**
 * ConfettiBurst: a light, non-blocking confetti shower for real milestones.
 * At most 24 spans, transform/opacity only, ≤1.2s, `pointer-events-none`,
 * unmounted when done. Under reduced motion it shows a static sparkle badge
 * instead.
 */

import { useEffect, useState, type CSSProperties } from "react";
import { Sparkles } from "lucide-react";

export interface ConfettiBurstProps {
    /** Called once the burst has finished and unmounted itself. */
    onDone?: () => void;
    pieces?: number;
}

const COLORS = [
    "var(--pastel-lilac, #dfc2ff)",
    "var(--pastel-butter, #ffe999)",
    "var(--pastel-mint, #bbf7d0)",
    "var(--pastel-coral, #fecdd3)",
    "var(--pastel-pink, #f7a8c9)",
];

const MAX_PIECES = 24;
const MAX_MS = 1200;

function reducedMotion(): boolean {
    try {
        return (
            window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
            false
        );
    } catch {
        return false;
    }
}

/** Deterministic spread (golden-ratio sequence) so renders stay pure. */
function piece(i: number) {
    const a = (i * 0.618034) % 1;
    const b = (i * 0.381966 + 0.5) % 1;
    return {
        left: `${8 + a * 84}%`,
        x: `${Math.round((b - 0.5) * 160)}px`,
        y: `${Math.round(55 + b * 25)}vh`,
        r: `${Math.round(240 + a * 480) * (i % 2 ? 1 : -1)}deg`,
        d: `${Math.round(850 + b * 280)}ms`,
        delay: `${Math.round(a * 60)}ms`,
        w: i % 3 === 0 ? 8 : 6,
        h: i % 3 === 0 ? 8 : 12,
        round: i % 4 === 0,
        color: COLORS[i % COLORS.length],
    };
}

export function ConfettiBurst({
    onDone,
    pieces = MAX_PIECES,
}: ConfettiBurstProps) {
    const [done, setDone] = useState(false);
    const [still] = useState(reducedMotion);
    const count = Math.min(Math.max(pieces, 0), MAX_PIECES);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setDone(true);
            onDone?.();
        }, MAX_MS);
        return () => window.clearTimeout(timer);
    }, [onDone]);

    if (done) return null;

    if (still) {
        return (
            <div
                aria-hidden="true"
                data-testid="confetti-static"
                className="pointer-events-none fixed left-1/2 top-28 z-9998 -translate-x-1/2 rounded-full border-2 border-(--border-ink) bg-(--pastel-butter) p-2 shadow-cute-sm"
            >
                <Sparkles
                    className="h-5 w-5 text-(--text-ink)"
                    strokeWidth={2.5}
                />
            </div>
        );
    }

    return (
        <div
            aria-hidden="true"
            data-testid="confetti-burst"
            className="pointer-events-none fixed inset-x-0 top-0 z-9998 h-0 overflow-visible"
        >
            {Array.from({ length: count }, (_, i) => {
                const p = piece(i);
                return (
                    <span
                        key={i}
                        className={`absolute top-14 border border-(--border-ink) animate-confetti-fall ${p.round ? "rounded-full" : "rounded-xs"}`}
                        style={
                            {
                                left: p.left,
                                width: p.w,
                                height: p.h,
                                backgroundColor: p.color,
                                animationDelay: p.delay,
                                "--confetti-x": p.x,
                                "--confetti-y": p.y,
                                "--confetti-r": p.r,
                                "--confetti-d": p.d,
                            } as CSSProperties
                        }
                    />
                );
            })}
        </div>
    );
}

export default ConfettiBurst;
