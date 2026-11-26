import { describe, expect, it } from "vitest";
import {
    INSTITUTION_ALIASES,
    getInitial,
    getInstitutionLogo,
} from "../institutionLogos";

describe("getInstitutionLogo", () => {
    it.each([
        ["DBS", "dbs"],
        ["posb", "dbs"],
        ["DBS/POSB", "dbs"],
        ["  OCBC Bank ", "ocbc"],
        ["SGX CDP", "sgx"],
        ["SGX/CDP", "sgx"],
        ["CDP", "sgx"],
        ["Interactive Brokers", "ibkr"],
        ["moomoo", "moomoo"],
        ["Tiger Brokers", "tiger"],
        ["StashAway", "stashaway"],
        ["Standard Chartered", "stanchart"],
        ["Citi", "citibank"],
    ])("matches %s to %s", (institution, key) => {
        expect(getInstitutionLogo(institution)).toContain(`logos/${key}.png`);
    });

    it("returns null for unknown, empty and partial names", () => {
        expect(getInstitutionLogo("Mattress")).toBeNull();
        expect(getInstitutionLogo("")).toBeNull();
        expect(getInstitutionLogo(null)).toBeNull();
        expect(getInstitutionLogo("My DBS notes")).toBeNull();
    });

    it("has a bundled file for every alias", () => {
        const bundled = Object.keys(
            import.meta.glob("../../../public/logos/*.png"),
        );
        for (const key of new Set(Object.values(INSTITUTION_ALIASES))) {
            expect(bundled).toContain(`../../../public/logos/${key}.png`);
        }
    });
});

describe("getInitial", () => {
    it("uses the first letter or digit", () => {
        expect(getInitial("  emergency fund")).toBe("E");
        expect(getInitial("(360) Account")).toBe("3");
        expect(getInitial("")).toBe("?");
    });
});
