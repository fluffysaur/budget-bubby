import { afterEach, describe, expect, it, vi } from "vitest";
import {
    emailsMatch,
    getPartnerEmail,
    isPartnerId,
    partnerFromEmail,
} from "../src/lib/partners";

afterEach(() => {
    vi.unstubAllEnvs();
});

describe("partners", () => {
    it("recognises only the neutral partner slots", () => {
        expect(isPartnerId("partner1")).toBe(true);
        expect(isPartnerId("partner2")).toBe(true);
        expect(isPartnerId("household")).toBe(false);
        expect(isPartnerId("alex")).toBe(false);
    });

    it("falls back to the demo seed emails when nothing is configured", () => {
        vi.stubEnv("VITE_PARTNER1_EMAIL", "");
        vi.stubEnv("VITE_PARTNER2_EMAIL", "");
        expect(getPartnerEmail("partner1")).toBe("alex@example.com");
        expect(getPartnerEmail("partner2")).toBe("sam@example.com");
    });

    it("reads the neutral env var first", () => {
        vi.stubEnv("VITE_PARTNER1_EMAIL", " one@example.org ");
        expect(getPartnerEmail("partner1")).toBe("one@example.org");
    });

    it("resolves a partner from a sign-in email, ignoring case and spaces", () => {
        vi.stubEnv("VITE_PARTNER1_EMAIL", "one@example.org");
        vi.stubEnv("VITE_PARTNER2_EMAIL", "two@example.org");
        expect(partnerFromEmail(" TWO@example.org")).toBe("partner2");
        expect(partnerFromEmail("one@example.org")).toBe("partner1");
        expect(partnerFromEmail("stranger@example.org")).toBeNull();
        expect(partnerFromEmail(null)).toBeNull();
    });

    it("never treats empty emails as a match", () => {
        expect(emailsMatch("", "")).toBe(false);
        expect(emailsMatch(null, undefined)).toBe(false);
        expect(emailsMatch("A@x.com", "a@x.com")).toBe(true);
    });
});
