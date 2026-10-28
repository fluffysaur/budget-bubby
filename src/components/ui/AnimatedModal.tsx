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
import { X } from "lucide-react";

const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

export interface AnimatedModalProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
    maxWidth?: string;
    className?: string;
    isDrawerOnMobile?: boolean;
}

interface ModalDragContextValue {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
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

export function AnimatedModal({
    isOpen,
    onClose,
    children,
    maxWidth = "max-w-md",
    className = "",
    isDrawerOnMobile = true,
}: AnimatedModalProps) {
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);
    const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Touch gesture state for mobile slide-down-to-close
    const [dragTranslateY, setDragTranslateY] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const touchStartYRef = useRef<number | null>(null);
    const touchCurrentYRef = useRef<number | null>(null);
    const touchStartTimeRef = useRef<number>(0);

    useEffect(() => {
        if (isOpen) {
            if (closingTimerRef.current) {
                clearTimeout(closingTimerRef.current);
                closingTimerRef.current = null;
            }
            setShouldRender(true);
            setIsClosing(false);
            setDragTranslateY(0);
            setIsDragging(false);
        } else if (shouldRender && !isClosing) {
            if (
                typeof globalThis !== "undefined" &&
                (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test"
            ) {
                setShouldRender(false);
                setIsClosing(false);
                setDragTranslateY(0);
                setIsDragging(false);
                return;
            }
            setIsClosing(true);
            closingTimerRef.current = setTimeout(() => {
                setShouldRender(false);
                setIsClosing(false);
                setDragTranslateY(0);
                setIsDragging(false);
                closingTimerRef.current = null;
            }, 190);
        }
    }, [isOpen, shouldRender, isClosing]);

    const handleRequestClose = useCallback(() => {
        if (isClosing) return;
        onClose();
    }, [isClosing, onClose]);

    // Handle touch gestures on drag handle and header
    const handleTouchStart = useCallback(
        (e: React.TouchEvent) => {
            if (!isDrawerOnMobile || isClosing) return;
            const touch = e.touches[0];
            touchStartYRef.current = touch.clientY;
            touchCurrentYRef.current = touch.clientY;
            touchStartTimeRef.current = Date.now();
            setIsDragging(true);
        },
        [isDrawerOnMobile, isClosing],
    );

    const handleTouchMove = useCallback(
        (e: React.TouchEvent) => {
            if (touchStartYRef.current === null || isClosing) return;
            const touch = e.touches[0];
            touchCurrentYRef.current = touch.clientY;
            const deltaY = touch.clientY - touchStartYRef.current;

            if (deltaY > 0) {
                // Dragging down - apply smooth 1:1 translation
                setDragTranslateY(deltaY);
            } else {
                // Resisting drag up past top
                setDragTranslateY(0);
            }
        },
        [isClosing],
    );

    const handleTouchEnd = useCallback(() => {
        if (touchStartYRef.current === null) return;
        const currentY = touchCurrentYRef.current ?? touchStartYRef.current;
        const deltaY = currentY - touchStartYRef.current;
        const elapsed = Math.max(Date.now() - touchStartTimeRef.current, 1);
        const velocity = deltaY / elapsed; // px per ms

        touchStartYRef.current = null;
        touchCurrentYRef.current = null;
        setIsDragging(false);

        // Threshold: dragged down > 80px or flicked down rapidly (> 40px with high velocity)
        if (deltaY > 80 || (deltaY > 40 && velocity > 0.5)) {
            handleRequestClose();
        } else {
            // Snap back up smoothly
            setDragTranslateY(0);
        }
    }, [handleRequestClose]);

    const dragHandlers = useMemo<ModalDragContextValue>(
        () => ({
            onTouchStart: handleTouchStart,
            onTouchMove: handleTouchMove,
            onTouchEnd: handleTouchEnd,
        }),
        [handleTouchStart, handleTouchMove, handleTouchEnd],
    );

    // Handle ESC key
    useEffect(() => {
        if (!shouldRender || isClosing) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                handleRequestClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [shouldRender, isClosing, handleRequestClose]);

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

    const modalNode = (
        <div
            role="dialog"
            aria-modal="true"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    handleRequestClose();
                }
            }}
            className={`fixed inset-0 z-50 flex overflow-hidden overscroll-y-contain ${
                isDrawerOnMobile ? "items-end sm:items-center" : "items-center"
            } justify-center p-0 sm:p-4 bg-black/60 transition-opacity duration-200 ${
                isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}
        >
            <div
                style={
                    isDrawerOnMobile && dragTranslateY > 0
                        ? {
                              transform: `translate3d(0, ${dragTranslateY}px, 0)`,
                              transition: isDragging
                                  ? "none"
                                  : "transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
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
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
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
                    onClick={onClose}
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
