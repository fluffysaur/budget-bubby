/**
 * DelightHost: mounted once in the app shell.
 * - Checks in the logged-in member for today after every log
 * - Inbox: a soft cue per triage, an inbox-zero celebration once a day
 * - Moments, once per device: a body change per penguin (named for a
 *   partner's), reunion after a feed, full belly (all daily quests), the
 *   weekly snack treat, and a cheer when both partners have fed Bubby today
 * - Hosts milestone confetti, toasts and the lazy Bubby sheet
 */

import {
    lazy,
    Suspense,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useBubby } from "../../hooks/useBubby";
import { useActivityCheckins } from "../../hooks/useActivityCheckins";
import { setExerciseActor } from "../../lib/bubby/activity";
import {
    emitAppEvent,
    onAppEvent,
    type MilestoneDetail,
} from "../../lib/appEvents";
import { feedback } from "../../lib/delight/feedback";
import { setInboxPending } from "../../lib/delight/inboxState";
import {
    addLocalExercise,
    addSnack,
    hasCelebrated,
    markCelebrated,
    readBubbyStore,
    updateBubbyStore,
} from "../../lib/bubby/storage";
import { allDone } from "../../lib/bubby/quests";
import { snackForWeek, snackLabel } from "../../lib/bubby/snacks";
import { mondayOf, toSgtDateString } from "../../lib/bubby/dates";
import type { BubbyBody } from "../../lib/bubby/body";
import { ConfettiBurst } from "../ui/ConfettiBurst";
import { AnimatePresence } from "motion/react";
import { MilestoneToast } from "./MilestoneToast";

const BubbySheet = lazy(() => import("./BubbySheet"));

interface QueuedToast extends MilestoneDetail {
    id: number;
}

const MAX_QUEUED_TOASTS = 3;

const BODY_TITLE: Record<Exclude<BubbyBody, "regular">, string> = {
    buff: "Bubby got buff!",
    lean: "Bubby's looking lean!",
    chubby: "Bubby's well fed!",
};

const PAIR_BODY_TITLE: Record<Exclude<BubbyBody, "regular">, string> = {
    buff: "Bubby got buff!",
    lean: "Bubby is looking lean!",
    chubby: "Bubby is well fed!",
};

/** "Bubby got buff!" solo; "Your Bubby…" or "Sam's Bubby…" in a pair. */
function bodyTitle(body: Exclude<BubbyBody, "regular">, whose?: string) {
    return whose ? `${whose} ${PAIR_BODY_TITLE[body]}` : BODY_TITLE[body];
}

