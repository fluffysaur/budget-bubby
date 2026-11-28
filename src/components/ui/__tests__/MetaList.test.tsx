import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MetaFigure, MetaList, MetaRule } from "../MetaList";

describe("MetaList", () => {
    it("renders each fact with a hairline and no dot glyph", () => {
        render(
            <MetaList
                data-testid="meta"
                items={[
                    <>
                        <MetaFigure>9</MetaFigure> expenses
                    </>,
                    "All time",
                ]}
            />,
        );
        const meta = screen.getByTestId("meta");
        expect(meta).toHaveTextContent("9 expenses, All time");
        expect(meta.textContent).not.toContain("·");
        expect(meta.querySelectorAll(".border-l")).toHaveLength(2);
    });

    it("skips falsy facts", () => {
        render(
            <MetaList
                data-testid="meta"
                items={["starts Mar 2027", false, null, "", "deduction"]}
            />,
        );
        expect(screen.getByTestId("meta")).toHaveTextContent(
            /^starts Mar 2027, deduction$/,
        );
    });

    it("hides the standalone rule from assistive tech", () => {
        const { container } = render(<MetaRule />);
        expect(container.firstElementChild).toHaveAttribute(
            "aria-hidden",
            "true",
        );
    });
});
