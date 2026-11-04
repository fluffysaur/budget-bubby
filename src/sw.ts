/// <reference lib="webworker" />
/**
 * Budget Bubby service worker (vite-plugin-pwa injectManifest).
 *
 * - Precaches the app shell and serves index.html for navigations.
 * - Caches Google Fonts.
 * - Supports the "update available" prompt (SKIP_WAITING message).
 * - Shows Web Push notifications sent by the send-reminders function, and
 *   opens the right screen when one is tapped.
 */

import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { withReadKeys, type PushMessage } from "./lib/reminders/pushMessage";

declare let self: ServiceWorkerGlobalScope;

const ICON = "/pwa-192x192.png";
const YEAR_SECONDS = 60 * 60 * 24 * 365;

// App shell ------------------------------------------------------------------
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

// Google Fonts ---------------------------------------------------------------
registerRoute(
    ({ url }) => url.origin === "https://fonts.googleapis.com",
    new CacheFirst({
        cacheName: "google-fonts-cache",
        plugins: [
            new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: YEAR_SECONDS }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    }),
);
registerRoute(
    ({ url }) => url.origin === "https://fonts.gstatic.com",
    new CacheFirst({
        cacheName: "gstatic-fonts-cache",
        plugins: [
            new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: YEAR_SECONDS }),
            new CacheableResponsePlugin({ statuses: [0, 200] }),
        ],
    }),
);

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
    const data = (event.notification.data ?? {}) as { url?: string; keys?: string[] };
    // The app marks ?read= keys as read on load, then strips the param
    const target = new URL(withReadKeys(data.url ?? "/", data.keys ?? []), self.location.origin).href;

    event.waitUntil(
        (async () => {
            const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
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
