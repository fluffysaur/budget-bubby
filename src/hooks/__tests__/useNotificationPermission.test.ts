import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useNotificationPermission } from "../useNotificationPermission";

type Perm = NotificationPermission;

function installNotification(initial: Perm, requestResult?: Perm) {
    const mock = {
        permission: initial,
        requestPermission: vi.fn(async () => requestResult ?? mock.permission),
    };
    Object.defineProperty(window, "Notification", {
        configurable: true,
        writable: true,
        value: mock,
    });
    return mock;
}

function installPermissionsApi(state: PermissionState) {
    const status = {
        state,
        onchange: null as null | (() => void),
    };
    Object.defineProperty(navigator, "permissions", {
        configurable: true,
        value: { query: vi.fn(async () => status) },
    });
    return status;
}

describe("useNotificationPermission", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    afterEach(() => {
        Reflect.deleteProperty(window, "Notification");
        Reflect.deleteProperty(navigator, "permissions");
    });

    it("reports unsupported when the Notification API is missing", () => {
        Reflect.deleteProperty(window, "Notification");
        const { result } = renderHook(() => useNotificationPermission());
        expect(result.current.permission).toBe("unsupported");
    });

    it("picks up a permission change after mount on focus and visibilitychange", () => {
        const notif = installNotification("default");
        const { result } = renderHook(() => useNotificationPermission());
        expect(result.current.permission).toBe("default");

        notif.permission = "granted";
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(result.current.permission).toBe("granted");

        notif.permission = "denied";
        act(() => {
            document.dispatchEvent(new Event("visibilitychange"));
        });
        expect(result.current.permission).toBe("denied");
    });

    it("prefers a definite Permissions API state over a stale default and follows onchange", async () => {
        installNotification("default");
        const status = installPermissionsApi("prompt");
        const { result } = renderHook(() => useNotificationPermission());
        await waitFor(() => expect(status.onchange).toBeTypeOf("function"));
        expect(result.current.permission).toBe("default");

        status.state = "granted";
        act(() => {
            status.onchange?.();
        });
        expect(result.current.permission).toBe("granted");
    });

    it("flags system settings when requestPermission resolves default", async () => {
        installNotification("default", "default");
        const { result } = renderHook(() => useNotificationPermission());

        await act(async () => {
            await result.current.request();
        });
        expect(result.current.permission).toBe("default");
        expect(result.current.needsSystemSettings).toBe(true);
    });

    it("clears the system settings hint once granted", async () => {
        const notif = installNotification("default", "default");
        const { result } = renderHook(() => useNotificationPermission());
        await act(async () => {
            await result.current.request();
        });
        expect(result.current.needsSystemSettings).toBe(true);

        notif.permission = "granted";
        act(() => {
            window.dispatchEvent(new Event("focus"));
        });
        expect(result.current.permission).toBe("granted");
        expect(result.current.needsSystemSettings).toBe(false);
    });

    it("surfaces needsSystemSettings when requestPermission stalls, and still accepts a late grant", async () => {
        vi.useFakeTimers();
        try {
            let resolveLate!: (perm: NotificationPermission) => void;
            const pending = new Promise<NotificationPermission>((resolve) => {
                resolveLate = resolve;
            });
            const mock = {
                permission: "default" as NotificationPermission,
                requestPermission: vi.fn(() => pending),
            };
            Object.defineProperty(window, "Notification", {
                configurable: true,
                writable: true,
                value: mock,
            });

            const { result } = renderHook(() => useNotificationPermission());

            let reqPromise!: Promise<unknown>;
            act(() => {
                reqPromise = result.current.request();
            });
            expect(result.current.isRequesting).toBe(true);

            await act(async () => {
                vi.advanceTimersByTime(2500);
                await reqPromise;
            });

            expect(result.current.isRequesting).toBe(false);
            expect(result.current.permission).toBe("default");
            expect(result.current.needsSystemSettings).toBe(true);

            // A slow user who taps Allow after the timeout still grants it
            mock.permission = "granted";
            await act(async () => {
                resolveLate("granted");
                await pending;
            });

            expect(result.current.permission).toBe("granted");
            expect(result.current.needsSystemSettings).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });
});
