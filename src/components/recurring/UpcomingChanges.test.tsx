import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UpcomingChanges } from "./UpcomingChanges";

describe("UpcomingChanges", () => {
    it("renders nothing when there are no changes", () => {
        const { container } = render(<UpcomingChanges changes={[]} />);
        expect(container).toBeEmptyDOMElement();
    });

    it("lists each change with its month and monthly amount", () => {
        render(
            <UpcomingChanges
                changes={[
                    {
                        id: "r1-starts",
                        name: "HBO Max",
                        kind: "starts",
                        date: "2027-01-01",
                        month: "2027-01",
                        monthlyDelta: -9.65,
                    },
                ]}
            />,
        );
        expect(
            screen.getByRole("heading", { name: "Upcoming Changes" }),
        ).toBeInTheDocument();
        const row = screen.getByRole("listitem");
        expect(row).toHaveTextContent("HBO Max");
        expect(row).toHaveTextContent("starts Jan 2027");
        expect(row).toHaveTextContent("−S$9.65/mo");
    });
});
