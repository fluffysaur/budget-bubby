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
import { ScrollArea } from "./ScrollArea";
import {
    checkContainerDirty,
    findScrollableAncestor,
    getFocusableElements,
} from "../../lib/domUtils";
import { prefersReducedMotion } from "../../lib/motion";
import { usePrivacy } from "../../context/PrivacyContext";
import { maskMoneyNode } from "../../lib/maskMoney";

/** Matches --duration-base used by the mobile drawer slide-up. */
const DRAWER_ENTER_MS = 240;

const useIsomorphicLayoutEffect =
    typeof window !== "undefined" ? useLayoutEffect : useEffect;

interface OpenModalEntry {
    id: symbol;
    getContainer: () => HTMLElement | null;
}

// Module-level stack of open modal entries so Escape/Tab only target the top-most modal
// and body/main overflow is saved once when the first modal opens and restored when the last closes.
const openModalStack: OpenModalEntry[] = [];
let savedBodyOverflow: string | null = null;
let savedMainOverflow: string | null = null;

export type AnimatedModalVariant =
    "modal" | "side-sheet" | "popover" | "fullscreen" | "spotlight";

export interface AnimatedModalProps {
    isOpen: boolean;
    onClose: () => void;
    onDiscard?: () => void;
    isDirty?: boolean;
    children: React.ReactNode;
    maxWidth?: string;
    className?: string;
    isDrawerOnMobile?: boolean;
    variant?: AnimatedModalVariant;
    initialFocusRef?: React.RefObject<HTMLElement | null>;
    anchorRef?: React.RefObject<HTMLElement | null>;
    ariaLabel?: string;
    ariaLabelledBy?: string;
    closeOnBackdropClick?: boolean;
    closeOnEscape?: boolean;
    backdropClassName?: string;
    backdropStyle?: React.CSSProperties;
    "data-testid"?: string;
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

export function AnimatedModal({
    isOpen,
    onClose,
    onDiscard,
    isDirty: isDirtyProp,
    children,
    maxWidth = "max-w-md",
    className = "",
    isDrawerOnMobile: isDrawerOnMobileProp = true,
    variant = "modal",
    initialFocusRef,
    anchorRef,
    ariaLabel,
    ariaLabelledBy,
    closeOnBackdropClick = true,
    closeOnEscape = true,
    backdropClassName = "",
    backdropStyle,
    "data-testid": dataTestId,
}: AnimatedModalProps) {
    const isDrawerOnMobile = variant === "modal" && isDrawerOnMobileProp;
    const [shouldRender, setShouldRender] = useState(isOpen);
    const [isClosing, setIsClosing] = useState(false);
    const [isSlidingOut, setIsSlidingOut] = useState(false);
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const drawerRef = useRef<HTMLDivElement>(null);
    const discardDialogRef = useRef<HTMLDivElement>(null);
    const modalIdRef = useRef<symbol>(Symbol("AnimatedModal"));
    const previousFocusRef = useRef<HTMLElement | null>(null);
    const lastFocusBeforeDiscardRef = useRef<HTMLElement | null>(null);
    const [mountTriggerEl] = useState<HTMLElement | null>(() => {
        if (!isOpen || typeof document === "undefined") return null;
        return document.activeElement instanceof HTMLElement
            ? document.activeElement
            : null;
    });
    const usedMountTriggerRef = useRef(false);
    const [popoverPos, setPopoverPos] = useState<{
        top: number;
        right: number;
    }>({
        top: 56,
        right: 16,
    });

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

    // Touch device keyboard handling: scroll focused input into view on visualViewport resize
    useEffect(() => {
        if (!shouldRender || !isDrawerOnMobile) return;
        const drawerEl = drawerRef.current;
        if (
            !drawerEl ||
            typeof window === "undefined" ||
            !window.visualViewport
        )
            return;

        let focusedInput: HTMLElement | null = null;

        const handleFocusIn = (e: FocusEvent) => {
            const target = e.target as HTMLElement | null;
            if (
                target &&
                (target instanceof HTMLInputElement ||
                    target instanceof HTMLTextAreaElement ||
                    target instanceof HTMLSelectElement)
            ) {
                focusedInput = target;
            }
        };

        const handleFocusOut = () => {
            focusedInput = null;
        };

        const handleViewportResize = () => {
            if (focusedInput && document.activeElement === focusedInput) {
                focusedInput.scrollIntoView({
                    block: "center",
                    behavior: "smooth",
                });
            }
        };

        drawerEl.addEventListener("focusin", handleFocusIn);
        drawerEl.addEventListener("focusout", handleFocusOut);
        window.visualViewport.addEventListener("resize", handleViewportResize);

        return () => {
            drawerEl.removeEventListener("focusin", handleFocusIn);
            drawerEl.removeEventListener("focusout", handleFocusOut);
            window.visualViewport?.removeEventListener(
                "resize",
                handleViewportResize,
            );
        };
    }, [shouldRender, isDrawerOnMobile]);

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
                    dragStartTouchYRef.current ??
                    touchStartYRef.current ??
                    touch.clientY;
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

    const isActive = shouldRender && !isClosing;

    // Capture trigger element before modal mounts or activates
    useIsomorphicLayoutEffect(() => {
        if (!isOpen) return;
        if (!usedMountTriggerRef.current && mountTriggerEl) {
            usedMountTriggerRef.current = true;
            if (!previousFocusRef.current) {
                previousFocusRef.current = mountTriggerEl;
            }
            return;
        }
        usedMountTriggerRef.current = true;
        if (!previousFocusRef.current && typeof document !== "undefined") {
            const active = document.activeElement;
            if (
                active instanceof HTMLElement &&
                !drawerRef.current?.contains(active)
            ) {
                previousFocusRef.current = active;
            }
        }
    }, [isOpen, mountTriggerEl]);

    // Position desktop popover relative to anchor button
    useIsomorphicLayoutEffect(() => {
        if (!isActive || variant !== "popover") return;
        const updatePosition = () => {
            const anchor = anchorRef?.current;
            if (!anchor || typeof window === "undefined") return;
            const rect = anchor.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) return;
            const top = Math.min(rect.bottom + 8, window.innerHeight - 24);
            const right = Math.max(12, window.innerWidth - rect.right);
            setPopoverPos({ top, right });
        };
        updatePosition();
        window.addEventListener("resize", updatePosition);
        return () => window.removeEventListener("resize", updatePosition);
    }, [isActive, variant, anchorRef]);

