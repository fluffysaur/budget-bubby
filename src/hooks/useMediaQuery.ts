import { useSyncExternalStore } from "react";

/** Tracks a CSS media query. Returns false when matchMedia is unavailable. */
export function useMediaQuery(query: string): boolean {
    return useSyncExternalStore(
        (onChange) => {
            if (typeof window === "undefined" || !window.matchMedia) {
                return () => {};
            }
            const mql = window.matchMedia(query);
            mql.addEventListener?.("change", onChange);
            return () => mql.removeEventListener?.("change", onChange);
        },
        () =>
            typeof window !== "undefined" && window.matchMedia
                ? window.matchMedia(query).matches
                : false,
        () => false,
    );
}
