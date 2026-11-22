import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const deletePushSubscription = vi.fn(async () => {});
const savePushSubscription = vi.fn(async () => {});

vi.mock("../../services/financeService", () => ({
    financeService: {
        deletePushSubscription: (...args: unknown[]) =>
            deletePushSubscription(...(args as [])),
        savePushSubscription: (...args: unknown[]) =>
            savePushSubscription(...(args as [])),
    },
}));

const ENDPOINT = "https://push.example.test/sub/abc";

function makeSubscription() {
    return {
        endpoint: ENDPOINT,
        unsubscribe: vi.fn(async () => true),
        toJSON: () => ({
            endpoint: ENDPOINT,
            keys: { p256dh: "p256dh-key", auth: "auth-key" },
        }),
    };
}

function installPushEnv(existing: ReturnType<typeof makeSubscription> | null) {
    const pushManager = {
        getSubscription: vi.fn(async () => existing),
        subscribe: vi.fn(async () => makeSubscription()),
    };
    Object.defineProperty(navigator, "serviceWorker", {
        configurable: true,
        value: { ready: Promise.resolve({ pushManager }) },
    });
    Object.defineProperty(window, "PushManager", {
        configurable: true,
        writable: true,
        value: function PushManager() {},
    });
    Object.defineProperty(window, "Notification", {
        configurable: true,
        writable: true,
        value: { permission: "default" },
    });
    return pushManager;
}

async function loadModule() {
    vi.resetModules();
    vi.stubEnv("VITE_VAPID_PUBLIC_KEY", "BEl62iUYgUivxIkv69yViEuiBIa");
    return import("../pushSubscription");
}

describe("syncPushSubscription", () => {
    beforeEach(() => {
        deletePushSubscription.mockClear();
        savePushSubscription.mockClear();
    });

    afterEach(() => {
        vi.unstubAllEnvs();
        Reflect.deleteProperty(navigator, "serviceWorker");
        Reflect.deleteProperty(window, "PushManager");
        Reflect.deleteProperty(window, "Notification");
    });

    it("keeps an existing subscription when permission reads default", async () => {
        const existing = makeSubscription();
        const pushManager = installPushEnv(existing);
        const { syncPushSubscription } = await loadModule();

        await syncPushSubscription("mem-1", true, "default");

        expect(deletePushSubscription).not.toHaveBeenCalled();
        expect(existing.unsubscribe).not.toHaveBeenCalled();
        expect(pushManager.subscribe).not.toHaveBeenCalled();
        expect(savePushSubscription).toHaveBeenCalledWith(
            "mem-1",
            expect.objectContaining({ endpoint: ENDPOINT }),
        );
    });

    it("does not subscribe a new device while permission reads default", async () => {
        const pushManager = installPushEnv(null);
        const { syncPushSubscription } = await loadModule();

        await syncPushSubscription("mem-1", true, "default");

        expect(pushManager.subscribe).not.toHaveBeenCalled();
        expect(savePushSubscription).not.toHaveBeenCalled();
    });

    it("removes the subscription when permission is denied", async () => {
        const existing = makeSubscription();
        installPushEnv(existing);
        const { syncPushSubscription } = await loadModule();

        await syncPushSubscription("mem-1", true, "denied");

        expect(deletePushSubscription).toHaveBeenCalledWith(ENDPOINT);
        expect(existing.unsubscribe).toHaveBeenCalled();
        expect(savePushSubscription).not.toHaveBeenCalled();
    });

    it("removes the subscription when push is turned off", async () => {
        const existing = makeSubscription();
        installPushEnv(existing);
        const { syncPushSubscription } = await loadModule();

        await syncPushSubscription("mem-1", false, "granted");

        expect(deletePushSubscription).toHaveBeenCalledWith(ENDPOINT);
        expect(existing.unsubscribe).toHaveBeenCalled();
    });

    it("subscribes and saves when permission is granted", async () => {
        const pushManager = installPushEnv(null);
        const { syncPushSubscription } = await loadModule();

        await syncPushSubscription("mem-1", true, "granted");

        expect(pushManager.subscribe).toHaveBeenCalled();
        expect(savePushSubscription).toHaveBeenCalled();
    });

    it("reports this device's subscription status", async () => {
        installPushEnv(makeSubscription());
        const { getDevicePushStatus } = await loadModule();
        await expect(getDevicePushStatus()).resolves.toBe("subscribed");
    });
});
