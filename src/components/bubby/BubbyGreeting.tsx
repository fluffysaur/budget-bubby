/**
 * App-open moment: a short speech bubble next to the Home header.
 * Renders with the page (never before it): after the first data paint,
 * on an idle callback, the header Bubby waves and the bubble shows for
 * 2.5s. At most once per 4h, skipped when a milestone took the slot, and
 * cancelled by the first tap anywhere so the user's interaction wins.
 */

import { useEffect, useRef, useState } from "react";
import { useBubby } from "../../hooks/useBubby";
import { emitAppEvent } from "../../lib/appEvents";
import { feedback } from "../../lib/delight/feedback";
import { getInboxPending } from "../../lib/delight/inboxState";
import { readBubbyStore, updateBubbyStore } from "../../lib/bubby/storage";
import {
    GREETING_COOLDOWN_MS,
    GREETING_VISIBLE_MS,
    pickGreeting,
    type GreetingInputs,
    type GreetingLine,
} from "../../lib/bubby/greeting";

const FADE_MS = 150;

function scheduleIdle(cb: () => void): () => void {
    const w = window as Window & {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        cancelIdleCallback?: (id: number) => void;
    };
    if (typeof w.requestIdleCallback === "function") {
        const id = w.requestIdleCallback(cb, { timeout: 600 });
        return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(cb, 150);
    return () => window.clearTimeout(id);
}

export interface BubbyGreetingProps {
    /** Opens the inbox (for the "3 to sort" line). */
    onOpenInbox?: () => void;
}

export function BubbyGreeting({ onOpenInbox }: BubbyGreetingProps) {
    const { isReady, mood, condition, me, members, minutes, checkinMinutes } = useBubby();
    const [line, setLine] = useState<GreetingLine | null>(null);
    const [leaving, setLeaving] = useState(false);
    const [wake, setWake] = useState(0);
    const bubbleRef = useRef<HTMLButtonElement>(null);
    const inputsRef = useRef<Omit<GreetingInputs, "inboxPending"> | null>(null);

    useEffect(() => {
        inputsRef.current = {
            mood,
            loggedToday: Boolean(me && condition.fedToday.has(me.id)),
            bothFedToday: members.length >= 2 && members.every((m) => condition.fedToday.has(m.id)),
            minutes,
            checkinMinutes,
        };
    });

    // Resuming after ≥4h away greets again
    useEffect(() => {
        const onVisible = () => {
            if (document.visibilityState === "visible") setWake((w) => w + 1);
        };
        document.addEventListener("visibilitychange", onVisible);
        return () => document.removeEventListener("visibilitychange", onVisible);
    }, []);

    useEffect(() => {
        if (!isReady) return;
        const last = readBubbyStore().lastGreetingAt ?? 0;
        if (Date.now() - last < GREETING_COOLDOWN_MS) return;

        let cancelled = false;
        let hideTimer: number | undefined;
        let removeTimer: number | undefined;

        const cancel = (e: Event) => {
            if (bubbleRef.current && e.target instanceof Node && bubbleRef.current.contains(e.target)) {
                return;
            }
            cancelled = true;
            setLine(null);
        };
        window.addEventListener("pointerdown", cancel, true);

        const cancelIdle = scheduleIdle(() => {
            if (cancelled || !inputsRef.current) return;
            updateBubbyStore({ lastGreetingAt: Date.now() });
            // A stage-up or other milestone takes the slot instead
            if (feedback.hadRecentMilestone(3000)) return;
            setLeaving(false);
            setLine(pickGreeting({ ...inputsRef.current, inboxPending: getInboxPending() }));
            emitAppEvent("bubby:react", { kind: "wave" });
            hideTimer = window.setTimeout(() => {
                setLeaving(true);
                removeTimer = window.setTimeout(() => setLine(null), FADE_MS);
            }, GREETING_VISIBLE_MS);
        });

        return () => {
            cancelIdle();
            window.removeEventListener("pointerdown", cancel, true);
            window.clearTimeout(hideTimer);
            window.clearTimeout(removeTimer);
        };
    }, [isReady, wake]);

    if (!line) return null;

    return (
        <button
            ref={bubbleRef}
            type="button"
            data-testid="bubby-greeting"
            onClick={() => {
                setLine(null);
                if (line.action === "inbox" && onOpenInbox) onOpenInbox();
                else emitAppEvent("bubby:open-sheet", {});
            }}
            className={`relative ml-1 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) px-2.5 py-1 text-xs font-black text-(--text-ink) shadow-(--shadow-cute-sm) animate-toast-in transition-opacity duration-150 motion-reduce:transition-none cursor-pointer ${
                leaving ? "opacity-0" : "opacity-100"
            }`}
        >
            <span
                aria-hidden="true"
                className="absolute -left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rotate-45 border-b-2 border-l-2 border-(--border-ink) bg-(--bg-card)"
            />
            {line.text}
        </button>
    );
}

export default BubbyGreeting;
