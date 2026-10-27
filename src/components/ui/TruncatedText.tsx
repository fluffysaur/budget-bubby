import React, { useState, useRef, useEffect, useCallback } from "react";

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
    const containerRef = useRef<HTMLSpanElement>(null);
    const textRef = useRef<HTMLSpanElement>(null);

    // Check if the text actually overflows its container
    const checkOverflow = useCallback(() => {
        if (textRef.current) {
            const hasOverflow = textRef.current.scrollWidth > textRef.current.clientWidth + 1;
            setIsOverflowing(hasOverflow);
        }
    }, []);

    useEffect(() => {
        checkOverflow();
        window.addEventListener("resize", checkOverflow);
        return () => window.removeEventListener("resize", checkOverflow);
    }, [checkOverflow, text]);

    // Handle outside clicks to close the popover on mobile
    useEffect(() => {
        if (!isOpen) return;

        const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener("mousedown", handleOutsideClick);
        document.addEventListener("touchstart", handleOutsideClick);
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
            document.removeEventListener("touchstart", handleOutsideClick);
        };
    }, [isOpen]);

    // Desktop hover handlers
    const handleMouseEnter = () => {
        checkOverflow();
        if (isOverflowing) {
            setIsOpen(true);
        }
    };

    const handleMouseLeave = () => {
        setIsOpen(false);
    };

    // Mobile / Touch click toggle handler
    const handleClick = (e: React.MouseEvent) => {
        checkOverflow();
        if (isOverflowing) {
            e.stopPropagation();
            setIsOpen((prev) => !prev);
        }
    };

    const alignClass =
        align === "center"
            ? "left-1/2 -translate-x-1/2"
            : align === "right"
            ? "right-0"
            : "left-0";

    const positionClass =
        position === "bottom"
            ? "top-full mt-1.5"
            : "bottom-full mb-1.5";

    const Component = as;

    return (
        <Component
            ref={containerRef as any}
            className={`relative inline-flex items-center min-w-0 max-w-full ${maxWidthClass}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
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
                <div
                    role="tooltip"
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute z-50 w-max max-w-[260px] sm:max-w-xs px-2.5 py-1.5 text-xs font-bold leading-snug rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-(--shadow-cute-sm) animate-in fade-in zoom-in-95 duration-150 break-words whitespace-normal pointer-events-auto select-text font-display ${alignClass} ${positionClass} ${tooltipClassName}`}
                >
                    {text}
                </div>
            )}
        </Component>
    );
}

export default TruncatedText;

