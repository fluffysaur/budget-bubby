import { describe, expect, it } from "vitest";
import { otherChangesLabel, summarizeGoalCosts } from "../goalCosts";
import type { CashFlowChange } from "../lifeEvents";

const change = (
    id: string,
    monthlyDelta: number,
    goalId?: string,
): CashFlowChange => ({
    id,
    name: id,
    kind: "starts",
    startMonth: "2027-01",
    endMonth: null,
    monthlyDelta,
    ...(goalId ? { goalId, goalOffsetMonths: 0 } : {}),
});

describe("summarizeGoalCosts", () => {
    const goals = [{ id: "g1", title: "Baby Fund" }];

    it("lists only goal-linked changes with their goal title", () => {
        const s = summarizeGoalCosts(
            [change("care", -800, "g1"), change("hbo", -9.65)],
            goals,
        );
        expect(s.linked.map((r) => r.change.id)).toEqual(["care"]);
        expect(s.linked[0].goalTitle).toBe("Baby Fund");
    });

    it("sums the unlinked changes and keeps the sign", () => {
        const s = summarizeGoalCosts(
            [
                change("a", -9.65),
                change("b", -20.48),
                change("c", -12),
                change("care", -800, "g1"),
            ],
            goals,
        );
        expect(s.otherCount).toBe(3);
        expect(s.otherMonthly).toBe(-42.13);
    });

    it("handles a linked goal that is missing", () => {
        const s = summarizeGoalCosts([change("x", -5, "gone")], goals);
        expect(s.linked[0].goalTitle).toBeNull();
        expect(s.otherCount).toBe(0);
    });

    it("returns an empty summary when nothing is linked or changing", () => {
        expect(summarizeGoalCosts([], goals)).toEqual({
            linked: [],
            otherCount: 0,
            otherMonthly: 0,
        });
    });
});

describe("otherChangesLabel", () => {
    it("pluralises and hides at zero", () => {
        expect(otherChangesLabel(0)).toBeNull();
        expect(otherChangesLabel(1)).toBe(
            "Also counts 1 other recurring change",
        );
        expect(otherChangesLabel(3)).toBe(
            "Also counts 3 other recurring changes",
        );
    });
});
