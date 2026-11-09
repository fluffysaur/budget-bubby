import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatCard } from "../src/components/ui/StatCard";
import { ReceiptText } from "lucide-react";

describe("StatCard Visual Variants", () => {
    it("renders embedded ProgressRing when ring prop is provided", () => {
        render(
            <StatCard
                title="Goal Pace"
                value="S$1,200"
                ring={{ value: 75, tone: "ok" }}
            />,
        );
        expect(screen.getByRole("progressbar")).toBeInTheDocument();
        expect(screen.getByText("S$1,200")).toBeInTheDocument();
    });

    it("renders embedded Sparkline when sparkline prop is provided", () => {
        render(
            <StatCard
                title="Trend"
                value="S$3,400"
                sparkline={{ data: [10, 20, 15, 30, 25], tone: "ok" }}
            />,
        );
        expect(
            screen.getByRole("img", { name: "Sparkline trend" }),
        ).toBeInTheDocument();
    });

    it("applies semantic pastel token when tone prop is passed", () => {
        render(
            <StatCard
                title="Paid"
                value="S$850"
                icon={<ReceiptText data-testid="icon" />}
                tone="ok"
            />,
        );
        const iconWrapper = screen.getByTestId("icon").parentElement;
        expect(iconWrapper?.className).toContain("pastel-mint-light");
    });

    it("applies compact styling when compact is true", () => {
        const { container } = render(
            <StatCard title="Spent" value="S$240" compact />,
        );
        const inner = container.querySelector(".p-2\\.5");
        expect(inner).toBeInTheDocument();
    });
});
