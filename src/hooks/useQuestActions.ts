/**
 * Maps a tapped Bubby quest to the place it can be completed.
 * Router-safe: outside a router, navigation quests are no-ops.
 */

import { useCallback } from "react";
import { useBubby } from "./useBubby";
import { useOptionalNavigate } from "./useOptionalNavigate";
import type { Quest } from "../lib/bubby/quests";
import { recapWeekFor } from "../lib/bubby/recap";
import { readBubbyStore } from "../lib/bubby/storage";
import { toSgtDateString } from "../lib/bubby/dates";

export const WEEKLY_RECAP_ID = "weekly-recap";

/**
 * Whether a pending quest can be acted on right now. The recap quest needs the
 * "Last Week" card, which is only shown Mon-Wed until acknowledged.
 */
export function isQuestSelectable(quest: Quest): boolean {
    if (quest.id !== "recap") return true;
    return (
        recapWeekFor(toSgtDateString(), readBubbyStore().recapSeenWeek) !== null
    );
}

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
                case "goal":
                    navigate?.("/goals");
                    break;
                case "cards":
                    navigate?.("/accounts");
                    break;
                case "sweep":
                    navigate?.("/expenses");
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
