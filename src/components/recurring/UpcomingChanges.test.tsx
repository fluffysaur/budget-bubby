import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UpcomingChanges } from "./UpcomingChanges";
import type { UpcomingChange } from "../../lib/recurringUpcoming";

const hbo: UpcomingChange = {
    id: "r1-starts",
    name: "HBO Max",
    type: "subscription",
    kind: "starts",
    date: "2027-01-01",
    month: "2027-01",
    monthlyDelta: -9.65,
};

describe("UpcomingChanges", () => {
    it("renders nothing when there are no changes", () => {
        const { container } = render(<UpcomingChanges changes={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("lists each change with its month and monthly amount", () => {
        render(<UpcomingChanges changes={[hbo]} />);
        expect(
            screen.getByRole("heading", { name: "Upcoming Changes" }),
        ).toBeInTheDocument();
        const row = screen.getByRole("listitem");
        expect(row).toHaveTextContent("HBO Max");
        expect(row).toHaveTextContent("starts Jan 2027");
        expect(row).not.toHaveTextContent("deduction");
        expect(row).toHaveTextContent("−S$9.65/mo");
    });

    it("labels tax and insurance as deductions", () => {
        render(
            <UpcomingChanges
                changes={[
                    {
                        ...hbo,
                        id: "r2-starts",
                        name: "Home insurance",
                        type: "insurance",
                        month: "2027-03",
                    },
                ]}
            />,
        );
        expect(screen.getByRole("listitem")).toHaveTextContent(
            "starts Mar 2027 · deduction",
        );
    });

    it("shows no saving when a tax year ends", () => {
        render(
            <UpcomingChanges
                changes={[
                    {
                        ...hbo,
                        id: "t-ends",
                        name: "Income Tax (2026)",
                        type: "tax",
                        kind: "ends",
                        month: "2027-04",
                        monthlyDelta: 91.67,
                    },
                ]}
            />,
        );
        const row = screen.getByRole("listitem");
        expect(row).toHaveTextContent("ends Apr 2027 · deduction");
        expect(row).not.toHaveTextContent("S$");
    });
});
