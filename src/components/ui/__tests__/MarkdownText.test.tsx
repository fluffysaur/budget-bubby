import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownText } from "../MarkdownText";

describe("MarkdownText", () => {
    it("renders bold text and lists", () => {
        render(
            <MarkdownText>{"**S$100.00** left\n\n- one\n- two"}</MarkdownText>,
        );
        expect(screen.getByText("S$100.00").tagName).toBe("STRONG");
        expect(screen.getAllByRole("listitem")).toHaveLength(2);
    });

    it("renders GFM tables inside a scroll wrapper", () => {
        render(
            <MarkdownText>{"| A | B |\n|---|---|\n| 1 | 2 |"}</MarkdownText>,
        );
        const table = screen.getByRole("table");
        expect(table.parentElement?.className).toContain("overflow-x-auto");
    });

    it("opens http(s) links in a new tab safely", () => {
        render(<MarkdownText>{"[docs](https://example.com)"}</MarkdownText>);
        const link = screen.getByRole("link", { name: "docs" });
        expect(link).toHaveAttribute("target", "_blank");
        expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("strips non-http links to plain text", () => {
        render(<MarkdownText>{"[click](javascript:alert(1))"}</MarkdownText>);
        expect(screen.queryByRole("link")).toBeNull();
        expect(screen.getByText("click")).toBeInTheDocument();
    });

    it("does not render raw HTML", () => {
        const { container } = render(
            <MarkdownText>{"<script>x</script><b>hi</b>"}</MarkdownText>,
        );
        expect(container.querySelector("script")).toBeNull();
        expect(container.querySelector("b")).toBeNull();
    });
});
