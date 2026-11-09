import { useCallback, useEffect, useState } from "react";
import type { RefObject } from "react";

export interface ScrollFadeState {
    canScrollUp: boolean;
    canScrollDown: boolean;
}

/** Sub-pixel tolerance so fractional scroll positions don't leave a phantom bottom fade. */
const EDGE_TOLERANCE_PX = 1;

export function computeScrollFade(
    scrollTop: number,
    scrollHeight: number,
    clientHeight: number,
): ScrollFadeState {
    return {
        canScrollUp: scrollTop > 0,
        canScrollDown:
            scrollTop + clientHeight < scrollHeight - EDGE_TOLERANCE_PX,
    };
}

const NO_FADE: ScrollFadeState = { canScrollUp: false, canScrollDown: false };

/**
 * Tracks whether a scroll container has more content above or below its viewport.
 * Re-measures on scroll and when the container or its children resize.
 */
export function useScrollFade(
    ref: RefObject<HTMLElement | null>,
): ScrollFadeState {
    const [state, setState] = useState<ScrollFadeState>(NO_FADE);

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const next = computeScrollFade(
            el.scrollTop,
            el.scrollHeight,
            el.clientHeight,
        );
        setState((prev) =>
            prev.canScrollUp === next.canScrollUp &&
            prev.canScrollDown === next.canScrollDown
                ? prev
                : next,
        );
    }, [ref]);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        measure();
        el.addEventListener("scroll", measure, { passive: true });

        let observer: ResizeObserver | undefined;
        if (typeof ResizeObserver !== "undefined") {
            observer = new ResizeObserver(measure);
            observer.observe(el);
            Array.from(el.children).forEach((child) =>
                observer?.observe(child),
            );
        }

        return () => {
            el.removeEventListener("scroll", measure);
            observer?.disconnect();
        };
    }, [ref, measure]);

    return state;
}
