import { useEffect } from "react";
import { useInboxSummary } from "./useInboxQueries";
import { noteInboxCount } from "../lib/inbox/inboxEvents";

type BadgeNavigator = Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
};

/**
 * Household inbox count for the nav badges. Also keeps the app icon badge
 * in sync (iOS 16.4+ Home Screen apps, Android Chrome) and emits
 * inbox:items-arrived when the count rises. 0 before the migration.
 */
export function useInboxBadge(): number {
    const { data } = useInboxSummary();
    const available = data?.available ?? false;
    const count = available ? (data?.pendingCount ?? 0) : 0;

    useEffect(() => {
        if (!available) return;
        noteInboxCount(count);
        const nav = (
            typeof navigator !== "undefined" ? navigator : undefined
        ) as BadgeNavigator | undefined;
        try {
            if (count > 0) void nav?.setAppBadge?.(count)?.catch(() => {});
            else void nav?.clearAppBadge?.()?.catch(() => {});
        } catch {
            // Badging not supported
        }
    }, [available, count]);

    return count;
}

/** "9+" style label for small badges. */
export function formatBadgeCount(count: number): string {
    return count > 9 ? "9+" : String(count);
}
