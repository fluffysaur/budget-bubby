import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AvatarDot } from "../src/components/ui/AvatarDot";

describe("AvatarDot", () => {
    it("renders a custom icon instead of the initial", () => {
        render(
            <AvatarDot name="Joint" icon={<svg data-testid="joint-icon" />} />,
        );
        expect(screen.getByTestId("joint-icon")).toBeInTheDocument();
        expect(
            screen.getByRole("img", { name: "Joint" }),
        ).not.toHaveTextContent("J");
    });

    it("is hidden from assistive tech when decorative", () => {
        const { container } = render(<AvatarDot name="Rachel" decorative />);
        expect(screen.queryByRole("img")).not.toBeInTheDocument();
        expect(container.firstElementChild).toHaveAttribute(
            "aria-hidden",
            "true",
        );
    });

    it("renders emoji avatar with accessible label", () => {
        render(
            <AvatarDot
                name="Rachel"
                avatarUrl="👩"
                ariaLabel="Rachel's avatar"
            />,
        );
        const avatar = screen.getByRole("img", { name: "Rachel's avatar" });
        expect(avatar).toBeInTheDocument();
        expect(avatar).toHaveTextContent("👩");
        expect(avatar).toHaveAttribute("title", "Rachel");
    });

    it("renders first letter of name when avatarUrl is absent", () => {
        render(<AvatarDot name="Yi Jia" />);
        const avatar = screen.getByRole("img", { name: "Yi Jia" });
        expect(avatar).toHaveTextContent("Y");
    });

    it("renders image element when avatarUrl is a valid URL path", () => {
        render(
            <AvatarDot
                name="Bubby"
                avatarUrl="https://example.com/avatar.png"
            />,
        );
        const avatar = screen.getByRole("img", { name: "Bubby" });
        const img = avatar.querySelector("img");
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute("src", "https://example.com/avatar.png");
    });

    it("falls back to default icon when no name or avatar provided", () => {
        render(<AvatarDot ariaLabel="Anonymous user" />);
        const avatar = screen.getByRole("img", { name: "Anonymous user" });
        expect(avatar).toHaveTextContent("👤");
    });

    it("applies correct size classes", () => {
        const { rerender } = render(<AvatarDot name="A" size="xs" />);
        expect(screen.getByRole("img")).toHaveClass("h-4", "w-4");

        rerender(<AvatarDot name="A" size="sm" />);
        expect(screen.getByRole("img")).toHaveClass("h-5", "w-5");

        rerender(<AvatarDot name="A" size="md" />);
        expect(screen.getByRole("img")).toHaveClass("h-7", "w-7");

        rerender(<AvatarDot name="A" size="lg" />);
        expect(screen.getByRole("img")).toHaveClass("h-9", "w-9");
    });

    it("applies tone classes correctly", () => {
        const { rerender } = render(<AvatarDot name="A" tone="mint" />);
        expect(screen.getByRole("img").className).toContain(
            "pastel-mint-light",
        );

        rerender(<AvatarDot name="A" tone="coral" />);
        expect(screen.getByRole("img").className).toContain(
            "pastel-coral-light",
        );
    });
});
