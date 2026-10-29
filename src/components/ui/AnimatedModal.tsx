import React, {
    useState,
    useEffect,
    useLayoutEffect,
    useCallback,
    useRef,
    useMemo,
    createContext,
    useContext,
} from "react";
import { createPortal } from "react-dom";
import { X, AlertCircle } from "lucide-react";
import { Button } from "./Button";

const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface AnimatedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDiscard?: () => void;
    isDirty?: boolean;
    children: React.ReactNode;
    maxWidth?: string;
    className?: string;
    isDrawerOnMobile?: boolean;
}

interface ModalDragContextValue {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
    onRequestClose?: (options?: { force?: boolean } | boolean) => void;
}

const ModalDragContext = createContext<ModalDragContextValue | null>(null);

const SM_MAX_WIDTH_MAP: Record<string, string> = {
    "max-w-sm": "sm:max-w-sm",
    "max-w-md": "sm:max-w-md",
    "max-w-lg": "sm:max-w-lg",
    "max-w-xl": "sm:max-w-xl",
    "max-w-2xl": "sm:max-w-2xl",
    "max-w-4xl": "sm:max-w-4xl",
};

/**
 * Checks if target is inside an element exempt from drawer dragging (e.g., scrollable textarea, range slider, horizontal carousel).
 */
function isExemptFromDrawerDrag(
    target: HTMLElement | null,
    boundary: HTMLElement | null,
): boolean {
    let current = target;
    while (current && current !== boundary) {
        if (current.getAttribute("data-drag-ignore") === "true") return true;

        if (current instanceof HTMLInputElement && current.type === "range") {
            return true;
        }
        if (current.getAttribute("role") === "slider") return true;

        if (current instanceof HTMLTextAreaElement) {
            if (current.scrollHeight > current.clientHeight) return true;
        }

        if (typeof window !== "undefined" && window.getComputedStyle) {
            const style = window.getComputedStyle(current);
            if (
                (style.overflowX === "auto" || style.overflowX === "scroll") &&
                current.scrollWidth > current.clientWidth
            ) {
                return true;
            }
        }

        current = current.parentElement;
    }
    return false;
}

/**
 * Finds the closest scrollable container between target and modal boundary.
 */
function findScrollableAncestor(
    target: HTMLElement | null,
    boundary: HTMLElement | null,
): HTMLElement | null {
    let current = target;
    while (current && current !== boundary) {
        if (
            current.classList.contains("overflow-y-auto") ||
            current.classList.contains("overflow-y-scroll")
        ) {
            return current;
        }
        if (typeof window !== "undefined" && window.getComputedStyle) {
            const style = window.getComputedStyle(current);
            if (
                (style.overflowY === "auto" || style.overflowY === "scroll") &&
                current.scrollHeight > current.clientHeight
            ) {
                return current;
            }
        }
        current = current.parentElement;
    }
    return null;
}

/**
 * Checks if an input element has been modified by the user.
 */
function isInputElementDirty(
    el: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
): boolean {
    if (el instanceof HTMLInputElement) {
        if (
            el.type === "button" ||
            el.type === "submit" ||
            el.type === "reset" ||
            el.type === "hidden"
        ) {
            return false;
        }
    }

    // If explicitly marked as modified by user event
    if (el.dataset.userModified === "true") {
        return true;
    }

    return false;
}

/**
 * Auto-detects whether any form or input inside container has modified values.
 */
export function checkContainerDirty(container: HTMLElement | null): boolean {
    if (!container) return false;
    const elements = container.querySelectorAll<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >("input, textarea, select");

    for (let i = 0; i < elements.length; i++) {
        const el = elements[i];
        if (el.closest('[data-discard-dialog="true"]')) continue;
        if (isInputElementDirty(el)) {
            return true;
        }
    }
    return false;
}

