import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PoolBar } from "../src/components/roadmap/PoolBar";
import { projectRoadmap, type RoadmapGoalInput } from "../src/lib/roadmap";

const goal = (
    id: string,
    targetAmount: number,
    targetDate: string,
): RoadmapGoalInput => ({
    id,
    title: id,
    emoji: "🎯",
    targetAmount,
    targetDate,
    spent: 0,
    done: false,
});

const result = projectRoadmap({
    today: "2026-11-18",
    pool: { liquid: 50000, investments: 0, asOf: "2026-11-15" },
    monthlySavings: 2000,
    goals: [
        goal("Wedding", 30000, "2027-05-01"),
        goal("House", 100000, "2028-11-01"),
    ],
});

describe("PoolBar", () => {
    it("renders one tappable segment per goal in funding order", () => {
        const onSelect = vi.fn();
        render(
            <PoolBar result={result} selectedId={null} onSelect={onSelect} />,
        );
        const buttons = screen.getAllByRole("button", { name: /^Preview / });
        expect(buttons.map((b) => b.getAttribute("aria-label"))).toEqual([
            "Preview Wedding",
            "Preview House",
        ]);
        fireEvent.click(buttons[1]);
        expect(onSelect).toHaveBeenCalledWith("House");
    });

    it("deselects the selected segment on a second tap", () => {
        const onSelect = vi.fn();
        render(
            <PoolBar result={result} selectedId="House" onSelect={onSelect} />,
        );
        const house = screen.getByRole("button", { name: "Preview House" });
        expect(house).toHaveAttribute("aria-pressed", "true");
        fireEvent.click(house);
        expect(onSelect).toHaveBeenCalledWith(null);
    });

    it("summarises the pool for screen readers", () => {
        render(
            <PoolBar result={result} selectedId={null} onSelect={() => {}} />,
        );
        expect(
            screen.getByText("Pool S$50,000.00 covers 1 of 2 goals today"),
        ).toBeInTheDocument();
    });
});
