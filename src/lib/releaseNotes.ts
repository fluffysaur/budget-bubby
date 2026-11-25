/**
 * "What's new" logic: which hand-written release notes a device still has
 * to see, and remembering what it has seen (per device, `bb_whats_new_v1`).
 *
 * Content lives in `src/data/releaseNotes.ts`.
 */

import type { LucideIcon } from "lucide-react";
import { APP_VERSION } from "./appVersion";

export const WHATS_NEW_STORAGE_KEY = "bb_whats_new_v1";

/**
 * Releases from this version on must have a `RELEASE_NOTES` entry
 * (enforced by a unit test). Older releases have no notes.
 */
export const FIRST_NOTED_VERSION = "0.6.0";

export type ReleaseNoteTag = "new" | "better" | "fixed";

export interface ReleaseNoteItem {
    icon: LucideIcon;
    tag: ReleaseNoteTag;
    /** One friendly sentence. */
    text: string;
    /** Optional in-app route for a "Try it" link. */
    to?: string;
}

export interface ReleaseNote {
    /** SemVer, e.g. "0.6.0". */
    version: string;
    /** ISO date, e.g. "2026-11-25". */
    date: string;
    /** Optional 2-3 word headline. */
    headline?: string;
    /** Empty = silent release: no popup, hidden from history. */
    items: ReleaseNoteItem[];
}

/** Compares two `x.y.z` versions. Returns <0, 0 or >0. Ignores a leading `v` and prerelease tags. */
export function compareVersions(a: string, b: string): number {
    const parse = (v: string) =>
        v
            .trim()
            .replace(/^v/, "")
            .split("-")[0]
            .split(".")
            .map((part) => Number.parseInt(part, 10) || 0);
    const pa = parse(a);
    const pb = parse(b);
    for (let i = 0; i < 3; i++) {
        const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (diff !== 0) return diff;
    }
    return 0;
}

/** Notes with items, newest first. */
export function getVisibleReleaseNotes(notes: ReleaseNote[]): ReleaseNote[] {
    return notes
        .filter((note) => note.items.length > 0)
        .sort((a, b) => compareVersions(b.version, a.version));
}

/**
 * Notes this device has not seen yet, newest first.
 * - Nothing stored (fresh device): the latest note only.
 * - Otherwise: every note newer than the stored version.
 */
export function getUnseenReleaseNotes(
    notes: ReleaseNote[],
    lastSeen: string | null,
): ReleaseNote[] {
    const visible = getVisibleReleaseNotes(notes);
    if (!lastSeen) return visible.slice(0, 1);
    return visible.filter(
        (note) => compareVersions(note.version, lastSeen) > 0,
    );
}

/** The version to store once notes are seen: the newest of the app and the notes. */
export function getSeenMarker(
    notes: ReleaseNote[],
    appVersion: string = APP_VERSION,
): string {
    return notes.reduce(
        (max, note) =>
            compareVersions(note.version, max) > 0 ? note.version : max,
        appVersion,
    );
}

export function readLastSeenVersion(): string | null {
    try {
        const value = window.localStorage.getItem(WHATS_NEW_STORAGE_KEY);
        return value && value.trim() ? value.trim() : null;
    } catch {
        return null;
    }
}

export function writeLastSeenVersion(version: string): void {
    try {
        window.localStorage.setItem(WHATS_NEW_STORAGE_KEY, version);
    } catch {
        // Best-effort: storage may be blocked (private mode)
    }
}
