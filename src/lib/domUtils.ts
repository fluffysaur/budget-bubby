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

const FOCUSABLE_SELECTOR = [
    "a[href]",
    "area[href]",
    "button:not([disabled])",
    'input:not([disabled]):not([type="hidden"])',
    "select:not([disabled])",
    "textarea:not([disabled])",
    "summary",
    '[tabindex]:not([tabindex="-1"])',
    '[contenteditable="true"]',
    '[contenteditable=""]',
].join(", ");

function isElementHidden(el: HTMLElement, boundary: HTMLElement): boolean {
    if (el.closest("[hidden], [inert]")) return true;
    let current: HTMLElement | null = el;
    while (current && current !== boundary) {
        if (typeof window !== "undefined" && window.getComputedStyle) {
            const style = window.getComputedStyle(current);
            if (style.display === "none" || style.visibility === "hidden") {
                return true;
            }
        }
        current = current.parentElement;
    }
    return false;
}

/**
 * Returns keyboard-focusable descendants of `container` in DOM order.
 */
export function getFocusableElements(
    container: HTMLElement | null,
): HTMLElement[] {
    if (!container) return [];
    const candidates = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const result: HTMLElement[] = [];
    for (let i = 0; i < candidates.length; i++) {
        const el = candidates[i];
        if (el.tabIndex < 0) continue;
        if (isElementHidden(el, container)) continue;
        result.push(el);
    }
    return result;
}
