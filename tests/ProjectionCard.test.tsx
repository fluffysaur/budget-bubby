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
            averageMonthlySpend: 0,
            trimCandidates: [],
        },
        tradeOffs: [],
        byGoalId: new Map(),
        history,
        projection: projectPool(input),
        reality: realityCheck({ history, expenses: [], planPerMonth: 2000 }),
        includeBonuses: false,
        hasBonuses: false,
        toggleIncludeBonuses: () => {},
    };
}

/** A real balance update mid-month. */
const update = (
    month: string,
    value: number,
    newAccounts = false,
): HistoryPoint => ({
    month,
    date: `${month}-15`,
    value,
    actual: true,
    newAccounts,
});

describe("ProjectionCard", () => {
    it("asks for monthly balance updates until 2 clean months exist", () => {
        render(
            <ProjectionCard
                roadmap={state([
                    update("2026-10", 48000),
                    update("2026-11", 50000),
                ])}
            />,
        );
        const locked = screen.getByTestId("projection-locked");
        expect(locked).toHaveTextContent("Update balances monthly to unlock");
        expect(locked).toHaveTextContent("1 of 2 months");
        expect(screen.queryByTestId("projection-locked-reset")).toBeNull();
    });

    it("says when newly recorded accounts reset the count", () => {
        render(
            <ProjectionCard
                roadmap={state([
                    update("2026-09", 20000),
                    update("2026-10", 48000, true),
                    update("2026-11", 50000),
                ])}
            />,
        );
        expect(screen.getByTestId("projection-locked")).toHaveTextContent(
            "1 of 2 months",
        );
        expect(screen.getByTestId("projection-locked-reset")).toHaveTextContent(
            "New accounts reset the count",
        );
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
                    update("2026-09", 46000),
                    update("2026-10", 48000),
                    update("2026-11", 50000),
                ])}
            />,
        );
        expect(screen.queryByTestId("projection-locked")).toBeNull();
        expect(
            screen.getByRole("img", { name: /^Pool S\$50k now, projected/ }),
        ).toBeInTheDocument();
    });
});
