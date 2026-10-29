import React, { useState } from "react";
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    FloatingPortal,
    useDismiss,
    useRole,
    useHover,
    useClick,
    safePolygon,
    useInteractions,
    type Placement,
} from "@floating-ui/react";
import { HelpCircle, X } from "lucide-react";

export interface TooltipPopoverProps {
    title?: string;
    children: React.ReactNode;
    triggerLabel?: React.ReactNode;
    triggerClassName?: string;
    label?: string;
    ariaLabel?: string;
    align?: "left" | "right" | "center";
    className?: string;
    triggerOnHover?: boolean;
    triggerOnClick?: boolean;
    renderTrigger?: (
        props: Record<string, unknown>,
        isOpen: boolean,
    ) => React.ReactNode;
}

export function TooltipPopover({
    title,
    children,
    triggerLabel,
    triggerClassName = "",
    label,
    ariaLabel,
    align = "right",
    className = "",
    triggerOnHover = true,
    triggerOnClick = true,
    renderTrigger,
}: TooltipPopoverProps) {
    const effectiveAriaLabel = ariaLabel || label || "More information";
    const [isOpen, setIsOpen] = useState(false);

    const placement: Placement =
        align === "left"
            ? "bottom-start"
            : align === "center"
              ? "bottom"
              : "bottom-end";

    const {
        refs: { setReference, setFloating },
        floatingStyles,
        context,
        isPositioned,
    } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement,
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(8),
            flip({ fallbackAxisSideDirection: "start" }),
            shift({ padding: 8 }),
        ],
    });

    const click = useClick(context, {
        enabled: triggerOnClick,
    });
    const hover = useHover(context, {
        enabled: triggerOnHover,
        delay: { open: 150, close: 100 },
        handleClose: safePolygon(),
        mouseOnly: true,
    });
    const dismiss = useDismiss(context, {
        escapeKey: true,
        outsidePress: true,
        outsidePressEvent: "mousedown",
    });
    const role = useRole(context, { role: "tooltip" });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        hover,
        click,
        dismiss,
        role,
    ]);

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            {renderTrigger ? (
                <span ref={setReference} className="inline-flex">
                    {renderTrigger(
                        {
                            "aria-label": effectiveAriaLabel,
                            ...getReferenceProps(),
                        },
                        isOpen,
                    )}
                </span>
            ) : (
                <button
                    ref={setReference}
                    type="button"
                    aria-label={effectiveAriaLabel}
                    className={`inline-flex items-center justify-center p-1 rounded-md transition-colors cursor-pointer ${
                        isOpen
                            ? "bg-(--bg-cream) text-(--text-ink)"
                            : "text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream)"
                    } ${triggerClassName}`}
                    {...getReferenceProps()}
                >
                    {triggerLabel ? (
                        triggerLabel
                    ) : (
                        <HelpCircle className="h-3.5 w-3.5" />
                    )}
                </button>
            )}

            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={setFloating}
                        style={{
                            ...floatingStyles,
                            opacity: isPositioned ? 1 : 0,
                        }}
                        {...getFloatingProps()}
                        className="z-9999 w-72 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-(--shadow-cute) select-text transition-opacity duration-150"
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
                </FloatingPortal>
            )}
        </div>
    );
}

export default TooltipPopover;
