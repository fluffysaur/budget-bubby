/**
 * Maps a tapped Bubby quest to the place it can be completed.
 * Router-safe: outside a router, navigation quests are no-ops.
 */

import { useCallback } from "react";
import { useBubby } from "./useBubby";
import { useOptionalNavigate } from "./useOptionalNavigate";
import type { Quest } from "../lib/bubby/quests";

export const WEEKLY_RECAP_ID = "weekly-recap";

export function useQuestActions(onDone?: () => void) {
    const { pet } = useBubby();
    const navigate = useOptionalNavigate();

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
                    navigate?.("/inbox");
                    break;
                case "balances":
                    navigate?.("/accounts");
                    break;
                case "recap": {
                    const el = document.getElementById(WEEKLY_RECAP_ID);
                    if (el) {
                        el.scrollIntoView({ behavior: "smooth" });
                    } else {
                        navigate?.("/");
                    }
                    break;
                }
            }
            onDone?.();
        },
        [pet, navigate, onDone],
    );
}
