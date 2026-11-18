import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { ProjectionCard } from "../src/components/roadmap/ProjectionCard";
import {
    lifeEventsFromRecurring,
    projectPool,
    projectRoadmap,
    realityCheck,
    type HistoryPoint,
    type RoadmapInput,
} from "../src/lib/roadmap";
import type { RoadmapState } from "../src/hooks/useRoadmap";
import type { RecurringItem } from "../src/types/finance";

const childcare: RecurringItem = {
    id: "cc",
    household_id: "hh",
    owner_id: "m1",
    type: "bill",
    name: "Infant care",
    amount: 800,
    frequency: "monthly",
    start_date: "2028-03-01",
    end_date: null,
    monthly_amortized_amount: 0,
};

function state(history: HistoryPoint[]): RoadmapState {
    const input: RoadmapInput = {
        today: "2026-11-18",
        pool: { liquid: 50000, investments: 0, asOf: "2026-11-15" },
        monthlySavings: 2000,
        goals: [
            {
                id: "w",
                title: "Wedding",
                emoji: "💍",
                targetAmount: 30000,
                targetDate: "2027-05-01",
                spent: 0,
                done: false,
            },
        ],
        cashFlowChanges: lifeEventsFromRecurring([childcare], "2026-10"),
    };
    const result = projectRoadmap(input);
    return {
        isLoading: false,
        input,
        result,
        baseline: {
            monthlySavings: 2000,
            source: "actual",
            months: [],
            perMonth: [],
        },
        tradeOffs: [],
        byGoalId: new Map(),
        history,
        projection: projectPool(input),
        reality: realityCheck({ history, expenses: [], planPerMonth: 2000 }),
    };
}

describe("ProjectionCard", () => {
    it("asks for monthly balance updates until 3 months exist", () => {
        render(
            <ProjectionCard
                roadmap={state([
                    { month: "2026-10", value: 48000, actual: true },
                    { month: "2026-11", value: 50000, actual: true },
                ])}
            />,
        );
        const locked = screen.getByTestId("projection-locked");
        expect(locked).toHaveTextContent("Update balances monthly to unlock");
        expect(locked).toHaveTextContent("2 of 3 months");
    });

    it("lists life events with their month and monthly change", () => {
        render(<ProjectionCard roadmap={state([])} />);
        const item = within(
            screen.getByRole("list", { name: "Life events" }),
        ).getByRole("listitem");
        expect(item).toHaveTextContent("Infant care");
        expect(item).toHaveTextContent("From Mar 2028");
        expect(item).toHaveTextContent("−S$800/mo");
    });

    it("draws the chart once unlocked", () => {
        render(
            <ProjectionCard
                roadmap={state([
                    { month: "2026-09", value: 46000, actual: true },
                    { month: "2026-10", value: 48000, actual: true },
                    { month: "2026-11", value: 50000, actual: true },
                ])}
            />,
        );
        expect(screen.queryByTestId("projection-locked")).toBeNull();
        expect(
            screen.getByRole("img", { name: /^Pool S\$50k now, projected/ }),
        ).toBeInTheDocument();
    });
});
