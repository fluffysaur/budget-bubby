import React, { useState, useRef, useEffect } from "react";
import { HelpCircle, X } from "lucide-react";

export interface TooltipPopoverProps {
    title?: string;
    children: React.ReactNode;
    triggerLabel?: React.ReactNode;
    label?: string;
    ariaLabel?: string;
    align?: "left" | "right" | "center";
    className?: string;
}

export function TooltipPopover({
    title,
    children,
    triggerLabel,
    label,
    ariaLabel,
    align = "right",
    className = "",
}: TooltipPopoverProps) {
    const effectiveAriaLabel = ariaLabel || label || "More information";
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleOutsideClick(event: MouseEvent) {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        if (isOpen) {
            document.addEventListener("mousedown", handleOutsideClick);
        }
        return () => {
            document.removeEventListener("mousedown", handleOutsideClick);
        };
    }, [isOpen]);

    const alignmentClass =
        align === "left"
            ? "left-0"
            : align === "center"
            ? "left-1/2 -translate-x-1/2"
            : "right-0";

    return (
        <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={effectiveAriaLabel}
                className="inline-flex items-center justify-center p-1 rounded-md text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
            >
                {triggerLabel ? triggerLabel : <HelpCircle className="h-3.5 w-3.5" />}
            </button>

            {isOpen && (
                <div
                    role="tooltip"
                    className={`absolute top-full mt-2 z-50 w-72 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-4 shadow-(--shadow-cute) animate-in fade-in zoom-in-95 duration-150 ${alignmentClass}`}
                >
                    <div className="flex items-start justify-between gap-2 mb-2 pb-1.5 border-b border-(--border-subtle)">
                        {title && (
                            <h4 className="text-xs font-black uppercase tracking-wider text-(--text-ink) font-display">
                                {title}
                            </h4>
                        )}
                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close tooltip"
                            className="p-0.5 rounded text-(--text-muted) hover:text-(--text-ink) cursor-pointer ml-auto"
                        >
                            <X className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <div className="text-xs font-medium text-(--text-muted) leading-relaxed">
                        {children}
                    </div>
                </div>
            )}
        </div>
    );
}

export default TooltipPopover;