    // Register in open modal stack and manage scroll lock synchronously
    useIsomorphicLayoutEffect(() => {
        if (!isActive) return;

        const id = modalIdRef.current;
        if (openModalStack.length === 0 && typeof document !== "undefined") {
            savedBodyOverflow = document.body.style.overflow;
            document.body.style.overflow = "hidden";
            const mainEl = document.querySelector("main");
            if (mainEl instanceof HTMLElement) {
                savedMainOverflow = mainEl.style.overflow;
                mainEl.style.overflow = "hidden";
            }
        }
        if (!openModalStack.some((entry) => entry.id === id)) {
            openModalStack.push({
                id,
                getContainer: () => drawerRef.current,
            });
        }

        return () => {
            const idx = openModalStack.findIndex((entry) => entry.id === id);
            if (idx !== -1) {
                openModalStack.splice(idx, 1);
            }
            if (
                openModalStack.length === 0 &&
                typeof document !== "undefined"
            ) {
                if (savedBodyOverflow !== null) {
                    document.body.style.overflow = savedBodyOverflow;
                    savedBodyOverflow = null;
                }
                if (savedMainOverflow !== null) {
                    const mainEl = document.querySelector("main");
                    if (mainEl instanceof HTMLElement) {
                        mainEl.style.overflow = savedMainOverflow;
                    }
                    savedMainOverflow = null;
                }
            }
        };
    }, [isActive]);

    // Move initial focus on open and restore focus to trigger on close (after commitRoot so React selection restoration never overrides it)
    useEffect(() => {
        if (!isActive) return;

        const container = drawerRef.current;
        const moveInitialFocus = () => {
            if (!container || typeof document === "undefined") return;
            const preferred = initialFocusRef?.current;
            if (preferred && container.contains(preferred)) {
                preferred.focus({ preventScroll: true });
            } else if (!container.contains(document.activeElement)) {
                const focusables = getFocusableElements(container);
                (focusables[0] ?? container).focus({ preventScroll: true });
            }
        };

        // On mobile the drawer slides up from below the screen. Focusing an
        // input mid-slide makes WebKit scroll the backdrop, so the sheet
        // appears to fly in from the top. Wait for the slide to finish.
        const slidesIn =
            isDrawerOnMobile &&
            typeof window !== "undefined" &&
            typeof window.matchMedia === "function" &&
            window.matchMedia("(max-width: 639.98px)").matches &&
            !prefersReducedMotion();
        let focusTimer: ReturnType<typeof setTimeout> | null = null;
        if (slidesIn) {
            focusTimer = setTimeout(moveInitialFocus, DRAWER_ENTER_MS);
        } else {
            moveInitialFocus();
        }

        return () => {
            if (focusTimer) clearTimeout(focusTimer);
            const prev = previousFocusRef.current;
            if (typeof document !== "undefined") {
                const topEntry = openModalStack[openModalStack.length - 1];
                if (prev && prev.isConnected && prev !== document.body) {
                    prev.focus({ preventScroll: true });
                } else if (topEntry) {
                    const topContainer = topEntry.getContainer();
                    if (topContainer) {
                        const focusables = getFocusableElements(topContainer);
                        (focusables[0] ?? topContainer).focus({
                            preventScroll: true,
                        });
                    }
                }
            }
        };
    }, [isActive, initialFocusRef, isDrawerOnMobile]);

