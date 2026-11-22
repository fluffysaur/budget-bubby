import { describe, expect, it } from "vitest";
import { sortGoalsByDate } from "../goalSettings";

describe("sortGoalsByDate", () => {
    it("sorts goals by target_date ascending (earliest first)", () => {
        const goals = [
            { id: "g3", target_date: "2029-12-31", created_at: "2026-01-01" },
            { id: "g1", target_date: "2027-05-01", created_at: "2026-01-03" },
            { id: "g2", target_date: "2027-06-01", created_at: "2026-01-02" },
        ];

        const sorted = sortGoalsByDate(goals);
        expect(sorted.map((g) => g.id)).toEqual(["g1", "g2", "g3"]);
        // Does not mutate input array
        expect(goals.map((g) => g.id)).toEqual(["g3", "g1", "g2"]);
    });

    it("breaks ties deterministically by created_at then id", () => {
        const goals = [
            { id: "g-b", target_date: "2027-06-01", created_at: "2026-01-01" },
            { id: "g-c", target_date: "2027-06-01", created_at: "2026-01-02" },
            { id: "g-a", target_date: "2027-06-01", created_at: "2026-01-01" },
        ];

        const sorted = sortGoalsByDate(goals);
        expect(sorted.map((g) => g.id)).toEqual(["g-a", "g-b", "g-c"]);
    });

    it("places goals with empty target_date last", () => {
        const goals = [
            { id: "g-empty", target_date: "", created_at: "2026-01-01" },
            { id: "g-dated", target_date: "2027-05-01", created_at: "2026-01-02" },
        ];

        const sorted = sortGoalsByDate(goals);
        expect(sorted.map((g) => g.id)).toEqual(["g-dated", "g-empty"]);
    });
});
