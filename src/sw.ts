/// <reference lib="webworker" />
/**
 * Budget Bubby service worker (vite-plugin-pwa injectManifest).
 *
 * - Precaches the app shell (including self-hosted woff2 fonts) and serves index.html for navigations.
 * - Supports the "update available" prompt (SKIP_WAITING message).
 * - Shows Web Push notifications sent by the send-reminders function, and
 *   opens the right screen when one is tapped.
 */

import {
    precacheAndRoute,
    cleanupOutdatedCaches,
    createHandlerBoundToURL,
} from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { withReadKeys, type PushMessage } from "./lib/reminders/pushMessage";

declare let self: ServiceWorkerGlobalScope;

const ICON = "/pwa-192x192.png";

// App shell ------------------------------------------------------------------
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// One-time cleanup of the Google Fonts runtime caches from before fonts were
// self-hosted; cleanupOutdatedCaches() only clears outdated precaches, not
// these named runtime caches, so already-installed PWAs would otherwise keep
// them forever.
self.addEventListener("activate", (event) => {
    event.waitUntil(
        Promise.all(
            ["google-fonts-cache", "gstatic-fonts-cache"].map((name) =>
                caches.delete(name),
            ),
        ),
    );
});

// Update prompt --------------------------------------------------------------
self.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SKIP_WAITING") {
        self.skipWaiting();
    }
});

// Push -----------------------------------------------------------------------
function parsePush(event: PushEvent): PushMessage | null {
    if (!event.data) return null;
    try {
        const data = event.data.json() as Partial<PushMessage>;
        if (!data.title) return null;
        return {
            title: data.title,
            body: data.body ?? "",
            tag: data.tag ?? data.title,
            url: data.url ?? "/",
            keys: Array.isArray(data.keys) ? data.keys : [],
        };
    } catch {
        return null;
    }
}

self.addEventListener("push", (event) => {
    const message = parsePush(event);
    if (!message) return;
    event.waitUntil(
        self.registration.showNotification(message.title, {
            body: message.body,
            tag: message.tag,
            icon: ICON,
            badge: ICON,
            data: { url: message.url, keys: message.keys },
        }),
    );
});

self.addEventListener("notificationclick", (event) => {
    event.notification.close();
    const data = (event.notification.data ?? {}) as {
        url?: string;
        keys?: string[];
    };
    // The app marks ?read= keys as read on load, then strips the param
    const target = new URL(
        withReadKeys(data.url ?? "/", data.keys ?? []),
        self.location.origin,
    ).href;

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({
                type: "window",
                includeUncontrolled: true,
            });
            for (const client of windows) {
                if (new URL(client.url).origin === self.location.origin) {
                    await client.focus();
                    await client.navigate(target);
                    return;
                }
            }
            await self.clients.openWindow(target);
        })(),
    );
});
