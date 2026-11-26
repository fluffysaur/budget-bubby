import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoadmapChip } from "../src/components/roadmap/RoadmapChip";

const roadmap = vi.hoisted(() => ({
    value: {
        isLoading: false,
        result: {
            verdict: "short",
            shortfallPerMonth: 400.001,
            goals: [],
        },
    },
}));

vi.mock("../src/hooks/useRoadmap", () => ({
    useRoadmap: () => roadmap.value,
}));

describe("RoadmapChip", () => {
    it("shows the monthly shortfall rounded up to the cent", () => {
        render(<RoadmapChip />);
        expect(screen.getByText("S$400.01")).toBeInTheDocument();
    });
});
