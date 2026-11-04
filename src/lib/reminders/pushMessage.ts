/**
 * Push payload shared by the send-reminders function and the service worker.
 * No imports, so the service worker bundle stays small.
 */

/** Payload sent to the service worker for one push. */
export interface PushMessage {
    title: string;
    body: string;
    tag: string;
    /** App path to open when tapped. */
    url: string;
    /** Reminder keys this push covers; marked read when tapped. */
    keys: string[];
}

/** Appends the reminder keys a tapped push covers as `?read=`. */
export function withReadKeys(url: string, keys: string[]): string {
    if (keys.length === 0) return url;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}read=${encodeURIComponent(keys.join(","))}`;
}
