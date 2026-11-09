import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    getBankDeepLink,
    openBankApp,
} from "../src/lib/bankDeepLinks";

describe("bankDeepLinks", () => {
    describe("getBankDeepLink", () => {
        it("returns config for DBS / POSB", () => {
            const dbs = getBankDeepLink("DBS");
            expect(dbs).not.toBeNull();
            expect(dbs?.appScheme).toBe("dbsdigibank://");
            expect(dbs?.webUrl).toContain("dbs.com.sg");

            const posb = getBankDeepLink("POSB");
            expect(posb?.appScheme).toBe("dbsdigibank://");
        });

        it("returns config for OCBC", () => {
            const ocbc = getBankDeepLink("OCBC");
            expect(ocbc?.appScheme).toBe("ocbcdigital://");
            expect(ocbc?.webUrl).toContain("ocbc.com");
        });

        it("returns config for UOB", () => {
            const uob = getBankDeepLink("UOB");
            expect(uob?.appScheme).toBe("uobtmrw://");
            expect(uob?.webUrl).toContain("uob.com.sg");
        });

        it("returns config for Citibank, Standard Chartered, HSBC, AMEX, Maybank", () => {
            expect(getBankDeepLink("Citibank")?.appScheme).toBe("citimobile://");
            expect(getBankDeepLink("Standard Chartered")?.appScheme).toBe(
                "scmobile://",
            );
            expect(getBankDeepLink("HSBC")?.appScheme).toBe("hsbc://");
            expect(getBankDeepLink("AMEX")?.appScheme).toBe("amex://");
            expect(getBankDeepLink("Maybank")?.appScheme).toBe("maybanksg://");
        });

        it("handles case insensitivity and whitespace", () => {
            expect(getBankDeepLink("  dbs  ")?.appScheme).toBe("dbsdigibank://");
            expect(getBankDeepLink("ocbc bank")?.appScheme).toBe(
                "ocbcdigital://",
            );
        });

        it("returns null for unknown bank", () => {
            expect(getBankDeepLink("Unknown Bank XYZ")).toBeNull();
            expect(getBankDeepLink("Other")).toBeNull();
        });
    });

    describe("openBankApp", () => {
        const originalOpen = window.open;

        beforeEach(() => {
            window.open = vi.fn();
        });

        afterEach(() => {
            window.open = originalOpen;
            vi.restoreAllMocks();
        });

        it("opens webUrl in a new tab when on desktop", () => {
            // Default userAgent is desktop in vitest jsdom
            openBankApp("DBS");
            expect(window.open).toHaveBeenCalledWith(
                expect.stringContaining("dbs.com.sg"),
                "_blank",
                "noopener,noreferrer",
            );
        });

        it("does nothing gracefully for an unknown bank", () => {
            openBankApp("Unknown Bank");
            expect(window.open).not.toHaveBeenCalled();
        });
    });
});