export function AnimatedModal({
    isOpen,
    onClose,
    onDiscard,
    isDirty: isDirtyProp,
    children,
    maxWidth = "max-w-md",
    className = "",
    isDrawerOnMobile = true,
}: AnimatedModalProps) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);
    const [isSlidingOut, setIsSlidingOut] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const drawerRef = useRef<HTMLDivElement>(null);

    // Touch gesture state for mobile slide-down-to-close
    const [dragTranslateY, setDragTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartYRef = useRef<number | null>(null);
    const touchStartXRef = useRef<number | null>(null);
    const touchCurrentYRef = useRef<number | null>(null);
    const dragStartTouchYRef = useRef<number | null>(null);
    const touchStartTimeRef = useRef<number>(0);
    const initialScrollTopRef = useRef<number>(0);
    const isDraggingDrawerRef = useRef<boolean>(false);
    const isTouchExemptRef = useRef<boolean>(false);
    const scrollParentRef = useRef<HTMLElement | null>(null);

    // Listen to user input/change events to track modifications accurately
    useEffect(() => {
        const drawerEl = drawerRef.current;
        if (!drawerEl || !shouldRender) return;

        const handleUserModification = (e: Event) => {
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target instanceof HTMLInputElement ||
                    target instanceof HTMLTextAreaElement ||
                    target instanceof HTMLSelectElement)
            ) {
                if (!target.closest('[data-discard-dialog="true"]')) {
                    target.dataset.userModified = "true";
                }
            }
        };

        drawerEl.addEventListener("input", handleUserModification, {
            capture: true,
        });
        drawerEl.addEventListener("change", handleUserModification, {
            capture: true,
        });

        return () => {
            drawerEl.removeEventListener("input", handleUserModification, {
                capture: true,
            });
            drawerEl.removeEventListener("change", handleUserModification, {
                capture: true,
            });
        };
    }, [shouldRender]);

    useEffect(() => {
        if (isOpen) {
            if (closingTimerRef.current) {
                clearTimeout(closingTimerRef.current);
                closingTimerRef.current = null;
            }
            setShouldRender(true);
            setIsClosing(false);
            setIsSlidingOut(false);
            setDragTranslateY(0);
            setIsDragging(false);
            setShowDiscardConfirm(false);
        } else if (shouldRender && !isClosing) {
            if (
                typeof globalThis !== "undefined" &&
                (globalThis as { process?: { env?: { NODE_ENV?: string } } })
                    .process?.env?.NODE_ENV === "test"
            ) {
                setShouldRender(false);
                setIsClosing(false);
                setIsSlidingOut(false);
                setDragTranslateY(0);
                setIsDragging(false);
                setShowDiscardConfirm(false);
                return;
            }
            setIsClosing(true);
            closingTimerRef.current = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
                setIsSlidingOut(false);
                setDragTranslateY(0);
                setIsDragging(false);
                setShowDiscardConfirm(false);
                closingTimerRef.current = null;
            }, 190);
        }
    }, [isOpen, shouldRender, isClosing]);

    // Check dirty state
    const isDirtyCheck = useCallback(() => {
        if (typeof isDirtyProp === "boolean") {
            return isDirtyProp;
        }
        return checkContainerDirty(drawerRef.current);
    }, [isDirtyProp]);

    const handleRequestClose = useCallback(
        (options?: { force?: boolean } | boolean) => {
            const force =
                typeof options === "boolean"
                    ? options
                    : options?.force === true;

            if (isClosing) return;
            if (!force && isDirtyCheck()) {
                setDragTranslateY(0);
                setIsDragging(false);
                setShowDiscardConfirm(true);
                return;
            }
            onClose();
        },
        [isClosing, isDirtyCheck, onClose],
    );

    const handleConfirmDiscard = useCallback(() => {
        setShowDiscardConfirm(false);
        if (drawerRef.current) {
            const forms = drawerRef.current.querySelectorAll("form");
            forms.forEach((f) => f.reset());
            const inputs = drawerRef.current.querySelectorAll<
                HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
            >("input, textarea, select");
            inputs.forEach((input) => {
                delete input.dataset.userModified;
            });
        }
        onDiscard?.();
        handleRequestClose(true);
    }, [handleRequestClose, onDiscard]);

    // Touch gesture handlers
    const handleTouchStart = useCallback(
        (e: React.TouchEvent | TouchEvent) => {
            if (!isDrawerOnMobile || isClosing) return;
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            const target = e.target as HTMLElement | null;

            if (target?.closest('[data-discard-dialog="true"]')) return;

            if (isExemptFromDrawerDrag(target, drawerRef.current)) {
                isTouchExemptRef.current = true;
                return;
            }
            isTouchExemptRef.current = false;

            const scrollParent = findScrollableAncestor(
                target,
                drawerRef.current,
            );
            scrollParentRef.current = scrollParent;
            touchStartXRef.current = touch.clientX;
            touchStartYRef.current = touch.clientY;
            touchCurrentYRef.current = touch.clientY;
            touchStartTimeRef.current = Date.now();
            initialScrollTopRef.current = scrollParent
                ? scrollParent.scrollTop
                : 0;
            isDraggingDrawerRef.current = false;
        },
        [isDrawerOnMobile, isClosing],
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent | TouchEvent) => {
            if (
                isTouchExemptRef.current ||
                touchStartYRef.current === null ||
                isClosing
            ) {
                return;
            }
            if (e.touches.length !== 1) return;

            const touch = e.touches[0];
            touchCurrentYRef.current = touch.clientY;
            const deltaY = touch.clientY - touchStartYRef.current;
            const deltaX =
                touch.clientX - (touchStartXRef.current ?? touch.clientX);
            const currentScrollTop = scrollParentRef.current
                ? scrollParentRef.current.scrollTop
                : 0;

            if (!isDraggingDrawerRef.current) {
                // If at top and dragging downward, engage drawer drag
                if (
                    currentScrollTop <= 0 &&
                    deltaY > 6 &&
                    Math.abs(deltaY) > Math.abs(deltaX)
                ) {
                    isDraggingDrawerRef.current = true;
                    setIsDragging(true);
                    dragStartTouchYRef.current =
                        initialScrollTopRef.current > 0
                            ? touch.clientY
                            : touchStartYRef.current;

                    // Dismiss mobile virtual keyboard
                    if (document.activeElement instanceof HTMLElement) {
                        document.activeElement.blur();
                    }

                    if (e.cancelable) {
                        e.preventDefault();
                    }
                }
            }

            if (isDraggingDrawerRef.current) {
                const dragBaseY =
                    dragStartTouchYRef.current ?? touchStartYRef.current ?? touch.clientY;
                const dragDelta = touch.clientY - dragBaseY;
                if (dragDelta > 0) {
                    setDragTranslateY(dragDelta);
                    if (e.cancelable) {
                        e.preventDefault();
                    }
                } else {
                    setDragTranslateY(0);
                }
            }
        },
        [isClosing],
    );

    const handleTouchEnd = useCallback(() => {
        if (isTouchExemptRef.current) {
            isTouchExemptRef.current = false;
            return;
        }

        if (!isDraggingDrawerRef.current) {
            touchStartYRef.current = null;
            touchStartXRef.current = null;
            touchCurrentYRef.current = null;
            dragStartTouchYRef.current = null;
            scrollParentRef.current = null;
            return;
        }

        const deltaY = dragTranslateY;
        const elapsed = Math.max(Date.now() - touchStartTimeRef.current, 1);
        const velocity = deltaY / elapsed; // px per ms

        isDraggingDrawerRef.current = false;
        touchStartYRef.current = null;
        touchStartXRef.current = null;
        touchCurrentYRef.current = null;
        dragStartTouchYRef.current = null;
        scrollParentRef.current = null;
        setIsDragging(false);

        // Threshold: dragged down > 80px or flicked down rapidly (> 40px with high velocity)
        if (deltaY > 80 || (deltaY > 40 && velocity > 0.5)) {
            if (isDirtyCheck()) {
                setDragTranslateY(0);
                setShowDiscardConfirm(true);
            } else {
                setIsSlidingOut(true);
                handleRequestClose(true);
            }
        } else {
            // Snap back up smoothly
            setDragTranslateY(0);
        }
    }, [dragTranslateY, handleRequestClose, isDirtyCheck]);

    // Attach native non-passive touchmove listener to avoid passive listener limitations on mobile
    useEffect(() => {
        const drawerEl = drawerRef.current;
        if (!drawerEl || !isDrawerOnMobile || !shouldRender) return;

        const onTouchStart = (e: TouchEvent) => handleTouchStart(e);
        const onTouchMove = (e: TouchEvent) => handleTouchMove(e);
        const onTouchEnd = () => handleTouchEnd();

        drawerEl.addEventListener("touchstart", onTouchStart, {
            passive: true,
        });
        drawerEl.addEventListener("touchmove", onTouchMove, {
            passive: false,
        });
        drawerEl.addEventListener("touchend", onTouchEnd, {
            passive: true,
        });
        drawerEl.addEventListener("touchcancel", onTouchEnd, {
            passive: true,
        });

        return () => {
            drawerEl.removeEventListener("touchstart", onTouchStart);
            drawerEl.removeEventListener("touchmove", onTouchMove);
            drawerEl.removeEventListener("touchend", onTouchEnd);
            drawerEl.removeEventListener("touchcancel", onTouchEnd);
        };
    }, [
        isDrawerOnMobile,
        shouldRender,
        handleTouchStart,
        handleTouchMove,
        handleTouchEnd,
    ]);

    const dragHandlers = useMemo<ModalDragContextValue>(
        () => ({
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
            onRequestClose: handleRequestClose,
        }),
        [handleTouchStart, handleTouchMove, handleTouchEnd, handleRequestClose],
    );

    // Handle ESC key
    useEffect(() => {
        if (!shouldRender || isClosing) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                    return;
                }
                handleRequestClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shouldRender, isClosing, showDiscardConfirm, handleRequestClose]);

    // Prevent background scrolling
    useIsomorphicLayoutEffect(() => {
        if (shouldRender && !isClosing) {
            const originalOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            return () => {
                document.body.style.overflow = originalOverflow;
            };
        }
    }, [shouldRender, isClosing]);

    if (!shouldRender) return null;

    const backdropOpacityFactor =
        isDrawerOnMobile && dragTranslateY > 0
            ? Math.max(0, 1 - dragTranslateY / 320)
            : 1;

    const modalNode = (
        <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleRequestClose();
                }
            }}
            style={{
                backgroundColor: `rgba(0, 0, 0, ${0.6 * backdropOpacityFactor})`,
            }}
            className={`fixed inset-0 z-50 flex overflow-hidden overscroll-y-contain ${
                isDrawerOnMobile ? "items-end sm:items-center" : "items-center"
            } justify-center p-0 sm:p-4 transition-opacity duration-200 ${
                isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
        >
            <div
                ref={drawerRef}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={
                    isDrawerOnMobile && (dragTranslateY > 0 || isSlidingOut)
                        ? {
                              transform: isSlidingOut
                                  ? "translate3d(0, 100%, 0)"
                                  : `translate3d(0, ${dragTranslateY}px, 0)`,
                              transition: isDragging
                                  ? "none"
                                  : "transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
                          }
                        : undefined
                }
                className={`w-full max-w-full ${SM_MAX_WIDTH_MAP[maxWidth] || `sm:${maxWidth}`} ${
                    isDrawerOnMobile
                        ? `max-h-[92dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-2xl ${
                              isClosing
                                  ? "modal-sheet-exit"
                                  : "modal-sheet-enter"
                          }`
                        : `max-h-[90dvh] rounded-2xl ${isClosing ? "animate-modal-out" : "animate-modal-in"}`
                } bg-(--bg-card) border-t-2 sm:border-2 border-(--border-ink) shadow-(--shadow-cute-lg) flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)] ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {isDrawerOnMobile && (
                    <div
                        className="sm:hidden flex justify-center pt-2.5 pb-2 shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
                        aria-label="Drag down to close"
                    >
                        <div className="h-1.5 w-12 rounded-full bg-(--border-ink) opacity-30" />
                    </div>
                )}
                <ModalDragContext.Provider
                    value={isDrawerOnMobile ? dragHandlers : null}
                >
                    {children}
                </ModalDragContext.Provider>
            </div>

            {/* Discard Unsaved Changes Confirmation Dialog */}
            {showDiscardConfirm && (
                <div
                    data-discard-dialog="true"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="discard-dialog-title"
                    aria-describedby="discard-dialog-desc"
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-modal-in"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-(--bg-card) border-2 border-(--border-ink) shadow-(--shadow-cute-lg) p-5 flex flex-col gap-4 text-(--text-ink)">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--border-ink) bg-[#fef2f2] text-[#f76b57]">
                                <AlertCircle className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <h3
                                    id="discard-dialog-title"
                                    className="font-display font-black text-base text-(--text-ink) leading-tight"
                                >
                                    Discard unsaved changes?
                                </h3>
                                <p
                                    id="discard-dialog-desc"
                                    className="text-xs text-(--text-muted) mt-0.5"
                                >
                                    You have unsaved changes that will be lost.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-(--border-subtle)">
                            <Button
                                variant="secondary"
                                size="sm"
                                onClick={() => setShowDiscardConfirm(false)}
                            >
                                Keep editing
                            </Button>
                            <Button
                                variant="danger"
                                size="sm"
                                onClick={handleConfirmDiscard}
                            >
                                Discard changes
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    return typeof document !== "undefined"
        ? createPortal(modalNode, document.body)
        : modalNode;
}

export interface ModalHeaderProps {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    icon?: React.ReactNode;
    iconBgColor?: string;
    onClose: () => void;
    closeAriaLabel?: string;
    id?: string;
    actions?: React.ReactNode;
    className?: string;
}

export function ModalHeader({
    title,
    subtitle,
    icon,
    iconBgColor = "bg-(--pastel-lilac-light)",
    onClose,
    closeAriaLabel = "Close modal",
    id,
    actions,
    className = "",
}: ModalHeaderProps) {
    const dragContext = useContext(ModalDragContext);
    const handleClose = () => {
        if (dragContext?.onRequestClose) {
            dragContext.onRequestClose();
        } else {
            onClose();
        }
    };

    return (
        <div
            onTouchStart={dragContext?.onTouchStart}
            onTouchMove={dragContext?.onTouchMove}
            onTouchEnd={dragContext?.onTouchEnd}
            className={`p-4 sm:p-5 pb-3 border-b border-(--border-subtle) flex items-center justify-between shrink-0 touch-none select-none sm:touch-auto sm:select-auto ${className}`}
        >
            <div className="flex items-center gap-2.5 min-w-0 flex-1 pointer-events-none">
                {icon && (
                    <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-(--text-ink) border border-(--border-ink) ${iconBgColor}`}
                    >
                        {icon}
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <h2
                        id={id}
                        className="font-display font-bold text-base text-(--text-ink) leading-tight truncate"
                    >
                        {title}
                    </h2>
                    {subtitle && (
                        <p className="text-xs text-(--text-muted) leading-normal truncate mt-0.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </div>
            <div
                className="flex items-center gap-2 shrink-0 ml-2"
                onTouchStart={(e) => e.stopPropagation()}
            >
                {actions}
                <button
                    type="button"
                    onClick={handleClose}
                    aria-label={closeAriaLabel}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-ink) text-(--text-ink) hover:bg-(--pastel-coral-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                >
                    <X className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}

export interface ModalBodyProps {
    children: React.ReactNode;
    className?: string;
}

export function ModalBody({ children, className = "" }: ModalBodyProps) {
    return (
        <div
            className={`flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 ${className}`}
        >
            {children}
        </div>
    );
}

export interface ModalFooterProps {
    children: React.ReactNode;
    className?: string;
}

export function ModalFooter({ children, className = "" }: ModalFooterProps) {
    return (
        <div
            className={`flex items-center justify-end gap-2.5 p-4 sm:p-5 pt-3 border-t border-(--border-subtle) shrink-0 bg-(--bg-card) pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] ${className}`}
        >
            {children}
        </div>
    );
}

export default AnimatedModal;
