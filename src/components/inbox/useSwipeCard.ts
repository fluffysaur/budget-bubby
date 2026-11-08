/**
 * Horizontal swipe for the top inbox card. Pointer events drive a
 * translateX/rotate through a ref and requestAnimationFrame (no React state
 * per frame), so only transform and opacity animate.
 *
 * - Locks to the horizontal axis after 8px, so vertical scroll and
 *   pull-to-refresh keep working (the card also sets touch-action: pan-y).
 * - Commits past 35% of the width or on a fling faster than 0.5 px/ms;
 *   otherwise springs back.
 * - Reduced motion: no rotation or fly-out.
 */

import { useCallback, useEffect, useRef } from "react";

export type SwipeDirection = "right" | "left";

const AXIS_LOCK_PX = 8;
const COMMIT_RATIO = 0.35;
const FLING_PX_PER_MS = 0.5;
const SPRING = "transform 180ms cubic-bezier(.2,.8,.2,1), opacity 180ms ease";

function prefersReducedMotion(): boolean {
    try {
        return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
        return false;
    }
}

export interface SwipeCardOptions {
    enabled: boolean;
    /** Right swipe allowed (false when the item needs Edit). */
    canConfirm: boolean;
    onCommit: (direction: SwipeDirection) => void;
}

export function useSwipeCard({
    enabled,
    canConfirm,
    onCommit,
}: SwipeCardOptions) {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const confirmTintRef = useRef<HTMLDivElement | null>(null);
    const discardTintRef = useRef<HTMLDivElement | null>(null);
    const state = useRef({
        pointerId: -1,
        startX: 0,
        startY: 0,
        dx: 0,
        lastX: 0,
        lastT: 0,
        velocity: 0,
        axis: null as "x" | "y" | null,
        frame: 0,
    });
    const onCommitRef = useRef(onCommit);
    useEffect(() => {
        onCommitRef.current = onCommit;
    }, [onCommit]);

    const paint = useCallback((dx: number, transition = "") => {
        const card = cardRef.current;
        if (!card) return;
        const reduced = prefersReducedMotion();
        card.style.transition = transition;
        card.style.transform = reduced
            ? `translateX(${dx}px)`
            : `translateX(${dx}px) rotate(${dx / 20}deg)`;
        const width = card.offsetWidth || 1;
        const progress = Math.min(1, Math.abs(dx) / (width * COMMIT_RATIO));
        if (confirmTintRef.current)
            confirmTintRef.current.style.opacity =
                dx > 0 ? String(progress) : "0";
        if (discardTintRef.current)
            discardTintRef.current.style.opacity =
                dx < 0 ? String(progress) : "0";
    }, []);

    const reset = useCallback(() => {
        const s = state.current;
        s.pointerId = -1;
        s.dx = 0;
        s.axis = null;
        paint(0, SPRING);
    }, [paint]);

    const onPointerDown = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            if (!enabled || e.button !== 0) return;
            // Let buttons and chips inside the card take their own taps
            if ((e.target as HTMLElement).closest("button, a, select, input"))
                return;
            const s = state.current;
            s.pointerId = e.pointerId;
            s.startX = s.lastX = e.clientX;
            s.startY = e.clientY;
            s.lastT = e.timeStamp;
            s.dx = 0;
            s.velocity = 0;
            s.axis = null;
        },
        [enabled],
    );

    const onPointerMove = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const s = state.current;
            if (s.pointerId !== e.pointerId) return;
            const dx = e.clientX - s.startX;
            const dy = e.clientY - s.startY;
            if (!s.axis) {
                if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX)
                    return;
                s.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
                if (s.axis === "x") {
                    try {
                        e.currentTarget.setPointerCapture(e.pointerId);
                    } catch {
                        // Not supported (tests)
                    }
                }
            }
            if (s.axis !== "x") return;
            const dt = Math.max(1, e.timeStamp - s.lastT);
            s.velocity = (e.clientX - s.lastX) / dt;
            s.lastX = e.clientX;
            s.lastT = e.timeStamp;
            s.dx = !canConfirm && dx > 0 ? dx / 4 : dx; // resist when confirm isn't allowed
            cancelAnimationFrame(s.frame);
            s.frame = requestAnimationFrame(() => paint(s.dx));
        },
        [canConfirm, paint],
    );

    const onPointerUp = useCallback(
        (e: React.PointerEvent<HTMLDivElement>) => {
            const s = state.current;
            if (s.pointerId !== e.pointerId) return;
            cancelAnimationFrame(s.frame);
            if (s.axis !== "x") {
                reset();
                return;
            }
            const width = cardRef.current?.offsetWidth || 300;
            const far = Math.abs(s.dx) > width * COMMIT_RATIO;
            const fling = Math.abs(s.velocity) > FLING_PX_PER_MS;
            const direction: SwipeDirection = s.dx > 0 ? "right" : "left";
            if ((far || fling) && (direction === "left" || canConfirm)) {
                const card = cardRef.current;
                if (card) {
                    if (prefersReducedMotion()) {
                        card.style.transition = "opacity 120ms ease";
                    } else {
                        const out =
                            direction === "right" ? width * 1.5 : -width * 1.5;
                        paint(out, SPRING);
                    }
                    card.style.opacity = "0";
                }
                s.pointerId = -1;
                onCommitRef.current(direction);
                return;
            }
            reset();
        },
        [canConfirm, paint, reset],
    );

    /** Puts the card back to rest (call when a new item is shown). */
    const restore = useCallback(() => {
        const card = cardRef.current;
        if (!card) return;
        card.style.transition = "";
        card.style.transform = "";
        card.style.opacity = "";
        if (confirmTintRef.current) confirmTintRef.current.style.opacity = "0";
        if (discardTintRef.current) discardTintRef.current.style.opacity = "0";
    }, []);

    return {
        cardRef,
        confirmTintRef,
        discardTintRef,
        restore,
        handlers: {
            onPointerDown,
            onPointerMove,
            onPointerUp,
            onPointerCancel: reset,
        },
    };
}
