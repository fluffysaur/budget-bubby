import { describe, it, expect } from "vitest";
import { cleanMerchant, normalizeMerchant } from "../src/lib/capture/merchant";
import {
    generateCaptureToken,
    readBearerToken,
    sha256Hex,
    CAPTURE_TOKEN_PATTERN,
} from "../src/lib/capture/token";

describe("normalizeMerchant", () => {
    it("strips prefixes, reference numbers and locations", () => {
        expect(normalizeMerchant("GRAB*FOOD 8812")).toBe("grab food");
        expect(normalizeMerchant("NTUC FAIRPRICE-TAMPINES SG")).toBe("ntuc fairprice tampines");
        expect(normalizeMerchant("SQ *Common Man Coffee #1234")).toBe("common man coffee");
        expect(normalizeMerchant("PAYPAL *SPOTIFY")).toBe("spotify");
        expect(normalizeMerchant("Shopee*Mall Singapore")).toBe("shopee mall");
        expect(normalizeMerchant("  Ya  Kun\tKaya ")).toBe("ya kun kaya");
    });

    it("keeps a lone number and never returns empty", () => {
        expect(normalizeMerchant("7-Eleven")).toBe("7 eleven");
        expect(normalizeMerchant("12345")).toBe("12345");
        expect(normalizeMerchant("***")).toBe("***");
    });

    it("is idempotent", () => {
        for (const raw of [
            "GRAB*FOOD 8812",
            "SQ *SQ *X",
            "NTUC FAIRPRICE-TAMPINES SG",
            "Cafe 123 Singapore 456",
        ]) {
            const once = normalizeMerchant(raw);
            expect(normalizeMerchant(once)).toBe(once);
        }
    });
});

describe("cleanMerchant", () => {
    it("title-cases all-caps names and strips control characters", () => {
        expect(cleanMerchant("NTUC FAIRPRICE")).toBe("Ntuc Fairprice");
        expect(cleanMerchant("GRAB*FOOD")).toBe("Grab*Food");
        expect(cleanMerchant("Toast\u0000 Box\n")).toBe("Toast Box");
        expect(cleanMerchant("McDonald's")).toBe("McDonald's");
    });

    it("rejects empty or non-string input and caps length", () => {
        expect(cleanMerchant("   ")).toBeNull();
        expect(cleanMerchant(42)).toBeNull();
        expect(cleanMerchant("a".repeat(200))).toHaveLength(120);
    });
});

describe("capture tokens", () => {
    it("generates a well-formed token with a matching hash", async () => {
        const { token, hash, hint } = await generateCaptureToken();
        expect(token).toMatch(CAPTURE_TOKEN_PATTERN);
        expect(hint).toBe(token.slice(-4));
        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(await sha256Hex(token)).toBe(hash);
    });

    it("reads only well-formed bearer tokens", async () => {
        const { token } = await generateCaptureToken();
        expect(readBearerToken(`Bearer ${token}`)).toBe(token);
        expect(readBearerToken(`bearer ${token}`)).toBe(token);
        expect(readBearerToken(token)).toBeNull();
        expect(readBearerToken("Bearer bb_cap_short")).toBeNull();
        expect(readBearerToken(null)).toBeNull();
    });
});
