import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { LeftToSpendHero } from "../src/components/dashboard/LeftToSpendHero";

const meterRenders = vi.fn();

vi.mock("../src/components/dashboard/CategoryMeterCard", () => ({
    CategoryMeterCard: ({ name }: { name: string }) => {
        meterRenders(name);
        return <div>{name}</div>;
    },
}));

const summary = {
    totalAllocated: 100,
    totalSpent: 40,
    totalRemaining: 60,
    totalPct: 40,
    categories: [
        {
            id: "c1",
            name: "Groceries",
            color: "#10b981",
            spent: 40,
            allocated: 100,
            remaining: 60,
            pct: 40,
        },
    ],
};

describe("LeftToSpendHero memoization", () => {
    it("skips re-rendering when the parent re-renders with the same props", () => {
        const onBudget = vi.fn();
        meterRenders.mockClear();
        const { rerender } = render(
            <LeftToSpendHero summary={summary} onNavigateBudget={onBudget} />,
        );
        expect(meterRenders).toHaveBeenCalledTimes(1);

        rerender(
            <LeftToSpendHero summary={summary} onNavigateBudget={onBudget} />,
        );
        expect(meterRenders).toHaveBeenCalledTimes(1);

        rerender(
            <LeftToSpendHero
                summary={{ ...summary, totalRemaining: 50 }}
                onNavigateBudget={onBudget}
            />,
        );
        expect(meterRenders).toHaveBeenCalledTimes(2);
    });
});
