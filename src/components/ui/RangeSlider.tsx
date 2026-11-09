import React, { useRef } from "react";

const DEAD_ZONE_PX = 8;

type Gesture = "idle" | "pending" | "horizontal" | "vertical";

export interface RangeSliderProps extends Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "onChange" | "value"
> {
    value: number;
    onValueChange: (value: string) => void;
}

/**
 * Native range input that does not hijack vertical scrolling on touch.
 * A touch is held "pending" for an 8px dead zone: a tap commits the track
 * jump, a horizontal drag commits and keeps tracking, a vertical swipe (or a
 * browser pointercancel while it scrolls) discards the jump. Mouse and
 * keyboard changes pass straight through.
 */
export function RangeSlider({
    value,
    onValueChange,
    className = "",
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    ...props
}: RangeSliderProps) {
    const gesture = useRef<Gesture>("idle");
    const start = useRef({ x: 0, y: 0 });
    const pendingValue = useRef<string | null>(null);

    const finish = (commit: boolean) => {
        if (commit && pendingValue.current !== null) {
            onValueChange(pendingValue.current);
        }
        pendingValue.current = null;
        gesture.current = "idle";
    };

    return (
        <input
            {...props}
            type="range"
            value={value}
            className={`touch-pan-y ${className}`}
            onChange={(e) => {
                if (gesture.current === "pending") {
                    pendingValue.current = e.target.value;
                    return;
                }
                if (gesture.current === "vertical") return;
                onValueChange(e.target.value);
            }}
            onPointerDown={(e) => {
                onPointerDown?.(e);
                if (e.pointerType === "mouse") return;
                gesture.current = "pending";
                pendingValue.current = null;
                start.current = { x: e.clientX, y: e.clientY };
            }}
            onPointerMove={(e) => {
                onPointerMove?.(e);
                if (gesture.current !== "pending") return;
                const dx = Math.abs(e.clientX - start.current.x);
                const dy = Math.abs(e.clientY - start.current.y);
                if (Math.max(dx, dy) < DEAD_ZONE_PX) return;
                if (dx > dy) {
                    gesture.current = "horizontal";
                    finish(true);
                    gesture.current = "horizontal";
                } else {
                    finish(false);
                    gesture.current = "vertical";
                }
            }}
            onPointerUp={(e) => {
                onPointerUp?.(e);
                finish(gesture.current === "pending");
            }}
            onPointerCancel={(e) => {
                onPointerCancel?.(e);
                finish(false);
            }}
        />
    );
}
