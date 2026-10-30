/**
 * DOM and Form Input utilities for Budget Bubby
 */

/**
 * Checks if an input element has been modified by the user.
 */
export function isInputElementDirty(
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

/**
 * Finds the closest scrollable container between target and modal boundary.
 */
export function findScrollableAncestor(
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
