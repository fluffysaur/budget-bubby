import { describe, expect, it } from "vitest";
import { formatAccountChange } from "../accountChange";

const trend = (points: number[]) => ({
    points,
    delta: points[points.length - 1] - points[0],
});

describe("formatAccountChange", () => {
    it("signs a rise and marks it up", () => {
        expect(formatAccountChange(trend([1000, 2850]), "amount")).toEqual({
            text: "+S$1,850.00",
            isUp: true,
        });
        expect(formatAccountChange(trend([1000, 1094]), "percent")).toEqual({
            text: "+9.4%",
            isUp: true,
        });
    });

    it("shows a fall without marking it up", () => {
        expect(formatAccountChange(trend([1000, 760]), "amount")).toEqual({
            text: "-S$240.00",
            isUp: false,
        });
        expect(formatAccountChange(trend([1000, 979]), "percent")).toEqual({
            text: "-2.1%",
            isUp: false,
        });
    });

    it("shows a dash for % when the starting balance is 0", () => {
        expect(formatAccountChange(trend([0, 500]), "percent")).toEqual({
            text: "—",
            isUp: false,
        });
        expect(formatAccountChange(trend([0, 500]), "amount").text).toBe(
            "+S$500.00",
        );
    });

    it("treats a change that rounds to nothing as flat", () => {
        expect(formatAccountChange(trend([100, 100.004]), "amount")).toEqual({
            text: "S$0.00",
            isUp: false,
        });
        expect(
            formatAccountChange(trend([100000, 100000.2]), "percent"),
        ).toEqual({ text: "0.0%", isUp: false });
    });
});
