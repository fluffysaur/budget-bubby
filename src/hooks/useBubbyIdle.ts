/**
 * Bubby's idle cycle for a penguin that sits on screen (sheet, dashboard
 * cards): a curious head tilt every 8-16s at random, and when sleepy a
 * yawn about every 20s. Returns the current idle moment, or null.
 * Does nothing when off or under prefers-reduced-motion.
 */

import { useEffect, useState } from "react";
import type { BubbyReaction } from "../lib/appEvents";
import { REACTION_MS } from "../lib/bubby/moods";
import { prefersReducedMotion } from "../lib/motion";

export const TILT_MIN_MS = 8_000;
export const TILT_MAX_MS = 16_000;
export const YAWN_EVERY_MS = 20_000;

export function useBubbyIdle(
    enabled: boolean,
    sleepy: boolean,
): BubbyReaction | null {
    const [act, setAct] = useState<BubbyReaction | null>(null);

    useEffect(() => {
        if (!enabled || prefersReducedMotion()) return;
        const timers = new Set<number>();
        const later = (fn: () => void, ms: number) => {
            const id = window.setTimeout(() => {
                timers.delete(id);
                fn();
            }, ms);
            timers.add(id);
        };
        const play = (kind: BubbyReaction) => {
            setAct(kind);
            later(() => setAct(null), REACTION_MS[kind]);
        };
        const tilt = () => {
            later(
                () => {
                    play("tilt");
                    tilt();
                },
                TILT_MIN_MS + Math.random() * (TILT_MAX_MS - TILT_MIN_MS),
            );
        };
        tilt();
        let yawn: number | undefined;
        if (sleepy)
            yawn = window.setInterval(() => play("yawn"), YAWN_EVERY_MS);
        return () => {
            timers.forEach((id) => window.clearTimeout(id));
            window.clearInterval(yawn);
            setAct(null);
        };
    }, [enabled, sleepy]);

    return act;
}
