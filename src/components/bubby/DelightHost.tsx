/**
 * DelightHost: mounted once in the app shell.
 * - Checks in the logged-in member for today after every log
 * - Routes inbox triage to a soft routine cue (no per-item toast)
 * - Keeps the per-device high-water mark and snapshot in bb_bubby_v1
 */

import { useEffect } from "react";
import { useBubby } from "../../hooks/useBubby";
import { useActivityCheckins } from "../../hooks/useActivityCheckins";
import { onAppEvent } from "../../lib/appEvents";
import { feedback } from "../../lib/delight/feedback";
import { readBubbyStore, updateBubbyStore } from "../../lib/bubby/storage";

export function DelightHost() {
    useActivityCheckins();
    const bubby = useBubby();
    const { isReady, state, equipped } = bubby;

    // High-water mark and a snapshot for components outside the providers
    useEffect(() => {
        if (!isReady) return;
        const store = readBubbyStore();
        const snapshot = { stage: state.stage, equipped: equipped as Record<string, string> };
        const hwmChanged = state.derivedPoints > (store.hwmPoints ?? 0);
        const snapChanged = JSON.stringify(store.snapshot) !== JSON.stringify(snapshot);
        if (hwmChanged || snapChanged) {
            updateBubbyStore({
                hwmPoints: Math.max(state.derivedPoints, store.hwmPoints ?? 0),
                snapshot,
            });
        }
    }, [isReady, state.derivedPoints, state.stage, equipped]);

    // Inbox triage: a soft pop and a nod per item, never a toast
    useEffect(() => {
        const offs = [
            onAppEvent("inbox:item-confirmed", () => feedback.routine("triage")),
            onAppEvent("inbox:item-discarded", () => feedback.routine("triage")),
        ];
        return () => offs.forEach((off) => off());
    }, []);

    return null;
}

export default DelightHost;
