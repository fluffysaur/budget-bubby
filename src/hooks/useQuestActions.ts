/**
 * Maps a tapped Bubby quest to the place it can be completed.
 * Router-safe: outside a router, navigation quests are no-ops.
 */

import { useCallback, useContext } from "react";
import { UNSAFE_NavigationContext } from "react-router-dom";
import { useBubby } from "./useBubby";
import type { Quest } from "../lib/bubby/quests";

export const WEEKLY_RECAP_ID = "weekly-recap";

export function useQuestActions(onDone?: () => void) {
    const { pet } = useBubby();
    const navigator = useContext(UNSAFE_NavigationContext)?.navigator;

    return useCallback(
        (quest: Quest) => {
            if (quest.done) return;
            switch (quest.id) {
                case "log":
                    window.dispatchEvent(new Event("openQuickAdd"));
                    break;
                case "pet":
                    pet();
                    return;
                case "inbox":
                    navigator?.push("/inbox");
                    break;
                case "balances":
                    navigator?.push("/accounts");
                    break;
                case "recap": {
                    const el = document.getElementById(WEEKLY_RECAP_ID);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth" });
                    } else {
                        navigator?.push("/");
                    }
                    break;
                }
            }
            onDone?.();
        },
        [pet, navigator, onDone],
    );
}
