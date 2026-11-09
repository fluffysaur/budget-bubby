import { forwardRef, useCallback, useRef } from "react";
import type { CSSProperties, HTMLAttributes } from "react";
import { useScrollFade } from "./useScrollFade";

const FADE_SIZE = "1.5rem";

export interface ScrollAreaProps extends HTMLAttributes<HTMLDivElement> {
    /** Set false to disable the edge fade masks. Defaults to true. */
    fade?: boolean;
}

/**
 * Vertical scroll container that softly fades its top edge once scrolled down
 * and its bottom edge while more content remains below.
 */
export const ScrollArea = forwardRef<HTMLDivElement, ScrollAreaProps>(
    function ScrollArea(
        { fade = true, className = "", style, children, ...rest },
        forwardedRef,
    ) {
        const innerRef = useRef<HTMLDivElement | null>(null);
        const { canScrollUp, canScrollDown } = useScrollFade(innerRef);

        const setRefs = useCallback(
            (node: HTMLDivElement | null) => {
                innerRef.current = node;
                if (typeof forwardedRef === "function") forwardedRef(node);
                else if (forwardedRef) forwardedRef.current = node;
            },
            [forwardedRef],
        );

        const top = fade && canScrollUp;
        const bottom = fade && canScrollDown;

        const maskStyle: CSSProperties = {};
        if (top || bottom) {
            const gradient = `linear-gradient(to bottom, ${
                top ? "transparent" : "black"
            } 0, black ${top ? FADE_SIZE : "0"}, black calc(100% - ${
                bottom ? FADE_SIZE : "0px"
            }), ${bottom ? "transparent" : "black"} 100%)`;
            maskStyle.maskImage = gradient;
            maskStyle.WebkitMaskImage = gradient;
        }

        return (
            <div
                ref={setRefs}
                data-fade-top={top}
                data-fade-bottom={bottom}
                className={`overflow-y-auto overscroll-contain ${className}`}
                style={{ ...maskStyle, ...style }}
                {...rest}
            >
                {children}
            </div>
        );
    },
);