    // Clear captured trigger only after focus restoration cleanup has run
    useEffect(() => {
        if (!isOpen && !isActive) {
            previousFocusRef.current = null;
        }
    }, [isOpen, isActive]);

    // Manage focus inside the discard confirmation alertdialog
    useEffect(() => {
        if (!isActive) {
            lastFocusBeforeDiscardRef.current = null;
            return;
        }
        if (showDiscardConfirm) {
            const active =
                typeof document !== "undefined" ? document.activeElement : null;
            if (
                active instanceof HTMLElement &&
                drawerRef.current?.contains(active)
            ) {
                lastFocusBeforeDiscardRef.current = active;
            }
            const discardEl = discardDialogRef.current;
            if (discardEl) {
                const focusables = getFocusableElements(discardEl);
                (focusables[0] ?? discardEl).focus({ preventScroll: true });
            }
        } else if (lastFocusBeforeDiscardRef.current) {
            const target = lastFocusBeforeDiscardRef.current;
            lastFocusBeforeDiscardRef.current = null;
            if (target.isConnected) {
                target.focus({ preventScroll: true });
            } else if (drawerRef.current) {
                const focusables = getFocusableElements(drawerRef.current);
                (focusables[0] ?? drawerRef.current).focus({
                    preventScroll: true,
                });
            }
        }
    }, [showDiscardConfirm, isActive]);

