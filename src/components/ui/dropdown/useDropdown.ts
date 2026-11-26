import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type HTMLAttributes,
    type InputHTMLAttributes,
    type KeyboardEvent,
    type RefObject,
} from "react";
import {
    autoUpdate,
    flip,
    offset,
    shift,
    size,
    useClick,
    useDismiss,
    useFloating,
    useInteractions,
    useTypeahead,
} from "@floating-ui/react";
import { useMediaQuery } from "../../../hooks/useMediaQuery";
import type { SelectItem, SelectOption } from "./types";
import {
    filterItems,
    firstEnabledIndex,
    flattenOptions,
    lastEnabledIndex,
    nextEnabledIndex,
    shouldShowSearch,
} from "./optionUtils";

/** Same breakpoint AnimatedModal uses for its bottom sheet. */
export const DROPDOWN_MOBILE_QUERY = "(max-width: 639.98px)";

/** Popover never grows past this, but always fits the trigger width. */
const POPOVER_MAX_HEIGHT = 384;
const POPOVER_MIN_HEIGHT = 160;
const VIEWPORT_PADDING = 8;

export interface UseDropdownParams {
    items: readonly SelectItem[];
    /** Drives `aria-selected` and the check/checkbox on each row. */
    isSelected: (value: string) => boolean;
    /** Called on Enter, Space or click of an enabled row. */
    onPick: (option: SelectOption) => void;
    /** Select closes after a pick; MultiSelect stays open. */
    closeOnPick: boolean;
    searchable?: boolean;
    disabled?: boolean;
    /** Trigger id. A stable id is generated when omitted. */
    id?: string;
    /** Visible label text; the trigger and listbox are labelled by it. */
    label?: string;
    "aria-label"?: string;
}

/**
 * State, positioning, ARIA wiring and keyboard handling shared by Select and
 * MultiSelect. Rendering lives in DropdownField, DropdownSurface and
 * OptionList, which all take the returned object.
 *
 * Focus stays on one element while open (the search input, or the listbox
 * itself) and the active row is exposed through `aria-activedescendant`.
 */
