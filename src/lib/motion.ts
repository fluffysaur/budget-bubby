/**
 * Shared Motion System & Presets
 * Uses CSS-token-aligned durations and easings.
 * Always use `m.*` components inside `<LazyMotion features={domAnimation} strict>`.
 */

import type { Transition } from "motion/react";

export const EASE_OUT_SOFT: [number, number, number, number] = [
    0.16, 1, 0.3, 1,
];
export const EASE_IN_FAST: [number, number, number, number] = [0.4, 0, 1, 1];
export const EASE_SPRING: [number, number, number, number] = [0.3, 1.4, 0.5, 1];

export const DURATION = {
    instant: 0.1,
    fast: 0.16,
    enter: 0.18,
    base: 0.22,
    slow: 0.4,
} as const;

export const springSnappy: Transition = {
    type: "spring",
    stiffness: 500,
    damping: 34,
    mass: 0.8,
};

/**
 * Subtle fade + 4px upward rise (180ms).
 * Used for route transitions, tab panels, and card entrances.
 */
export const fadeRise = {
    initial: { opacity: 0, y: 4 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.enter, ease: EASE_OUT_SOFT },
    },
    exit: {
        opacity: 0,
        y: 4,
        transition: { duration: DURATION.fast, ease: EASE_IN_FAST },
    },
    transition: { duration: DURATION.enter, ease: EASE_OUT_SOFT },
};

/**
 * Subtle fade + scale 0.96 -> 1 (160ms).
 * Used for popovers, dropdown menus, badges, and floating pills.
 */
export const pop = {
    initial: { opacity: 0, scale: 0.96 },
    animate: {
        opacity: 1,
        scale: 1,
        transition: { duration: DURATION.fast, ease: EASE_OUT_SOFT },
    },
    exit: {
        opacity: 0,
        scale: 0.96,
        transition: { duration: DURATION.instant, ease: EASE_IN_FAST },
    },
    transition: { duration: DURATION.fast, ease: EASE_OUT_SOFT },
};

/**
 * Smooth height 0 <-> auto + opacity (220ms).
 * Used for collapsible sections, conditional banners, and inline field errors.
 */
export const collapse = {
    initial: { height: 0, opacity: 0, overflow: "hidden" as const },
    animate: {
        height: "auto",
        opacity: 1,
        overflow: "hidden" as const,
        transition: { duration: DURATION.base, ease: EASE_OUT_SOFT },
    },
    exit: {
        height: 0,
        opacity: 0,
        overflow: "hidden" as const,
        transition: { duration: DURATION.fast, ease: EASE_IN_FAST },
    },
    transition: { duration: DURATION.base, ease: EASE_OUT_SOFT },
};

/**
 * Layout-aware list row preset with fade-out exit.
 */
export const listItem = {
    layout: true as const,
    initial: { opacity: 0, y: 4 },
    animate: {
        opacity: 1,
        y: 0,
        transition: { duration: DURATION.fast, ease: EASE_OUT_SOFT },
    },
    exit: {
        opacity: 0,
        scale: 0.98,
        transition: { duration: DURATION.fast, ease: EASE_IN_FAST },
    },
    transition: { duration: DURATION.base, ease: EASE_OUT_SOFT },
};

/**
 * Safely checks whether the user prefers reduced motion.
 */
export function prefersReducedMotion(): boolean {
    return (
        typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
}

export { m, AnimatePresence } from "motion/react";
