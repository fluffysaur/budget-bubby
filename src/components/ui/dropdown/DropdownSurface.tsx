import type { ReactNode, TouchEvent } from "react";
import { FloatingFocusManager, FloatingPortal } from "@floating-ui/react";
import { AnimatePresence, m } from "motion/react";
import { fade, pop, sheetUp } from "../../../lib/motion";
import type { DropdownState } from "./useDropdown";
import { SearchField } from "./SearchField";

export interface DropdownSurfaceProps {
    dropdown: DropdownState;
    /** Sheet heading; usually the field label or aria-label. */
    title: string;
    /** Small action beside the search / title, e.g. "Clear". */
    headerAction?: ReactNode;
    /** Pinned under the list, e.g. MultiSelect's "Done". */
    footer?: ReactNode;
    /** Usually an OptionList. */
    children: ReactNode;
    searchPlaceholder?: string;
}

// Touches inside the sheet must not reach an enclosing AnimatedModal's
// drag-to-close handlers, which listen through the React tree.
const stopTouch = (e: TouchEvent) => e.stopPropagation();

/**
 * Desktop: an anchored popover. Mobile (< 640px): a bottom sheet stacked over
 * whatever is open, including a modal that is itself a sheet. Both portal to
 * the body above AnimatedModal and return focus to the trigger on close.
 */
export function DropdownSurface({
    dropdown,
    title,
    headerAction,
    footer,
    children,
    searchPlaceholder,
}: DropdownSurfaceProps) {
    const { open, isMobile, showSearch, floating, ids, setSurfaceRef } =
        dropdown;

    const search = showSearch ? (
        <SearchField dropdown={dropdown} placeholder={searchPlaceholder} />
    ) : null;

    return (
        <FloatingPortal>
            <AnimatePresence>
                {open && isMobile && (
                    <FloatingFocusManager
                        key="sheet"
                        context={floating.context}
                        modal
                        initialFocus={dropdown.initialFocusRef}
                        returnFocus
                    >
                        <div
                            className="fixed inset-0 z-9999 flex items-end"
                            onTouchStart={stopTouch}
                            onTouchMove={stopTouch}
                            onTouchEnd={stopTouch}
                        >
                            <m.div
                                {...fade}
                                className="absolute inset-0 touch-none bg-black/40"
                                aria-hidden="true"
                                data-testid="dropdown-scrim"
                            />
                            <m.div
                                {...sheetUp}
                                {...dropdown.getSurfaceProps()}
                                ref={setSurfaceRef}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby={ids.titleId}
                                className="relative flex max-h-[70dvh] w-full flex-col rounded-t-3xl border-t-2 border-(--border-ink) bg-(--bg-card) pb-[env(safe-area-inset-bottom,0px)] shadow-cute-lg"
                            >
                                <div className="flex shrink-0 justify-center pb-1 pt-2.5">
                                    <div className="h-1.5 w-12 rounded-full bg-(--border-ink) opacity-30" />
                                </div>
                                <div className="flex min-h-11 shrink-0 items-center gap-3 px-4">
                                    <h2
                                        id={ids.titleId}
                                        className="min-w-0 flex-1 truncate font-display text-base font-black text-(--text-ink)"
                                    >
                                        {title}
                                    </h2>
                                    {headerAction}
                                </div>
                                {search && (
                                    <div className="shrink-0 px-3 pb-1 pt-1">
                                        {search}
                                    </div>
                                )}
                                {children}
                                {footer && (
                                    <div className="shrink-0 border-t border-(--border-subtle) p-3">
                                        {footer}
                                    </div>
                                )}
                            </m.div>
                        </div>
                    </FloatingFocusManager>
                )}
                {open && !isMobile && (
                    <FloatingFocusManager
                        key="popover"
                        context={floating.context}
                        modal={false}
                        initialFocus={dropdown.initialFocusRef}
                        returnFocus
                    >
                        <div
                            ref={setSurfaceRef}
                            style={floating.floatingStyles}
                            {...dropdown.getSurfaceProps()}
                            className="z-9999 flex w-max max-w-80 flex-col"
                        >
                            <m.div
                                {...pop}
                                className="flex min-h-0 flex-col overflow-hidden rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute"
                            >
                                {(search || headerAction) && (
                                    <div className="flex shrink-0 items-center justify-end gap-2 border-b border-(--border-subtle) p-1">
                                        {search}
                                        {headerAction}
                                    </div>
                                )}
                                {children}
                                {footer && (
                                    <div className="shrink-0 border-t border-(--border-subtle) p-1.5">
                                        {footer}
                                    </div>
                                )}
                            </m.div>
                        </div>
                    </FloatingFocusManager>
                )}
            </AnimatePresence>
        </FloatingPortal>
    );
}
