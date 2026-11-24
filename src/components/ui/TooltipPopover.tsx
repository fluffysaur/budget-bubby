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
import { m, AnimatePresence } from "motion/react";
import { pop } from "../../lib/motion";

export interface TooltipPopoverProps {
    title?: string;
    /** Content, or a render function given `close` to dismiss the popover. */
    children: React.ReactNode | ((close: () => void) => React.ReactNode);
    triggerLabel?: React.ReactNode;
    triggerClassName?: string;
    label?: string;
    ariaLabel?: string;
    align?: "left" | "right" | "center";
    className?: string;
    triggerOnHover?: boolean;
    triggerOnClick?: boolean;
    /** Override the default bottom placement (e.g. "right" for a side rail). */
    placement?: Placement;
    /** Label-only bubble: no header or close button, sized to content. */
    compact?: boolean;
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
    placement: placementOverride,
    compact = false,
}: TooltipPopoverProps) {
    const effectiveAriaLabel = ariaLabel || label || "More information";
    const [isOpen, setIsOpen] = useState(false);

    const defaultPlacement: Placement =
        align === "left"
            ? "bottom-start"
            : align === "center"
              ? "bottom"
              : "bottom-end";
    const placement = placementOverride ?? defaultPlacement;

    const {
        refs: { setReference, setFloating },
        floatingStyles,
        context,
        isPositioned,
    } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement,
        transform: false,
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
                    className={`relative inline-flex items-center justify-center p-1 rounded-md after:absolute after:-inset-3 after:content-[''] transition-colors cursor-pointer ${
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

            <FloatingPortal>
                <AnimatePresence>
                    {isOpen && (
                        <m.div
                            key="tooltip-popover"
                            ref={setFloating}
                            style={{
                                ...floatingStyles,
                                opacity: isPositioned ? 1 : 0,
                            }}
                            {...getFloatingProps()}
                            {...pop}
                            className={
                                compact
                                    ? "z-9999 w-max max-w-60 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm"
                                    : "z-9999 w-72 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-cute select-text"
                            }
                        >
                            {!compact && (
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
                                        className="relative p-0.5 rounded after:absolute after:-inset-3.5 after:content-[''] text-(--text-muted) hover:text-(--text-ink) cursor-pointer ml-auto"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                </div>
                            )}
                            <div
                                className={
                                    compact
                                        ? undefined
                                        : "text-xs font-medium text-(--text-muted) leading-relaxed"
                                }
                            >
                                {typeof children === "function"
                                    ? children(() => setIsOpen(false))
                                    : children}
                            </div>
                        </m.div>
                    )}
                </AnimatePresence>
            </FloatingPortal>
        </div>
    );
}

export default TooltipPopover;
