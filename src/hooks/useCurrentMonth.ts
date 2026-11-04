import { useState, useSyncExternalStore } from "react";
import { getCurrentMonth, msUntilNextMonth } from "../lib/dateUtils";

// Re-check at least hourly so timers delayed by device sleep still catch up.
const MAX_CHECK_INTERVAL_MS = 60 * 60 * 1000;
// Fire just after the boundary so the clock reads the new month.
const BOUNDARY_SLACK_MS = 250;

function subscribe(onChange: () => void): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
        const delay = Math.min(
            msUntilNextMonth() + BOUNDARY_SLACK_MS,
            MAX_CHECK_INTERVAL_MS,
        );
        timer = setTimeout(() => {
            onChange();
            schedule();
        }, delay);
    };

    const handleVisibility = () => {
        if (document.visibilityState !== "hidden") onChange();
    };

    schedule();
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", onChange);

    return () => {
        clearTimeout(timer);
        document.removeEventListener("visibilitychange", handleVisibility);
        window.removeEventListener("focus", onChange);
    };
}

/**
 * Current month ('YYYY-MM', Singapore time) that stays correct while the app
 * is left open: updates at the month boundary and when the app regains focus.
 */
export function useCurrentMonth(): string {
    return useSyncExternalStore(subscribe, getCurrentMonth);
}

/**
 * Returns the live current month and, when it rolls over, moves a selection
 * that was on the old current month to the new one. A month the user picked
 * deliberately (anything else) is left alone.
 */
export function useFollowCurrentMonth(
    selectedMonth: string | undefined,
    setSelectedMonth: (month: string) => void,
): string {
    const currentMonth = useCurrentMonth();
    const [trackedMonth, setTrackedMonth] = useState(currentMonth);

    if (trackedMonth !== currentMonth) {
        setTrackedMonth(currentMonth);
        if (selectedMonth === trackedMonth) {
            setSelectedMonth(currentMonth);
        }
    }

    return currentMonth;
}
