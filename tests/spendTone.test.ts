import { describe, it, expect } from "vitest";
import { getSpendTone } from "../src/lib/spendTone";

describe("spendTone helper", () => {
    it("returns 'ok' when spending is below 80%", () => {
        expect(getSpendTone(0)).toBe("ok");
        expect(getSpendTone(50)).toBe("ok");
        expect(getSpendTone(79.9)).toBe("ok");
    });

    it("returns 'near' when spending is between 80% and 99.99%", () => {
        expect(getSpendTone(80)).toBe("near");
        expect(getSpendTone(85)).toBe("near");
        expect(getSpendTone(99.9)).toBe("near");
    });

    it("returns 'over' when spending is 100% or above", () => {
        expect(getSpendTone(100)).toBe("over");
        expect(getSpendTone(115)).toBe("over");
        expect(getSpendTone(200)).toBe("over");
    });
});
