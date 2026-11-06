/**
 * DelightHost: mounted once in the app shell.
 * - Checks in the logged-in member for today after every log
 * - Routes inbox triage to a soft routine cue (no per-item toast)
 * - Keeps the per-device high-water mark and snapshot in bb_bubby_v1
 * - Diffs stage and unlocks against what this device has seen and plays
 *   the "Bubby grew!" / "New: Kopi Cup" moments
 * - Hosts milestone confetti and toasts
 */

import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useBubby } from "../../hooks/useBubby";
import { useActivityCheckins } from "../../hooks/useActivityCheckins";
import { emitAppEvent, onAppEvent, type MilestoneDetail } from "../../lib/appEvents";
import { feedback } from "../../lib/delight/feedback";
import { setInboxPending } from "../../lib/delight/inboxState";
import { readBubbyStore, updateBubbyStore } from "../../lib/bubby/storage";
import { STAGES, HATCHLING_STAGE } from "../../lib/bubby/growth";
import { getAccessory } from "../../lib/bubby/accessories";
import { ConfettiBurst } from "../ui/ConfettiBurst";
import { MilestoneToast } from "./MilestoneToast";

const BubbySheet = lazy(() => import("./BubbySheet"));

interface QueuedToast extends MilestoneDetail {
    id: number;
}

const MAX_QUEUED_TOASTS = 3;

export function DelightHost() {
    useActivityCheckins();
    const bubby = useBubby();
    const { isReady, state, equipped, unlocked } = bubby;

    const [toasts, setToasts] = useState<QueuedToast[]>([]);
    const [burstKey, setBurstKey] = useState(0);
    const toastSeq = useRef(0);
    const [sheet, setSheet] = useState<{ open: boolean; accessoryId?: string } | null>(null);

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

    // Stage-ups and unlocks, once per device
    useEffect(() => {
        if (!isReady) return;
        const store = readBubbyStore();
        const seenStage = store.seenStage ?? 0;

        if (state.stage > seenStage) {
            const hatched = state.stage >= HATCHLING_STAGE && seenStage < HATCHLING_STAGE;
            const stageName = STAGES[state.stage].name;
            feedback.milestone("stage-up", {
                dedupeKey: `stage:${state.stage}`,
                title: hatched ? "Bubby hatched!" : "Bubby grew!",
                subtitle: state.stage === STAGES.length - 1 ? "Fully grown" : `Now a ${stageName}`,
                primary: { label: "Meet Bubby", event: "bubby:open-sheet" },
            });
        }
        if (state.stage !== store.seenStage) {
            updateBubbyStore({ seenStage: Math.max(state.stage, seenStage) });
        }

        const seen = store.seenAccessories;
        if (!seen) {
            // First run on this device: learn what is already unlocked silently
            updateBubbyStore({ seenAccessories: unlocked });
            return;
        }
        const fresh = unlocked.filter((id) => !seen.includes(id));
        if (fresh.length > 0) {
            const first = getAccessory(fresh[0]);
            if (first) {
                feedback.milestone("unlock", {
                    dedupeKey: `unlock:${first.id}`,
                    title: `New: ${first.label}`,
                    subtitle: fresh.length > 1 ? `+${fresh.length - 1} more to try` : "Ready to wear",
                    primary: { label: "Try it on", event: "bubby:open-sheet", accessoryId: first.id },
                });
            }
            updateBubbyStore({ seenAccessories: Array.from(new Set([...seen, ...fresh])) });
        }
    }, [isReady, state.stage, unlocked]);

    // Inbox triage: a soft pop and a nod per item, never a toast
    useEffect(() => {
        const offs = [
            onAppEvent("inbox:items-arrived", (d) => setInboxPending(d.pendingCount)),
            onAppEvent("inbox:item-confirmed", (d) => {
                setInboxPending(d.remaining);
                feedback.routine("triage");
            }),
            onAppEvent("inbox:item-discarded", (d) => {
                setInboxPending(d.remaining);
                feedback.routine("triage");
            }),
        ];
        return () => offs.forEach((off) => off());
    }, []);

    // Milestone confetti and toasts
    useEffect(
        () =>
            onAppEvent("delight:milestone", (detail) => {
                if (detail.confetti) setBurstKey((k) => k + 1);
                if (detail.title) {
                    toastSeq.current += 1;
                    const id = toastSeq.current;
                    setToasts((prev) => [...prev, { ...detail, id }].slice(-MAX_QUEUED_TOASTS));
                }
            }),
        [],
    );

    // Bubby sheet: one lazy instance, kept mounted after first open for the exit animation
    useEffect(
        () =>
            onAppEvent("bubby:open-sheet", (detail) =>
                setSheet({ open: true, accessoryId: detail?.accessoryId }),
            ),
        [],
    );
    const closeSheet = useCallback(
        () => setSheet((prev) => (prev ? { ...prev, open: false } : prev)),
        [],
    );

    const clearBurst = useCallback(() => setBurstKey(0), []);
    const shiftToast = useCallback(() => setToasts((prev) => prev.slice(1)), []);
    const acknowledge = useCallback(() => {
        feedback.routine("acknowledge");
        shiftToast();
    }, [shiftToast]);

    const current = toasts[0];

    return (
        <>
            {sheet && (
                <Suspense fallback={null}>
                    <BubbySheet
                        isOpen={sheet.open}
                        onClose={closeSheet}
                        focusAccessoryId={sheet.accessoryId}
                    />
                </Suspense>
            )}
            {burstKey > 0 && <ConfettiBurst key={burstKey} onDone={clearBurst} />}
            {current && (
                <MilestoneToast
                    key={current.id}
                    title={current.title ?? ""}
                    subtitle={current.subtitle}
                    stage={state.stage}
                    equipped={equipped as Record<string, string>}
                    primaryLabel={current.primary?.label}
                    onPrimary={
                        current.primary?.event
                            ? () => {
                                  emitAppEvent("bubby:open-sheet", {
                                      accessoryId: current.primary?.accessoryId,
                                  });
                                  shiftToast();
                              }
                            : undefined
                    }
                    onAcknowledge={acknowledge}
                    onTimeout={shiftToast}
                />
            )}
        </>
    );
}

export default DelightHost;
