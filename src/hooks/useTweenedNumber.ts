import { useEffect, useRef, useState } from "react";
import {
    animate,
    useReducedMotion,
    type AnimationPlaybackControls,
} from "motion/react";
import type { Easing } from "motion-utils";
import { DURATION, EASE_OUT_SOFT, prefersReducedMotion } from "../lib/motion";

export interface UseTweenedNumberOptions {
    /** Duration in seconds. Defaults to DURATION.base (0.22s). */
    duration?: number;
    /** Easing curve. Defaults to EASE_OUT_SOFT ([0.16, 1, 0.3, 1]). */
    ease?: Easing | Easing[];
    /** When true, skips tweening and returns the target value immediately. */
    disabled?: boolean;
}

/**
 * Smoothly tweens a number towards a target value over a brief duration.
 * Respects prefers-reduced-motion by snapping immediately without animation.
 */
export function useTweenedNumber(
    value: number,
    options: UseTweenedNumberOptions = {},
): number {
    const {
        duration = DURATION.base,
        ease = EASE_OUT_SOFT,
        disabled = false,
    } = options;

    // useReducedMotion() caches the media query; the direct check also honours
    // matchMedia changes/mocks, so both are consulted.
    const motionReduced = useReducedMotion();
    const isReduced = Boolean(motionReduced || prefersReducedMotion());
    const shouldSkipAnimation =
        disabled || isReduced || !Number.isFinite(value);

    const [current, setCurrent] = useState(value);
    const targetRef = useRef(value);
    const displayRef = useRef(value);

    useEffect(() => {
        if (shouldSkipAnimation) {
            targetRef.current = value;
            displayRef.current = value;
            setCurrent(value);
            return;
        }

        if (targetRef.current === value) {
            return;
        }

        const from = displayRef.current;
        targetRef.current = value;

        if (from === value || duration <= 0) {
            displayRef.current = value;
            setCurrent(value);
            return;
        }

        const controls: AnimationPlaybackControls = animate(from, value, {
            duration,
            ease,
            onUpdate: (latest: number) => {
                displayRef.current = latest;
                setCurrent(latest);
            },
            onComplete: () => {
                displayRef.current = value;
                setCurrent(value);
            },
        });

        return () => {
            controls.stop();
        };
    }, [value, duration, ease, shouldSkipAnimation]);

    return shouldSkipAnimation ? value : current;
}
