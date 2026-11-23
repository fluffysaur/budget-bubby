import { useCallback, useState } from "react";

export const SIDEBAR_COLLAPSED_KEY = "bb:sidebar-collapsed";

function readStored(): boolean {
    try {
        return window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1";
    } catch {
        return false;
    }
}

/** Desktop sidebar collapsed state, persisted in localStorage (default expanded). */
export function useSidebarCollapsed() {
    const [collapsed, setCollapsed] = useState<boolean>(readStored);

    const toggle = useCallback(() => {
        setCollapsed((prev) => {
            const next = !prev;
            try {
                window.localStorage.setItem(
                    SIDEBAR_COLLAPSED_KEY,
                    next ? "1" : "0",
                );
            } catch {
                // Storage unavailable (private mode / blocked); keep in-memory state.
            }
            return next;
        });
    }, []);

    return { collapsed, toggle };
}