export function useDropdown({
    items,
    isSelected,
    onPick,
    closeOnPick,
    searchable,
    disabled = false,
    id,
    label,
    "aria-label": ariaLabel,
}: UseDropdownParams) {
    const isMobile = useMediaQuery(DROPDOWN_MOBILE_QUERY);
    const [open, setOpenState] = useState(false);
    const [query, setQueryState] = useState("");
    const [activeIndex, setActiveIndex] = useState<number | null>(null);

    const reactId = useId();
    const triggerId = id || `dropdown-${reactId.replace(/:/g, "")}`;
    const listboxId = `${triggerId}-listbox`;
    const labelId = `${triggerId}-label`;
    const titleId = `${triggerId}-title`;
    const optionId = useCallback(
        (index: number) => `${listboxId}-option-${index}`,
        [listboxId],
    );

    const showSearch = shouldShowSearch(items, searchable);
    const visibleItems = useMemo(
        () => (showSearch ? filterItems(items, query) : [...items]),
        [items, query, showSearch],
    );
    const visibleOptions = useMemo(
        () => flattenOptions(visibleItems),
        [visibleItems],
    );

    const searchRef = useRef<HTMLInputElement | null>(null);
    const listboxRef = useRef<HTMLDivElement | null>(null);
    const surfaceRef = useRef<HTMLDivElement | null>(null);
    const labelsRef = useRef<Array<string | null>>([]);
    const typingRef = useRef(false);

    useEffect(() => {
        labelsRef.current = visibleOptions.map((o) =>
            o.disabled ? null : o.label,
        );
    }, [visibleOptions]);

    const initialActiveIndex = useCallback(
        (options: readonly SelectOption[]) => {
            const selected = options.findIndex(
                (o) => !o.disabled && isSelected(o.value),
            );
            if (selected >= 0) return selected;
            const first = firstEnabledIndex(options);
            return first >= 0 ? first : null;
        },
        [isSelected],
    );

    const setOpen = useCallback(
        (next: boolean) => {
            if (next && disabled) return;
            setOpenState(next);
            if (next) {
                setActiveIndex(initialActiveIndex(flattenOptions(items)));
            } else {
                setQueryState("");
            }
        },
        [disabled, initialActiveIndex, items],
    );

    const setQuery = useCallback(
        (next: string) => {
            setQueryState(next);
            setActiveIndex(
                initialActiveIndex(flattenOptions(filterItems(items, next))),
            );
        },
        [initialActiveIndex, items],
    );

    const { refs, floatingStyles, context } = useFloating({
        open,
        onOpenChange: setOpen,
        placement: "bottom-start",
        whileElementsMounted: isMobile ? undefined : autoUpdate,
        middleware: isMobile
            ? []
            : [
                  offset(6),
                  flip({ padding: VIEWPORT_PADDING }),
                  shift({ padding: VIEWPORT_PADDING }),
                  size({
                      padding: VIEWPORT_PADDING,
                      apply({ rects, availableHeight, elements }) {
                          Object.assign(elements.floating.style, {
                              minWidth: `${rects.reference.width}px`,
                              maxHeight: `${Math.max(
                                  POPOVER_MIN_HEIGHT,
                                  Math.min(availableHeight, POPOVER_MAX_HEIGHT),
                              )}px`,
                          });
                      },
                  }),
              ],
    });

    const setSurfaceRef = useCallback(
        (node: HTMLDivElement | null) => {
            surfaceRef.current = node;
            refs.setFloating(node);
        },
        [refs],
    );

    const click = useClick(context, { enabled: !disabled });
    // Escape is handled in onSurfaceKeyDown so it can stop propagation
    // before an enclosing AnimatedModal's window listener sees it.
    const dismiss = useDismiss(context, { escapeKey: false });
    const typeahead = useTypeahead(context, {
        listRef: labelsRef,
        activeIndex,
        enabled: open && !showSearch,
        onMatch: (index) => {
            if (open) setActiveIndex(index);
        },
        onTypingChange: (typing) => {
            typingRef.current = typing;
        },
    });
    const { getReferenceProps, getFloatingProps } = useInteractions([
        click,
        dismiss,
        typeahead,
    ]);

    // Keep the active row in view while navigating.
    useEffect(() => {
        if (!open || activeIndex === null) return;
        const el = document.getElementById(optionId(activeIndex));
        el?.scrollIntoView?.({ block: "nearest" });
    }, [open, activeIndex, optionId]);

    const pick = useCallback(
        (option: SelectOption | undefined) => {
            if (!option || option.disabled) return;
            onPick(option);
            if (closeOnPick) setOpen(false);
        },
        [closeOnPick, onPick, setOpen],
    );

    const move = useCallback(
        (direction: 1 | -1) => {
            setActiveIndex((current) => {
                if (current === null) {
                    const edge =
                        direction === 1
                            ? firstEnabledIndex(visibleOptions)
                            : lastEnabledIndex(visibleOptions);
                    return edge >= 0 ? edge : null;
                }
                return nextEnabledIndex(visibleOptions, current, direction);
            });
        },
        [visibleOptions],
    );

    const onSurfaceKeyDown = useCallback(
        (event: KeyboardEvent<HTMLElement>) => {
            const target = event.target as HTMLElement;
            const inInput = target.tagName === "INPUT";
            const onButton = target.tagName === "BUTTON";

            switch (event.key) {
                case "Escape":
                    event.preventDefault();
                    event.stopPropagation();
                    setOpen(false);
                    return;
                case "ArrowDown":
                    event.preventDefault();
                    move(1);
                    return;
                case "ArrowUp":
                    event.preventDefault();
                    move(-1);
                    return;
                case "Home":
                case "End": {
                    if (inInput) return;
                    event.preventDefault();
                    const edge =
                        event.key === "Home"
                            ? firstEnabledIndex(visibleOptions)
                            : lastEnabledIndex(visibleOptions);
                    if (edge >= 0) setActiveIndex(edge);
                    return;
                }
                case "Enter":
                    if (onButton) return;
                    event.preventDefault();
                    if (activeIndex !== null) pick(visibleOptions[activeIndex]);
                    return;
                case " ":
                    if (inInput || onButton || typingRef.current) return;
                    event.preventDefault();
                    if (activeIndex !== null) pick(visibleOptions[activeIndex]);
                    return;
                case "Tab": {
                    // Keep an enclosing modal's focus trap out of the way, and
                    // close back to the trigger when tabbing past either end.
                    event.stopPropagation();
                    const root = surfaceRef.current;
                    if (!root) return;
                    const focusables = Array.from(
                        root.querySelectorAll<HTMLElement>(
                            'input, button:not([disabled]), [role="listbox"]',
                        ),
                    );
                    const index = focusables.indexOf(
                        document.activeElement as HTMLElement,
                    );
                    const atEdge =
                        index === -1 ||
                        (event.shiftKey
                            ? index === 0
                            : index === focusables.length - 1);
                    if (atEdge) {
                        event.preventDefault();
                        setOpen(false);
                    }
                    return;
                }
                default:
                    return;
            }
        },
        [activeIndex, move, pick, setOpen, visibleOptions],
    );

    const getTriggerProps = useCallback(
        (userProps: HTMLAttributes<HTMLButtonElement> = {}) =>
            getReferenceProps({
                ...userProps,
                id: triggerId,
                role: "combobox",
                "aria-haspopup": "listbox",
                "aria-expanded": open,
                "aria-controls": open ? listboxId : undefined,
                "aria-labelledby": label ? labelId : undefined,
                "aria-label": label ? undefined : ariaLabel,
                onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
                    userProps.onKeyDown?.(event);
                    if (open && event.key === "Escape") {
                        event.preventDefault();
                        event.stopPropagation();
                        setOpen(false);
                        return;
                    }
                    if (
                        !open &&
                        (event.key === "ArrowDown" || event.key === "ArrowUp")
                    ) {
                        event.preventDefault();
                        setOpen(true);
                    }
                },
            }),
        [
            ariaLabel,
            getReferenceProps,
            label,
            labelId,
            listboxId,
            open,
            setOpen,
            triggerId,
        ],
    );

    const getSurfaceProps = useCallback(
        (userProps: HTMLAttributes<HTMLDivElement> = {}) =>
            getFloatingProps({
                ...userProps,
                onKeyDown: onSurfaceKeyDown,
            }),
        [getFloatingProps, onSurfaceKeyDown],
    );

    const activeDescendant =
        open && activeIndex !== null && visibleOptions[activeIndex]
            ? optionId(activeIndex)
            : undefined;

    const getListboxProps = useCallback(
        (
            multiselectable = false,
        ): HTMLAttributes<HTMLDivElement> & {
            ref: RefObject<HTMLDivElement | null>;
        } => ({
            ref: listboxRef,
            id: listboxId,
            role: "listbox",
            tabIndex: 0,
            "aria-labelledby": label ? labelId : undefined,
            "aria-label": label ? undefined : ariaLabel,
            "aria-activedescendant": activeDescendant,
            "aria-multiselectable": multiselectable || undefined,
        }),
        [activeDescendant, ariaLabel, label, labelId, listboxId],
    );

    const getSearchProps = useCallback(
        (): InputHTMLAttributes<HTMLInputElement> & {
            ref: RefObject<HTMLInputElement | null>;
        } => ({
            ref: searchRef,
            type: "search",
            value: query,
            onChange: (e) => setQuery(e.target.value),
            "aria-label": "Search options",
            "aria-controls": listboxId,
            "aria-activedescendant": activeDescendant,
            autoComplete: "off",
            spellCheck: false,
        }),
        [activeDescendant, listboxId, query, setQuery],
    );

    const getOptionProps = useCallback(
        (
            index: number,
            option: SelectOption,
        ): HTMLAttributes<HTMLDivElement> => ({
            id: optionId(index),
            role: "option",
            "aria-selected": isSelected(option.value),
            "aria-disabled": option.disabled || undefined,
            onClick: () => pick(option),
            onMouseMove: () => {
                if (!option.disabled && activeIndex !== index) {
                    setActiveIndex(index);
                }
            },
        }),
        [activeIndex, isSelected, optionId, pick],
    );

    return {
        open,
        setOpen,
        isMobile,
        disabled,
        query,
        setQuery,
        showSearch,
        visibleItems,
        visibleOptions,
        activeIndex,
        setActiveIndex,
        isSelected,
        ids: { triggerId, listboxId, labelId, titleId, optionId },
        label,
        ariaLabel,
        floating: { refs, floatingStyles, context },
        refs: { searchRef, listboxRef, surfaceRef },
        setSurfaceRef,
        /** Desktop focuses search; mobile keeps the keyboard down. */
        initialFocusRef: showSearch && !isMobile ? searchRef : listboxRef,
        getTriggerProps,
        getSurfaceProps,
        getListboxProps,
        getSearchProps,
        getOptionProps,
    };
}

export type DropdownState = ReturnType<typeof useDropdown>;
