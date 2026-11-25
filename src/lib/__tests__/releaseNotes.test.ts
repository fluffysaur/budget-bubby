import { describe, it, expect, beforeEach } from "vitest";
import { Sparkles } from "lucide-react";
import {
    FIRST_NOTED_VERSION,
    WHATS_NEW_STORAGE_KEY,
    compareVersions,
    getSeenMarker,
    getUnseenReleaseNotes,
    getVisibleReleaseNotes,
    readLastSeenVersion,
    writeLastSeenVersion,
    type ReleaseNote,
} from "../releaseNotes";
import { RELEASE_NOTES } from "../../data/releaseNotes";
import pkg from "../../../package.json";

const item = { icon: Sparkles, tag: "new" as const, text: "Hi" };
const notes: ReleaseNote[] = [
    { version: "0.6.0", date: "2026-11-25", items: [item] },
    { version: "0.8.0", date: "2026-12-10", items: [item] },
    { version: "0.7.0", date: "2026-12-01", items: [] },
];

describe("compareVersions", () => {
    it("orders by major, minor, patch numerically", () => {
        expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
        expect(compareVersions("1.0.0", "0.99.99")).toBeGreaterThan(0);
        expect(compareVersions("0.6.1", "0.6.2")).toBeLessThan(0);
        expect(compareVersions("v0.6.0", "0.6.0")).toBe(0);
    });
});

describe("getUnseenReleaseNotes", () => {
    it("shows only the latest note with items on a fresh device", () => {
        expect(
            getUnseenReleaseNotes(notes, null).map((n) => n.version),
        ).toEqual(["0.8.0"]);
    });

    it("groups every unseen note newest first and skips silent releases", () => {
        expect(
            getUnseenReleaseNotes(notes, "0.5.1").map((n) => n.version),
        ).toEqual(["0.8.0", "0.6.0"]);
    });

    it("shows nothing once the latest version is seen or after a rollback", () => {
        expect(getUnseenReleaseNotes(notes, "0.8.0")).toEqual([]);
        expect(getUnseenReleaseNotes(notes, "0.9.0")).toEqual([]);
    });
});

describe("getSeenMarker", () => {
    it("uses the newest of the app version and the notes", () => {
        expect(getSeenMarker(notes, "0.5.1")).toBe("0.8.0");
        expect(getSeenMarker(notes, "0.9.0")).toBe("0.9.0");
    });
});

describe("last seen storage", () => {
    beforeEach(() => localStorage.removeItem(WHATS_NEW_STORAGE_KEY));

    it("round-trips the last seen version", () => {
        expect(readLastSeenVersion()).toBeNull();
        writeLastSeenVersion("0.6.0");
        expect(readLastSeenVersion()).toBe("0.6.0");
    });
});

describe("RELEASE_NOTES content", () => {
    it("has an entry for the current package.json version", () => {
        if (compareVersions(pkg.version, FIRST_NOTED_VERSION) < 0) return;
        const versions = RELEASE_NOTES.map((n) => n.version);
        expect(
            versions,
            `Add a RELEASE_NOTES entry for ${pkg.version} in src/data/releaseNotes.ts (use items: [] for a silent release)`,
        ).toContain(pkg.version);
    });

    it("is unique, newest first, dated and written in short lines", () => {
        const versions = RELEASE_NOTES.map((n) => n.version);
        expect(new Set(versions).size).toBe(versions.length);
        expect(getVisibleReleaseNotes(RELEASE_NOTES).map((n) => n.version))
            .toEqual(versions.filter((v) =>
                RELEASE_NOTES.find((n) => n.version === v)!.items.length,
            ));
        for (const note of RELEASE_NOTES) {
            expect(note.version).toMatch(/^\d+\.\d+\.\d+$/);
            expect(note.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            for (const entry of note.items) {
                expect(entry.text.length).toBeGreaterThan(0);
                expect(entry.text.length).toBeLessThanOrEqual(120);
                if (entry.to) expect(entry.to.startsWith("/")).toBe(true);
            }
        }
    });
});
