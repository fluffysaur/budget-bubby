import { describe, it, expect } from "vitest";
import { guessCategory, guessCategoryId } from "../src/lib/categoryGuess";
import type { Category } from "../src/types/finance";

const cat = (id: string, name: string): Category => ({
    id,
    household_id: "h",
    name,
    color: "#000",
    icon: "x",
    is_system: false,
});

const categories = [
    cat("c-food", "Food & Dining"),
    cat("c-transport", "Transport"),
    cat("c-life", "Lifestyle"),
    cat("c-buffer", "Buffer"),
];

describe("categoryGuess", () => {
    it("maps common keywords to categories", () => {
        expect(guessCategoryId("Lunch at hawker", categories)).toBe("c-food");
        expect(guessCategoryId("Grab to office", categories)).toBe(
            "c-transport",
        );
        expect(guessCategoryId("Netflix", categories)).toBe("c-life");
        expect(guessCategoryId("Clinic visit", categories)).toBe("c-buffer");
    });

    it("is case-insensitive and returns the category object", () => {
        expect(guessCategory("STARBUCKS", categories)?.name).toBe(
            "Food & Dining",
        );
    });

    it("returns undefined for unknown or empty text", () => {
        expect(guessCategoryId("xyzzy", categories)).toBeUndefined();
        expect(guessCategoryId("   ", categories)).toBeUndefined();
    });

    it("returns undefined when the matching category does not exist", () => {
        expect(
            guessCategoryId("lunch", [cat("c-t", "Transport")]),
        ).toBeUndefined();
    });
});
