import { useCallback, useState } from "react";
import type { ChangeMode } from "../lib/accountChange";

export const ACCOUNT_CHANGE_MODE_KEY = "bb:account-change-mode";

function readStored(): ChangeMode {
    try {
        return window.localStorage.getItem(ACCOUNT_CHANGE_MODE_KEY) ===
            "percent"
            ? "percent"
            : "amount";
    } catch {
        return "amount";
    }
}

/** How account changes are shown ($ or %), remembered per device. */
export function useAccountChangeMode() {
    const [changeMode, setMode] = useState<ChangeMode>(readStored);

    const setChangeMode = useCallback((mode: ChangeMode) => {
        setMode(mode);
        try {
            window.localStorage.setItem(ACCOUNT_CHANGE_MODE_KEY, mode);
        } catch {
            // Storage unavailable (private mode / blocked); keep in-memory state.
        }
    }, []);

    return { changeMode, setChangeMode };
}
