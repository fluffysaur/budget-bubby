import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AvatarDot, AvatarDotGroup } from "../src/components/ui/AvatarDot";

describe("AvatarDot", () => {
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
        expect(screen.getByRole("img").className).toContain("pastel-mint-light");

        rerender(<AvatarDot name="A" tone="coral" />);
        expect(screen.getByRole("img").className).toContain("pastel-coral-light");
    });
});

describe("AvatarDotGroup", () => {
    const members = [
        { id: "1", name: "Rachel", avatarUrl: "👩" },
        { id: "2", name: "Yi Jia", avatarUrl: "👨" },
        { id: "3", name: "Guest", avatarUrl: "👤" },
    ];

    it("renders group of avatars up to max count", () => {
        render(
            <AvatarDotGroup
                members={members}
                max={2}
                label="Shared 50/50"
            />,
        );

        expect(screen.getByText("👩")).toBeInTheDocument();
        expect(screen.getByText("👨")).toBeInTheDocument();
        expect(screen.getByText("+1")).toBeInTheDocument();
        expect(screen.getByText("Shared 50/50")).toBeInTheDocument();
    });

    it("renders accessible group aria-label", () => {
        render(<AvatarDotGroup members={members.slice(0, 2)} />);
        const group = screen.getByRole("group", { name: "Rachel, Yi Jia" });
        expect(group).toBeInTheDocument();
    });
});
