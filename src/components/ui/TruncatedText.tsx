import React, { useState, useRef, useEffect, useCallback } from "react";
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    FloatingPortal,
    useDismiss,
    useRole,
    useInteractions,
    type Placement,
} from "@floating-ui/react";

export interface TruncatedTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    text: string;
    as?: "span" | "div" | "p";
    className?: string;
    tooltipClassName?: string;
    maxWidthClass?: string;
    align?: "left" | "center" | "right";
    position?: "top" | "bottom";
}

export function TruncatedText({
    text,
    as = "span",
    className = "",
    tooltipClassName = "",
    maxWidthClass = "",
    align = "left",
    position = "top",
    ...props
}: TruncatedTextProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const containerRef = useRef<HTMLElement | null>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    // Compute placement from position and alignment
    const placementBase = position === "bottom" ? "bottom" : "top";
    const placementAlign =
        align === "center" ? "" : align === "right" ? "-end" : "-start";
    const placement = `${placementBase}${placementAlign}` as Placement;

    const {
        refs: { setReference, setFloating },
        floatingStyles,
        context,
    } = useFloating({
        open: isOpen && isOverflowing,
        onOpenChange: (open) => {
            if (!open) {
                setIsOpen(false);
            }
        },
        placement,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(6),
            flip({ fallbackAxisSideDirection: "start" }),
            shift({ padding: 8 }),
        ],
    });

    const dismiss = useDismiss(context, {
        escapeKey: true,
        outsidePress: true,
        outsidePressEvent: "mousedown",
    });
    const role = useRole(context, { role: "tooltip" });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        dismiss,
        role,
    ]);

    // Check if the text actually overflows its container
    const checkOverflow = useCallback(() => {
        if (textRef.current) {
            const hasOverflow =
                textRef.current.scrollWidth > textRef.current.clientWidth + 1;
            setIsOverflowing(hasOverflow);
            return hasOverflow;
        }
        return false;
    }, []);

    useEffect(() => {
        checkOverflow();
        window.addEventListener("resize", checkOverflow);
        return () => window.removeEventListener("resize", checkOverflow);
    }, [checkOverflow, text]);

    // Desktop hover handlers
    const handleMouseEnter = () => {
        const hasOverflow = checkOverflow();
        if (hasOverflow || isOverflowing) {
            setIsOpen(true);
        }
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };

    // Mobile / Touch click toggle handler
    const handleClick = (e: React.MouseEvent) => {
        const hasOverflow = checkOverflow();
        if (hasOverflow || isOverflowing) {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
        }
    };

    const Component = as;

    return (
        <Component
            ref={(node: HTMLElement | null) => {
                containerRef.current = node;
                setReference(node);
            }}
            className={`relative inline-flex items-center min-w-0 max-w-full ${maxWidthClass}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            {...getReferenceProps()}
        >
            <span
                ref={textRef}
                onClick={handleClick}
                title={isOverflowing ? text : undefined}
                className={`truncate block max-w-full ${
                    isOverflowing ? "cursor-pointer sm:cursor-help" : ""
                } ${className}`}
                {...props}
            >
                {text}
            </span>

            {/* Floating Cute Tooltip Popover */}
            {isOpen && isOverflowing && (
                <FloatingPortal>
                    <div
                        ref={setFloating}
                        style={floatingStyles}
                        role="tooltip"
                        onClick={(e) => e.stopPropagation()}
                        {...getFloatingProps()}
                        className={`z-9999 w-max max-w-65 sm:max-w-xs px-2.5 py-1.5 text-xs font-bold leading-snug rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-(--shadow-cute-sm) animate-in fade-in zoom-in-95 duration-150 wrap-break-word whitespace-normal pointer-events-auto select-text font-display ${tooltipClassName}`}
                    >
                        {text}
                    </div>
                </FloatingPortal>
            )}
        </Component>
    );
}

export default TruncatedText;
