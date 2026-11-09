import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatCard } from "../src/components/ui/StatCard";
import { ReceiptText } from "lucide-react";

describe("StatCard Visual Variants", () => {
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
});
