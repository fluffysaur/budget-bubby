import { describe, it, expect } from "vitest";
import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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

const hbo: RecurringItem = {
    ...childcare,
    id: "hbo",
    name: "HBO Max",
    type: "subscription",
    amount: 9.65,
    start_date: "2027-01-01",
};

const linkedCare: RecurringItem = {
    ...childcare,
    start_date: null,
    goal_id: "w",
    goal_offset_months: 0,
};

function renderCard(roadmap: RoadmapState) {
    return render(
        <MemoryRouter>
            <ProjectionCard roadmap={roadmap} />
        </MemoryRouter>,
    );
}

function state(
    history: HistoryPoint[],
    items: RecurringItem[] = [childcare],
): RoadmapState {
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
        cashFlowChanges: lifeEventsFromRecurring(items, "2026-10", [
            { id: "w", target_date: "2027-05-01" },
        ]),
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
    untrackedOpening = 0,
): HistoryPoint => ({
    month,
    date: `${month}-15`,
    value,
    actual: true,
    untrackedOpening,
});

describe("ProjectionCard", () => {
    it("asks for monthly balance updates until 3 months have one", () => {
        renderCard(state([update("2026-10", 48000), update("2026-11", 50000)]));
        const locked = screen.getByTestId("projection-locked");
        expect(locked).toHaveTextContent("Update balances monthly to unlock");
        expect(locked).toHaveTextContent("2 of 3 months");
        expect(locked).not.toHaveTextContent("New accounts reset the count");
    });

    it("keeps counting when an account is recorded for the first time", () => {
        renderCard(
            state([
                update("2026-09", 20000),
                update("2026-10", 48000, 27000),
                update("2026-11", 50000),
            ]),
        );
        expect(screen.queryByTestId("projection-locked")).toBeNull();
    });

    it("lists only goal-linked costs under Goal Costs", () => {
        renderCard(state([], [linkedCare, hbo]));
        expect(screen.getByText("Goal Costs")).toBeInTheDocument();
        const list = screen.getByRole("list", { name: "Goal costs" });
        const item = within(list).getByRole("listitem");
        expect(within(list).getAllByRole("listitem")).toHaveLength(1);
        expect(item).toHaveTextContent("Infant care");
        expect(item).toHaveTextContent("after Wedding");
        expect(item).toHaveTextContent("−S$800.00/mo");
        expect(list).not.toHaveTextContent("HBO Max");
    });

    it("summarises unlinked changes and links to Recurring", () => {
        renderCard(state([], [linkedCare, hbo, childcare]));
        const link = screen.getByRole("link", { name: /Also counts 2 other/ });
        expect(link).toHaveAttribute("href", "/recurring");
        expect(link).toHaveTextContent("−S$809.65/mo");
    });

    it("prompts to link a cost when nothing is linked", () => {
        renderCard(state([], [hbo]));
        expect(
            screen.getByText(
                "Link a recurring cost to a goal, like childcare after Baby Fund.",
            ),
        ).toBeInTheDocument();
        expect(screen.queryByRole("list", { name: "Goal costs" })).toBeNull();
        expect(screen.getByRole("link")).toHaveTextContent(
            "Also counts 1 other recurring change",
        );
    });

    it("draws the chart once unlocked", () => {
        renderCard(
            state([
                update("2026-09", 46000),
                update("2026-10", 48000),
                update("2026-11", 50000),
            ]),
        );
        expect(screen.queryByTestId("projection-locked")).toBeNull();
        expect(
            screen.getByRole("img", {
                name: /^Pool S\$50,000 now, projected/,
            }),
        ).toBeInTheDocument();
    });
});
