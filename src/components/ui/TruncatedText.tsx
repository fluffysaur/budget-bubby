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
import { Info } from "lucide-react";

export interface TruncatedTextProps extends React.HTMLAttributes<HTMLSpanElement> {
    text: string;
    as?: "span" | "div" | "p";
    className?: string;
    tooltipClassName?: string;
    maxWidthClass?: string;
    align?: "left" | "center" | "right";
    position?: "top" | "bottom";
    /** Shows a tappable (i) while the text is cut off. */
    infoButton?: boolean;
}

export function TruncatedText({
    text,
    as = "span",
    className = "",
    tooltipClassName = "",
    maxWidthClass = "",
    align = "left",
    position = "top",
    infoButton = false,
    ...props
}: TruncatedTextProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [isOverflowing, setIsOverflowing] = useState(false);
    const containerRef = useRef<HTMLElement | null>(null);
    const textRef = useRef<HTMLSpanElement>(null);
    // A mouse hovers before it clicks; that click must not close the popover.
    const openedByHover = useRef(false);

    // Compute placement from position and alignment
    const placementBase = position === "bottom" ? "bottom" : "top";
    const placementAlign =
        align === "center" ? "" : align === "right" ? "-end" : "-start";
    const placement = `${placementBase}${placementAlign}` as Placement;

    const {
        refs: { setReference, setFloating },
        floatingStyles,
        context,
        isPositioned,
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
            // With a button, measure against the container so the button's own
            // width can't keep it showing once the text would fit without it.
            const box =
                infoButton && containerRef.current
                    ? containerRef.current
                    : textRef.current;
            const hasOverflow =
                textRef.current.scrollWidth > box.clientWidth + 1;
            setIsOverflowing(hasOverflow);
            return hasOverflow;
        }
        return false;
    }, [infoButton]);

    useEffect(() => {
        checkOverflow();
        window.addEventListener("resize", checkOverflow);
        const observer =
            typeof ResizeObserver === "undefined"
                ? null
                : new ResizeObserver(() => checkOverflow());
        if (containerRef.current) observer?.observe(containerRef.current);
        return () => {
            window.removeEventListener("resize", checkOverflow);
            observer?.disconnect();
        };
    }, [checkOverflow, text]);

    // Desktop hover handlers. A tap also fires "enter", which would open the
    // popover just before the click toggled it shut, so touch is ignored.
    const handlePointerEnter = (e: React.PointerEvent) => {
        if (e.pointerType === "touch") return;
        const hasOverflow = checkOverflow();
        if (hasOverflow || isOverflowing) {
            openedByHover.current = true;
            setIsOpen(true);
        }
    };

    const handlePointerLeave = (e: React.PointerEvent) => {
        if (e.pointerType === "touch") return;
        openedByHover.current = false;
        setIsOpen(false);
    };

    // Mobile / Touch click toggle handler
    const handleClick = (e: React.MouseEvent) => {
        const hasOverflow = checkOverflow();
        if (hasOverflow || isOverflowing) {
            e.stopPropagation();
            const keepOpen = openedByHover.current;
            openedByHover.current = false;
            setIsOpen((prev) => keepOpen || !prev);
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
            onPointerEnter={handlePointerEnter}
            onPointerLeave={handlePointerLeave}
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

            {infoButton && isOverflowing && (
                <button
                    type="button"
                    onClick={handleClick}
                    aria-label={`Show full name: ${text}`}
                    className="relative ml-1 inline-flex shrink-0 cursor-pointer text-(--text-muted) after:absolute after:-inset-4 after:content-['']"
                >
                    <Info className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            )}

            {/* Floating Cute Tooltip Popover */}
            {isOpen && isOverflowing && (
                <FloatingPortal>
                    <div
                        ref={setFloating}
                        style={{
                            ...floatingStyles,
                            opacity: isPositioned ? 1 : 0,
                        }}
                        role="tooltip"
                        onClick={(e) => e.stopPropagation()}
                        {...getFloatingProps()}
                        className={`z-9999 w-max max-w-65 sm:max-w-xs px-2.5 py-1.5 text-xs font-bold leading-snug rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm wrap-break-word whitespace-normal pointer-events-auto select-text font-display transition-opacity duration-150 ${tooltipClassName}`}
                    >
                        {text}
                    </div>
                </FloatingPortal>
            )}
        </Component>
    );
}

export default TruncatedText;
