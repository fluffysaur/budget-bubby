/**
 * Browser side of server push: subscription sync, no in-app pushes when the
 * server sends them, and ?read= handling for tapped pushes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";

const MEMBER = "mem-00000000-0011";
// Any 65-byte P-256 public key shape works for the decoder
const VAPID_KEY =
    "BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U";

function mockNotificationPermission(permission: NotificationPermission) {
    Object.defineProperty(window, "Notification", {
        value: class MockNotification {
            static permission = permission;
            static requestPermission = vi.fn().mockResolvedValue(permission);
        },
        configurable: true,
        writable: true,
    });
}

describe("syncPushSubscription", () => {
    let subscribe: ReturnType<typeof vi.fn>;
    let unsubscribe: ReturnType<typeof vi.fn>;
    let existing: PushSubscription | null;
    let subscription: PushSubscription;

    beforeEach(() => {
        vi.resetModules();
        vi.stubEnv("VITE_VAPID_PUBLIC_KEY", VAPID_KEY);
        unsubscribe = vi.fn().mockResolvedValue(true);
        existing = null;
        subscription = {
            endpoint: "https://push.example/device-1",
            unsubscribe,
            toJSON: () => ({
                endpoint: "https://push.example/device-1",
                keys: { p256dh: "p256", auth: "authkey" },
            }),
        } as unknown as PushSubscription;
        subscribe = vi.fn().mockResolvedValue(subscription);
        Object.defineProperty(window, "PushManager", {
            value: class {},
            configurable: true,
        });
        Object.defineProperty(navigator, "serviceWorker", {
            value: {
                ready: Promise.resolve({
                    pushManager: {
                        getSubscription: vi.fn(async () => existing),
                        subscribe,
                    },
                }),
            },
            configurable: true,
        });
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    it("subscribes and saves the device when push is on and permitted", async () => {
        mockNotificationPermission("granted");
        const { financeService: service } =
            await import("../src/services/financeService");
        const save = vi
            .spyOn(service, "savePushSubscription")
            .mockResolvedValue();
        const { syncPushSubscription, isServerPushEnabled } =
            await import("../src/lib/pushSubscription");

        expect(isServerPushEnabled()).toBe(true);
        await syncPushSubscription(MEMBER, true);

        expect(subscribe).toHaveBeenCalledWith(
            expect.objectContaining({ userVisibleOnly: true }),
        );
        expect(save).toHaveBeenCalledWith(
            MEMBER,
            expect.objectContaining({
                endpoint: "https://push.example/device-1",
                p256dh: "p256",
                auth: "authkey",
            }),
        );
    });

    it("unsubscribes and deletes the device when push is turned off", async () => {
        mockNotificationPermission("granted");
        existing = subscription;
        const { financeService: service } =
            await import("../src/services/financeService");
        const remove = vi
            .spyOn(service, "deletePushSubscription")
            .mockResolvedValue();
        const save = vi
            .spyOn(service, "savePushSubscription")
            .mockResolvedValue();
        const { syncPushSubscription } =
            await import("../src/lib/pushSubscription");

        await syncPushSubscription(MEMBER, false);

        expect(remove).toHaveBeenCalledWith("https://push.example/device-1");
        expect(unsubscribe).toHaveBeenCalled();
        expect(save).not.toHaveBeenCalled();
    });

    it("does nothing without a VAPID key", async () => {
        vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "");
        mockNotificationPermission("granted");
        const { syncPushSubscription, isServerPushEnabled } =
            await import("../src/lib/pushSubscription");
        expect(isServerPushEnabled()).toBe(false);
        await syncPushSubscription(MEMBER, true);
        expect(subscribe).not.toHaveBeenCalled();
    });
});

describe("server push mode", () => {
    afterEach(() => {
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
        vi.doUnmock("../src/lib/pushSubscription");
    });

    it("does not send pushes from the app when the server sends them", async () => {
        vi.resetModules();
        vi.doMock("../src/lib/pushSubscription", () => ({
            isServerPushEnabled: () => true,
            syncPushSubscription: vi.fn(),
        }));
        mockNotificationPermission("granted");
        const showNotification = vi.fn().mockResolvedValue(undefined);
        Object.defineProperty(navigator, "serviceWorker", {
            value: {
                getRegistration: vi
                    .fn()
                    .mockResolvedValue({ showNotification }),
            },
            configurable: true,
        });
        localStorage.clear();

        const { evaluateAndDispatchReminders } =
            await import("../src/lib/notificationScheduler");
        const reminders = await evaluateAndDispatchReminders({
            memberId: MEMBER,
            currentHour: 19,
            referenceDate: new Date("2026-10-29T19:00:00"),
        });

        expect(reminders.length).toBeGreaterThan(0);
        expect(showNotification).not.toHaveBeenCalled();
    });
});

describe("tapped push ?read= handling", () => {
    it("marks the pushed keys read and strips the param", async () => {
        // Load providers, service and popover from one fresh module graph
        vi.resetModules();
        const { NotificationCenterPopover } =
            await import("../src/components/layout/NotificationCenterPopover");
        const { AuthProvider } = await import("../src/context/AuthContext");
        const { HouseholdProvider } =
            await import("../src/context/HouseholdContext");
        const { financeService } =
            await import("../src/services/financeService");
        const markRead = vi
            .spyOn(financeService, "markNotificationsRead")
            .mockResolvedValue();

        function LocationProbe() {
            const location = useLocation();
            return (
                <div data-testid="location">
                    {location.pathname + location.search}
                </div>
            );
        }

        render(
            <MemoryRouter initialEntries={["/budget?read=key-a%2Ckey-b"]}>
                <AuthProvider
                    initialAuthenticated={true}
                    initialPartner="yijia"
                >
                    <HouseholdProvider defaultPerspective="household">
                        <NotificationCenterPopover />
                        <LocationProbe />
                    </HouseholdProvider>
                </AuthProvider>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(markRead).toHaveBeenCalledWith(
                expect.any(String),
                expect.arrayContaining([
                    expect.objectContaining({ key: "key-a" }),
                    expect.objectContaining({ key: "key-b" }),
                ]),
            );
        });
        await waitFor(() => {
            expect(screen.getByTestId("location").textContent).toBe("/budget");
        });
        markRead.mockRestore();
    });
});
