import { describe, expect, it } from "vitest";
import { getMemberSignInEmails } from "../src/lib/memberSignIn";

describe("getMemberSignInEmails", () => {
    it("reads the comma-separated member list in order", () => {
        expect(
            getMemberSignInEmails({
                VITE_MEMBER_EMAILS: " one@example.org, two@example.org ",
            }),
        ).toEqual(["one@example.org", "two@example.org"]);
    });

    it("drops duplicates and blanks", () => {
        expect(
            getMemberSignInEmails({
                VITE_MEMBER_EMAILS:
                    "one@example.org,,ONE@example.org two@example.org",
            }),
        ).toEqual(["one@example.org", "two@example.org"]);
    });

    it("prefers the list over the per-member vars", () => {
        expect(
            getMemberSignInEmails({
                VITE_MEMBER_EMAILS: "one@example.org",
                VITE_PARTNER1_EMAIL: "two@example.org",
            }),
        ).toEqual(["one@example.org"]);
    });

    it("falls back to the per-member vars in the old order", () => {
        expect(
            getMemberSignInEmails({
                VITE_PARTNER2_EMAIL: "two@example.org",
                VITE_PARTNER1_EMAIL: " one@example.org ",
            }),
        ).toEqual(["one@example.org", "two@example.org"]);
    });

    it("dedupes the per-member vars case-insensitively", () => {
        expect(
            getMemberSignInEmails({
                VITE_PARTNER1_EMAIL: "one@example.org",
                VITE_PARTNER2_EMAIL: "ONE@example.org",
            }),
        ).toEqual(["one@example.org"]);
    });

    it("never tries an unrelated email var", () => {
        expect(
            getMemberSignInEmails({
                VITE_SUPPORT_EMAIL: "support@example.org",
                VITE_PARTNER1_EMAIL: "one@example.org",
            }),
        ).toEqual(["one@example.org"]);
        expect(
            getMemberSignInEmails({
                VITE_SUPPORT_EMAIL: "support@example.org",
            }),
        ).toEqual([]);
    });

    it("is empty when nothing is configured", () => {
        expect(getMemberSignInEmails({})).toEqual([]);
        expect(getMemberSignInEmails({ VITE_MEMBER_EMAILS: "  " })).toEqual([]);
    });
});