    // Handle ESC and Tab/Shift+Tab trapping (only top-most open modal responds)
    useEffect(() => {
        if (!isActive) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (
                openModalStack.length > 0 &&
                openModalStack[openModalStack.length - 1].id !==
                    modalIdRef.current
            ) {
                return;
            }

            if (e.key === "Escape") {
                if (showDiscardConfirm) {
                    setShowDiscardConfirm(false);
                    return;
                }
                if (closeOnEscape) {
                    handleRequestClose();
                }
                return;
            }

            if (e.key === "Tab" && !e.altKey && !e.ctrlKey && !e.metaKey) {
                const activeContainer = showDiscardConfirm
                    ? discardDialogRef.current
                    : drawerRef.current;
                if (!activeContainer) return;

                const activeEl = document.activeElement;
                if (
                    activeEl instanceof HTMLElement &&
                    !activeContainer.contains(activeEl) &&
                    activeEl.closest('[role="tooltip"]')
                ) {
                    return;
                }

                const focusables = getFocusableElements(activeContainer);
                if (focusables.length === 0) {
                    e.preventDefault();
                    activeContainer.focus({ preventScroll: true });
                    return;
                }

                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const isInside =
                    activeEl instanceof HTMLElement &&
                    activeContainer.contains(activeEl);

                if (e.shiftKey) {
                    if (
                        !isInside ||
                        activeEl === first ||
                        activeEl === activeContainer
                    ) {
                        e.preventDefault();
                        last.focus({ preventScroll: true });
                    }
                } else {
                    if (!isInside || activeEl === last) {
                        e.preventDefault();
                        first.focus({ preventScroll: true });
                    }
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isActive, showDiscardConfirm, closeOnEscape, handleRequestClose]);

    if (!shouldRender) return null;

    const backdropOpacityFactor =
        isDrawerOnMobile && dragTranslateY > 0
            ? Math.max(0, 1 - dragTranslateY / 320)
            : 1;

    const resolvedMaxWidth = maxWidth
        ? SM_MAX_WIDTH_MAP[maxWidth] ||
          (maxWidth.includes("sm:") ? maxWidth : `sm:${maxWidth}`)
        : "";

    const defaultBackdropBg =
        variant === "popover"
            ? "transparent"
            : `rgba(0, 0, 0, ${0.6 * backdropOpacityFactor})`;

    const computedBackdropStyle: React.CSSProperties = backdropStyle
        ? backdropStyle
        : { backgroundColor: defaultBackdropBg };

    const backdropLayoutClass =
        variant === "side-sheet"
            ? "fixed inset-0 z-50 flex justify-end overflow-hidden overscroll-y-contain transition-opacity duration-200"
            : variant === "popover"
              ? "fixed inset-0 z-50 transition-opacity duration-150"
              : variant === "fullscreen"
                ? "fixed inset-0 z-50 flex flex-col overflow-hidden overscroll-y-contain transition-opacity duration-200"
                : variant === "spotlight"
                  ? "fixed inset-0 z-9999 flex items-center justify-center p-6 overflow-hidden overscroll-y-contain transition-opacity duration-200"
                  : `fixed inset-0 z-50 flex overflow-hidden overscroll-y-contain ${
                        isDrawerOnMobile
                            ? "items-end sm:items-center"
                            : "items-center"
                    } justify-center p-0 sm:p-4 transition-opacity duration-200`;

    const panelVariantClass =
        variant === "side-sheet"
            ? `h-dvh w-full max-w-full ${resolvedMaxWidth} border-l-2 border-(--border-ink) bg-(--bg-canvas) shadow-cute-lg flex flex-col overflow-hidden ${
                  isClosing ? "animate-side-sheet-out" : "animate-side-sheet-in"
              }`
            : variant === "popover"
              ? `fixed z-50 w-96 max-w-[calc(100vw-1.5rem)] rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-lg flex flex-col overflow-hidden ${
                    isClosing ? "animate-modal-out" : "animate-pop"
                }`
              : variant === "fullscreen"
                ? `h-dvh w-full flex flex-col bg-(--bg-canvas) overflow-hidden ${
                      isClosing ? "animate-modal-out" : "animate-modal-in"
                  }`
                : variant === "spotlight"
                  ? `flex w-full max-w-xs flex-col items-center justify-center ${
                        isClosing ? "animate-modal-out" : "animate-modal-in"
                    }`
                  : `w-full max-w-full ${resolvedMaxWidth} ${
                        isDrawerOnMobile
                            ? `max-h-[92dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-2xl ${
                                  isClosing
                                      ? "modal-sheet-exit"
                                      : "modal-sheet-enter"
                              }`
                            : `max-h-[90dvh] rounded-2xl ${isClosing ? "animate-modal-out" : "animate-modal-in"}`
                    } bg-(--bg-card) border-t-2 sm:border-2 border-(--border-ink) shadow-cute-lg flex flex-col overflow-hidden pb-[env(safe-area-inset-bottom,0px)]`;

    const panelStyle: React.CSSProperties | undefined =
        variant === "popover"
            ? { top: popoverPos.top, right: popoverPos.right }
            : isDrawerOnMobile && (dragTranslateY > 0 || isSlidingOut)
              ? {
                    transform: isSlidingOut
                        ? "translate3d(0, 100%, 0)"
                        : `translate3d(0, ${dragTranslateY}px, 0)`,
                    transition:
                        isDragging || prefersReducedMotion()
                            ? "none"
                            : "transform var(--duration-base) var(--ease-out-soft)",
                }
              : undefined;

    const modalNode = (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={ariaLabel}
            aria-labelledby={ariaLabelledBy}
            onClick={(e) => {
                if (closeOnBackdropClick && e.target === e.currentTarget) {
                    handleRequestClose();
                }
            }}
            style={computedBackdropStyle}
            className={`${backdropLayoutClass} ${
                isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
            } ${backdropClassName}`}
        >
            <div
                ref={drawerRef}
                tabIndex={-1}
                data-testid={dataTestId}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={panelStyle}
                className={`focus:outline-none ${panelVariantClass} ${className}`}
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
                    ref={discardDialogRef}
                    tabIndex={-1}
                    data-discard-dialog="true"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="discard-dialog-title"
                    aria-describedby="discard-dialog-desc"
                    className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-modal-in focus:outline-none"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-(--bg-card) border-2 border-(--border-ink) shadow-cute-lg p-5 flex flex-col gap-4 text-(--text-ink)">
                        <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-(--border-ink) bg-(--pastel-coral-subtle) text-(--accent-coral)">
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
    const { isPrivacyMode } = usePrivacy();
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
                            {maskMoneyNode(subtitle, isPrivacyMode)}
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
                    className="relative flex h-8 w-8 items-center justify-center rounded-lg after:absolute after:-inset-2 after:content-[''] border border-(--border-ink) text-(--text-ink) hover:bg-(--pastel-coral-light) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
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
    /** Opt in to soft fade masks at the top/bottom edges while content overflows. */
    scrollFade?: boolean;
}

export function ModalBody({
    children,
    className = "",
    scrollFade = false,
}: ModalBodyProps) {
    const classes = `flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4 ${className}`;
    if (scrollFade) {
        return <ScrollArea className={classes}>{children}</ScrollArea>;
    }
    return <div className={classes}>{children}</div>;
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
