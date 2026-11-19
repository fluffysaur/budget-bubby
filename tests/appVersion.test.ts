import { describe, it, expect } from "vitest";
import pkg from "../package.json";
import {
    APP_VERSION,
    GIT_SHA,
    formatAppVersion,
} from "../src/lib/appVersion";

describe("appVersion", () => {
    it("injects package.json version and git sha in build/test environment", () => {
        expect(APP_VERSION).toBe(pkg.version);
        expect(GIT_SHA).toBe("test");
    });

    it("formats version with short git sha", () => {
        expect(formatAppVersion("0.2.0", "a1b2c3d")).toBe("v0.2.0 (a1b2c3d)");
    });

    it("strips duplicate leading v and handles missing sha", () => {
        expect(formatAppVersion("v0.2.0")).toBe("v0.2.0");
        expect(formatAppVersion("0.2.0", "   ")).toBe("v0.2.0");
    });

    it("falls back to v0.0.0 when version is empty", () => {
        expect(formatAppVersion("", "abc1234")).toBe("v0.0.0 (abc1234)");
    });
});