export function DelightHost() {
    useActivityCheckins();
    const bubby = useBubby();
    const {
        isReady,
        weeklyQuestsReady,
        monthlyQuestsReady,
        body,
        mood,
        penguins,
        fedToday,
        dailyQuests,
        weeklyQuests,
        monthlyQuests,
        today,
        me,
        members,
    } = bubby;

    const [toasts, setToasts] = useState<QueuedToast[]>([]);
    const [burstKey, setBurstKey] = useState(0);
    const toastSeq = useRef(0);
    const [sheetOpen, setSheetOpen] = useState<boolean | null>(null);

    // Snapshot for components outside the providers (the save toast)
    useEffect(() => {
        if (!isReady) return;
        const store = readBubbyStore();
        if (store.snapshot?.body !== body || store.snapshot?.mood !== mood) {
            updateBubbyStore({ snapshot: { body, mood } });
        }
    }, [isReady, body, mood]);

    // Local exercise on this device is credited to the member using it
    const meId = me?.id;
    useEffect(() => {
        setExerciseActor(meId);
    }, [meId]);

    // Body changes per penguin (only towards a fuller shape are celebrated)
    useEffect(() => {
        if (!isReady) return;
        const store = readBubbyStore();
        const looks =
            penguins.length > 0
                ? penguins.map((p) => ({
                      id: p.member.id,
                      isMe: p.isMe,
                      body: p.body,
                      whose:
                          penguins.length > 1
                              ? p.isMe
                                  ? "Your"
                                  : `${p.member.display_name}'s`
                              : undefined,
                  }))
                : [{ id: "household", isMe: true, body, whose: undefined }];
        const last = store.lastBodies ?? {};
        const next: Record<string, string> = { ...last };
        for (const look of looks) {
            // The old shared Bubby carries on as yours; a partner's penguin
            // seen for the first time only records its look
            const before =
                last[look.id] ?? (look.isMe ? store.lastBody : undefined);
            if (before && before !== look.body && look.body !== "regular") {
                feedback.milestone("body-change", {
                    dedupeKey: `body:${look.id}:${look.body}:${today}`,
                    title: bodyTitle(look.body, look.whose),
                    primary: { label: "See Bubby", event: "bubby:open-sheet" },
                });
            }
            next[look.id] = look.body;
        }
        if (
            looks.some((l) => last[l.id] !== l.body) ||
            store.lastBody !== body
        ) {
            updateBubbyStore({ lastBodies: next, lastBody: body });
        }
    }, [isReady, penguins, body, today]);

    // Reunion: your penguin is happy again after a feed
    useEffect(() => {
        if (!isReady) return;
        const store = readBubbyStore();
        if (
            store.lastMood &&
            store.lastMood !== "normal" &&
            mood === "normal"
        ) {
            feedback.milestone("reunion", {
                dedupeKey: `reunion:${today}`,
                title: "Welcome back! 🐧",
            });
        }
        if (store.lastMood !== mood) updateBubbyStore({ lastMood: mood });
    }, [isReady, mood, today]);

    // Daily quests (per member): full belly
    const dailyDone = allDone(dailyQuests);
    useEffect(() => {
        if (!isReady || !dailyDone || !meId) return;
        feedback.milestone("full-belly", {
            dedupeKey: `full-belly:${today}:${meId}`,
            title: "Full belly! 🍤",
            subtitle: "All of today's quests",
        });
    }, [isReady, dailyDone, meId, today]);

    // Weekly quests (household): a snack treat for the collection
    const weeklyDone = allDone(weeklyQuests);
    useEffect(() => {
        if (!isReady || !weeklyQuestsReady || !weeklyDone) return;
        const week = mondayOf(today);
        const snack = snackForWeek(week);
        const result = feedback.milestone("weekly-treat", {
            dedupeKey: `treat:${week}`,
            title: `Treat: ${snackLabel(snack)}!`,
            subtitle: "Weekly quests done",
            primary: { label: "See Bubby", event: "bubby:open-sheet" },
        });
        if (result !== "duplicate") {
            addSnack({ id: snack, week });
            emitAppEvent("bubby:store-changed", {});
        }
    }, [isReady, weeklyQuestsReady, weeklyDone, today]);

    // Monthly quests (household): a one-off celebration, no collectible
    const monthlyDone = allDone(monthlyQuests);
    useEffect(() => {
        if (!isReady || !monthlyQuestsReady || !monthlyDone) return;
        const month = today.slice(0, 7);
        feedback.milestone("monthly-treat", {
            dedupeKey: `monthly-treat:${month}`,
            title: "Monthly treat! 🎉",
            subtitle: "This month's quests done",
            primary: { label: "See Bubby", event: "bubby:open-sheet" },
        });
    }, [isReady, monthlyQuestsReady, monthlyDone, today]);

    // Both partners fed Bubby today: a small cheer, once a day
    const bothFed =
        members.length >= 2 && members.every((m) => fedToday.has(m.id));
    useEffect(() => {
        if (!isReady || !bothFed) return;
        const key = `both-fed:${today}`;
        if (hasCelebrated(key)) return;
        markCelebrated(key);
        feedback.routine("acknowledge");
    }, [isReady, bothFed, today]);

    // Inbox: a soft cue per triage; inbox zero once per member per day, only
    // when triage this session takes pending from >0 to 0 (never on load)
    const meIdRef = useRef(meId ?? "me");
    useEffect(() => {
        meIdRef.current = meId ?? "me";
    }, [meId]);

    useEffect(() => {
        let triaged = 0;
        const syncPending = (count: number) => {
            setInboxPending(count);
            emitAppEvent("bubby:store-changed", {});
        };
        const celebrateInboxZero = (clearedCount: number, date: string) => {
            if (clearedCount <= 0) return;
            const result = feedback.milestone("inbox-zero", {
                dedupeKey: `inbox-zero:${date}:${meIdRef.current}`,
                title: "Inbox zero! 🎉",
                subtitle: `${clearedCount} sorted`,
            });
            if (result !== "duplicate") {
                addLocalExercise(
                    "inbox-clear",
                    date,
                    meIdRef.current === "me" ? null : meIdRef.current,
                );
                emitAppEvent("bubby:store-changed", {});
            }
            triaged = 0;
        };
        const onTriaged = (remaining: number) => {
            triaged += 1;
            syncPending(remaining);
            feedback.routine("triage");
            if (remaining === 0) celebrateInboxZero(triaged, toSgtDateString());
        };
        const offs = [
            onAppEvent("inbox:items-arrived", (d) =>
                syncPending(d.pendingCount),
            ),
            onAppEvent("inbox:item-confirmed", (d) => onTriaged(d.remaining)),
            onAppEvent("inbox:item-discarded", (d) => onTriaged(d.remaining)),
            onAppEvent("inbox:cleared", (d) => {
                syncPending(0);
                celebrateInboxZero(d.clearedCount, d.date || toSgtDateString());
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
                    setToasts((prev) =>
                        [...prev, { ...detail, id }].slice(-MAX_QUEUED_TOASTS),
                    );
                }
            }),
        [],
    );

    // Bubby sheet: one lazy instance, kept mounted after first open for the exit animation
    useEffect(
        () => onAppEvent("bubby:open-sheet", () => setSheetOpen(true)),
        [],
    );
    const closeSheet = useCallback(() => setSheetOpen(false), []);

    const clearBurst = useCallback(() => setBurstKey(0), []);
    const shiftToast = useCallback(
        () => setToasts((prev) => prev.slice(1)),
        [],
    );
    const acknowledge = useCallback(() => {
        feedback.routine("acknowledge");
        shiftToast();
    }, [shiftToast]);

    const current = toasts[0];

    return (
        <>
            {sheetOpen !== null && (
                <Suspense fallback={null}>
                    <BubbySheet isOpen={sheetOpen} onClose={closeSheet} />
                </Suspense>
            )}
            {burstKey > 0 && (
                <ConfettiBurst key={burstKey} onDone={clearBurst} />
            )}
            <AnimatePresence>
                {current && (
                    <MilestoneToast
                        key={current.id}
                        title={current.title ?? ""}
                        subtitle={current.subtitle}
                        body={body}
                        primaryLabel={current.primary?.label}
                        onPrimary={
                            current.primary?.event
                                ? () => {
                                      emitAppEvent("bubby:open-sheet", {});
                                      shiftToast();
                                  }
                                : undefined
                        }
                        onAcknowledge={acknowledge}
                        onTimeout={shiftToast}
                    />
                )}
            </AnimatePresence>
        </>
    );
}

export default DelightHost;
