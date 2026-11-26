import { describe, expect, it } from "vitest";
import {
    applySubsetOrder,
    moveItem,
    nextSortOrder,
    sortAccounts,
} from "../accountOrder";

const acc = (id: string, name: string, sort_order?: number | null) => ({
    id,
    name,
    sort_order,
});

describe("sortAccounts", () => {
    it("orders by sort_order with nulls last, then name", () => {
        const sorted = sortAccounts([
            acc("a", "Zeta"),
            acc("b", "Beta", 1),
            acc("c", "Alpha", null),
            acc("d", "Gamma", 0),
        ]);
        expect(sorted.map((a) => a.id)).toEqual(["d", "b", "c", "a"]);
    });
});

describe("applySubsetOrder", () => {
    it("reorders only the given ids, keeping other slots", () => {
        const all = [acc("a", "A"), acc("b", "B"), acc("c", "C")];
        expect(applySubsetOrder(all, ["c", "a"]).map((a) => a.id)).toEqual([
            "c",
            "b",
            "a",
        ]);
    });

    it("ignores unknown ids", () => {
        const all = [acc("a", "A"), acc("b", "B")];
        expect(applySubsetOrder(all, ["x", "b", "a"]).map((a) => a.id)).toEqual(
            ["b", "a"],
        );
    });
});

describe("nextSortOrder", () => {
    it("returns max + 1, or 0 for an empty group", () => {
        expect(nextSortOrder([])).toBe(0);
        expect(nextSortOrder([acc("a", "A", 4), acc("b", "B")])).toBe(5);
    });
});

describe("moveItem", () => {
    it("moves an item and clamps at the ends", () => {
        expect(moveItem(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
        expect(moveItem(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    });
});
