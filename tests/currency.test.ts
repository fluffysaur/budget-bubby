import { describe, it, expect } from "vitest";
import { formatSGD, formatSGDCompact, parseSGD } from "../src/lib/currency";

describe("currency utilities", () => {
    describe("formatSGD", () => {
        it("formats standard positive numbers with thousand separators and 2 decimals", () => {
            expect(formatSGD(1234.5)).toBe("S$1,234.50");
            expect(formatSGD(5000)).toBe("S$5,000.00");
            expect(formatSGD(1000000)).toBe("S$1,000,000.00");
            expect(formatSGD(0)).toBe("S$0.00");
        });

        it("formats negative amounts with minus sign before S$", () => {
            expect(formatSGD(-50)).toBe("-S$50.00");
            expect(formatSGD(-1234.56)).toBe("-S$1,234.56");
        });

        it("rounds to 2 decimal places correctly", () => {
            expect(formatSGD(10.999)).toBe("S$11.00");
            expect(formatSGD(10.554)).toBe("S$10.55");
            expect(formatSGD(10.555)).toBe("S$10.56");
        });

        it("handles small fractions and zeroes", () => {
            expect(formatSGD(0.01)).toBe("S$0.01");
            expect(formatSGD(0.004)).toBe("S$0.00");
            expect(formatSGD(-0)).toBe("S$0.00");
        });

        it("formats without cents when showCents is false", () => {
            expect(formatSGD(1234.5, { showCents: false })).toBe("S$1,235");
            expect(formatSGD(5000, { showCents: false })).toBe("S$5,000");
            expect(formatSGD(0, { showCents: false })).toBe("S$0");
            expect(formatSGD(-50, { showCents: false })).toBe("-S$50");
            expect(formatSGD(-1234.56, { showCents: false })).toBe("-S$1,235");
        });
    });

    describe("formatSGDCompact", () => {
        it("formats sub-thousand values as whole numbers without suffix", () => {
            expect(formatSGDCompact(0)).toBe("S$0");
            expect(formatSGDCompact(1)).toBe("S$1");
            expect(formatSGDCompact(50)).toBe("S$50");
            expect(formatSGDCompact(500)).toBe("S$500");
            expect(formatSGDCompact(999)).toBe("S$999");
            expect(formatSGDCompact(999.4)).toBe("S$999");
        });

        it('formats thousands with "k" suffix and rolls whole numbers without trailing zero', () => {
            expect(formatSGDCompact(999.5)).toBe("S$1k");
            expect(formatSGDCompact(1_000)).toBe("S$1k");
            expect(formatSGDCompact(1_049)).toBe("S$1k");
            expect(formatSGDCompact(1_050)).toBe("S$1.1k");
            expect(formatSGDCompact(1_200)).toBe("S$1.2k");
            expect(formatSGDCompact(1_940)).toBe("S$1.9k");
            expect(formatSGDCompact(1_949)).toBe("S$1.9k");
            expect(formatSGDCompact(1_950)).toBe("S$2k");
            expect(formatSGDCompact(1_960)).toBe("S$2k");
            expect(formatSGDCompact(2_000)).toBe("S$2k");
            expect(formatSGDCompact(10_000)).toBe("S$10k");
            expect(formatSGDCompact(500_000)).toBe("S$500k");
            expect(formatSGDCompact(999_949)).toBe("S$999.9k");
        });

        it('rolls over near-million amounts to "M" instead of 1000.0k or 1000k', () => {
            expect(formatSGDCompact(999_950)).toBe("S$1M");
            expect(formatSGDCompact(999_999)).toBe("S$1M");
            expect(formatSGDCompact(1_000_000)).toBe("S$1M");
            expect(formatSGDCompact(1_049_999)).toBe("S$1M");
            expect(formatSGDCompact(1_050_000)).toBe("S$1.1M");
            expect(formatSGDCompact(1_200_000)).toBe("S$1.2M");
            expect(formatSGDCompact(1_950_000)).toBe("S$2M");
            expect(formatSGDCompact(999_949_999)).toBe("S$999.9M");
        });

        it('formats billions with "B" suffix and rolls over near-billion amounts', () => {
            expect(formatSGDCompact(999_950_000)).toBe("S$1B");
            expect(formatSGDCompact(1_000_000_000)).toBe("S$1B");
            expect(formatSGDCompact(1_500_000_000)).toBe("S$1.5B");
        });

        it("formats negative amounts with minus sign preceding S$", () => {
            expect(formatSGDCompact(-50)).toBe("-S$50");
            expect(formatSGDCompact(-999)).toBe("-S$999");
            expect(formatSGDCompact(-1_000)).toBe("-S$1k");
            expect(formatSGDCompact(-1_950)).toBe("-S$2k");
            expect(formatSGDCompact(-999_950)).toBe("-S$1M");
            expect(formatSGDCompact(-999_999)).toBe("-S$1M");
            expect(formatSGDCompact(-1_000_000)).toBe("-S$1M");
            expect(formatSGDCompact(-1_000_000_000)).toBe("-S$1B");
        });

        it("handles zero, negative zero, and small fractional zero without negative sign", () => {
            expect(formatSGDCompact(0)).toBe("S$0");
            expect(formatSGDCompact(-0)).toBe("S$0");
            expect(formatSGDCompact(0.4)).toBe("S$0");
            expect(formatSGDCompact(-0.4)).toBe("S$0");
        });

        it("handles NaN and non-finite inputs safely", () => {
            expect(formatSGDCompact(NaN)).toBe("S$0");
            expect(formatSGDCompact(Infinity)).toBe("S$0");
            expect(formatSGDCompact(-Infinity)).toBe("S$0");
        });
    });

    describe("parseSGD", () => {
        it("parses formatted S$ strings into numeric values", () => {
            expect(parseSGD("S$1,234.50")).toBe(1234.5);
            expect(parseSGD("-S$50.00")).toBe(-50);
            expect(parseSGD("S$0.00")).toBe(0);
        });

        it("parses unformatted or loosely formatted inputs", () => {
            expect(parseSGD("1234.50")).toBe(1234.5);
            expect(parseSGD("$500")).toBe(500);
            expect(parseSGD("   S$ 2,500.75 ")).toBe(2500.75);
            expect(parseSGD("(S$100.00)")).toBe(-100);
        });

        it("returns 0 for empty or invalid inputs", () => {
            expect(parseSGD("")).toBe(0);
            expect(parseSGD("abc")).toBe(0);
        });
    });
});
