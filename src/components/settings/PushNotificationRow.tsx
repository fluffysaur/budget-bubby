/**
 * Push master row: toggle, permission badge, this-device status and the
 * Enable / Test actions, stacked so nothing squeezes on narrow phones.
 */

import { useState, useEffect } from "react";
import { Bell, Send } from "lucide-react";
import { useNotificationPermission } from "../../hooks/useNotificationPermission";
import {
    getDevicePushStatus,
    type DevicePushStatus,
} from "../../lib/pushSubscription";
import { dispatchPWANotification } from "../../lib/notificationScheduler";
import { Alert } from "../ui/Alert";
import { Badge, type BadgeVariant } from "../ui/Badge";
import { Button } from "../ui/Button";
import { SettingsSwitch } from "./SettingsSwitch";

const DEVICE_PUSH_LABELS: Record<DevicePushStatus, string> = {
    subscribed: "Subscribed",
    not_subscribed: "Not subscribed",
    unsupported: "Push unsupported",
    app_only: "App alerts only",
};

const PERMISSION_VARIANTS: Record<string, BadgeVariant> = {
    granted: "mint",
    denied: "coral",
    default: "butter",
};

export interface PushNotificationRowProps {
    pushEnabled: boolean;
    onToggle: (next: boolean) => void;
}

export function PushNotificationRow({
    pushEnabled,
    onToggle,
}: PushNotificationRowProps) {
    const {
        permission,
        needsSystemSettings,
        isRequesting,
        refresh: refreshPermission,
        request: requestPermission,
    } = useNotificationPermission();
    const [devicePushStatus, setDevicePushStatus] =
        useState<DevicePushStatus | null>(null);
    const [testPushSent, setTestPushSent] = useState<boolean>(false);

    // Re-read permission and this device's subscription on mount and on change
    useEffect(() => {
        refreshPermission();
        let cancelled = false;
        getDevicePushStatus().then((status) => {
            if (!cancelled) setDevicePushStatus(status);
        });
        return () => {
            cancelled = true;
        };
    }, [permission, pushEnabled, refreshPermission]);

    const handleTestPush = async () => {
        let currentPerm = permission;
        if (currentPerm !== "granted") {
            currentPerm = await requestPermission();
        }
        if (currentPerm === "granted") {
            const success = await dispatchPWANotification(
                "Budget Bubby Test Notification 🔔",
                {
                    body: "Notifications are working smoothly on your device! ✨",
                    tag: "test-notification",
                },
            );
            if (success) {
                setTestPushSent(true);
                setTimeout(() => setTestPushSent(false), 3000);
            }
        }
    };

    const showEnable = permission === "default" && !needsSystemSettings;
    const showTest = permission === "granted";

    return (
        <div>
            <div className="space-y-2 rounded-2xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 shadow-cute-sm">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint) text-(--accent-mint-ink) shadow-cute-sm">
                        <Bell className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <span className="min-w-0 flex-1 text-xs font-bold text-(--text-ink)">
                        Push Notifications
                    </span>
                    <SettingsSwitch
                        checked={pushEnabled}
                        onChange={(next) => {
                            if (next && permission === "default") {
                                void requestPermission();
                            }
                            onToggle(next);
                        }}
                        label="Toggle push notifications"
                        testId="toggle-push-enabled"
                        onClassName="bg-(--pastel-mint)"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <Badge
                        variant={PERMISSION_VARIANTS[permission] ?? "butter"}
                        size="sm"
                        className="shrink-0 uppercase"
                    >
                        {permission}
                    </Badge>
                    <p
                        data-testid="device-push-status"
                        className="min-w-0 text-[11px] font-medium text-(--text-muted)"
                    >
                        {devicePushStatus
                            ? `This device: ${DEVICE_PUSH_LABELS[devicePushStatus]}`
                            : "System alerts on this device"}
                    </p>
                </div>

                {showEnable && (
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        data-testid="settings-enable-push-btn"
                        disabled={isRequesting}
                        onClick={() => {
                            void requestPermission();
                        }}
                    >
                        {isRequesting ? "Enabling..." : "Enable"}
                    </Button>
                )}

                {showTest && (
                    <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        data-testid="settings-test-push-btn"
                        onClick={handleTestPush}
                        title="Send test push notification"
                        leftIcon={
                            <Send className="h-3 w-3" strokeWidth={2.5} />
                        }
                    >
                        {testPushSent ? "Sent!" : "Test"}
                    </Button>
                )}
            </div>

            {(needsSystemSettings || permission === "denied") && (
                <div
                    className="mt-2.5"
                    data-testid="settings-push-permission-hint"
                >
                    <Alert variant="warning">
                        {permission === "denied"
                            ? "Alerts are blocked on this device. Allow notifications in browser or system settings, then reopen."
                            : "No prompt appeared? Allow notifications in your browser's site settings (or open in a browser tab), then reopen."}
                    </Alert>
                </div>
            )}
        </div>
    );
}
