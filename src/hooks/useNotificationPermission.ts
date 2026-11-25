/**
 * Live notification permission for this device.
 *
 * Reads the permission on mount, again whenever the app regains focus or
 * becomes visible, and through the Permissions API change event where
 * supported. Installed Android PWAs can report a stale "default" from
 * Notification.permission while the Permissions API already says
 * "granted", so a definite Permissions API answer wins over "default".
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { requestNotificationPermission } from "../lib/notificationScheduler";

export type NotificationPermissionState =
    | NotificationPermission
    | "unsupported";

type QueriedState = PermissionState | null;

function readPermission(queried: QueriedState): NotificationPermissionState {
    if (typeof window === "undefined" || !("Notification" in window)) {
        return "unsupported";
    }
    const direct = Notification.permission;
    if (
        direct === "default" &&
        (queried === "granted" || queried === "denied")
    ) {
        return queried;
    }
    return direct;
}

export interface UseNotificationPermissionResult {
    permission: NotificationPermissionState;
    /** True after a request resolved "default" or stalled without granting: the user must allow it in browser or system settings. */
    needsSystemSettings: boolean;
    /** True while waiting for the browser's permission prompt to resolve (up to the stall timeout). */
    isRequesting: boolean;
    request: () => Promise<NotificationPermissionState>;
    refresh: () => void;
}

const PERMISSION_REQUEST_TIMEOUT_MS = 2500;

export function useNotificationPermission(): UseNotificationPermissionResult {
    const queriedRef = useRef<QueriedState>(null);
    const mountedRef = useRef<boolean>(true);
    const [permission, setPermission] = useState<NotificationPermissionState>(
        () => readPermission(null),
    );
    const [needsSystemSettings, setNeedsSystemSettings] =
        useState<boolean>(false);
    const [isRequesting, setIsRequesting] = useState<boolean>(false);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const refresh = useCallback(() => {
        const next = readPermission(queriedRef.current);
        setPermission(next);
        if (next !== "default") setNeedsSystemSettings(false);
    }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        let cancelled = false;
        let status: PermissionStatus | null = null;

        const handleVisibility = () => {
            if (document.visibilityState === "visible") refresh();
        };
        const handleChange = () => {
            if (status) queriedRef.current = status.state;
            refresh();
        };

        refresh();
        window.addEventListener("focus", refresh);
        document.addEventListener("visibilitychange", handleVisibility);

        const permissions =
            typeof navigator !== "undefined"
                ? navigator.permissions
                : undefined;
        if (permissions?.query) {
            permissions
                .query({ name: "notifications" as PermissionName })
                .then((result) => {
                    if (cancelled) return;
                    status = result;
                    queriedRef.current = result.state;
                    result.onchange = handleChange;
                    refresh();
                })
                .catch(() => {
                    // Permissions API without notifications support: rely on focus/visibility reads
                });
        }

        return () => {
            cancelled = true;
            window.removeEventListener("focus", refresh);
            document.removeEventListener("visibilitychange", handleVisibility);
            if (status) status.onchange = null;
        };
    }, [refresh]);

    const request = useCallback(async () => {
        if (readPermission(queriedRef.current) === "unsupported") {
            return "unsupported" as const;
        }
        setIsRequesting(true);
        let timerId: ReturnType<typeof setTimeout> | undefined;
        let settled = false;

        const permissionPromise = requestNotificationPermission().then(
            (result) => {
                settled = true;
                if (timerId !== undefined) clearTimeout(timerId);
                const next =
                    result === "default"
                        ? readPermission(queriedRef.current)
                        : result;
                if (mountedRef.current) {
                    setPermission(next);
                    setNeedsSystemSettings(next === "default");
                    setIsRequesting(false);
                }
                return next;
            },
        );

        const timeoutPromise = new Promise<NotificationPermissionState>(
            (resolve) => {
                timerId = setTimeout(() => {
                    if (settled) return;
                    const current = readPermission(queriedRef.current);
                    if (mountedRef.current) {
                        setPermission(current);
                        setNeedsSystemSettings(current === "default");
                        setIsRequesting(false);
                    }
                    resolve(current);
                }, PERMISSION_REQUEST_TIMEOUT_MS);
            },
        );

        return Promise.race([permissionPromise, timeoutPromise]);
    }, []);

    return {
        permission,
        needsSystemSettings,
        isRequesting,
        request,
        refresh,
    };
}
