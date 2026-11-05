import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bubby } from "../src/components/bubby/Bubby";

function layers(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("[data-layer]")).map(
        (el) => el.getAttribute("data-layer") ?? "",
    );
}

describe("Bubby", () => {
    it("shows just the egg and its nest at the egg stages", () => {
        const { container } = render(<Bubby stage={0} />);
        expect(layers(container)).toEqual(["ground", "fx-back", "body", "fx-front"]);
        expect(container.querySelector("svg")?.getAttribute("data-stage")).toBe("egg");
    });

    it("adds face, flippers and accessory slots from Hatchling up", () => {
        const { container } = render(<Bubby stage={2} />);
        expect(layers(container)).toEqual([
            "ground",
            "fx-back",
            "body",
            "flipper-l",
            "flipper-r",
            "face",
            "acc-neck",
            "acc-face",
            "acc-head",
            "acc-hand",
            "fx-front",
        ]);
    });

    it("renders accessories only once Bubby can wear them", () => {
        const { container: egg } = render(<Bubby stage={1} equipped={{ head: "crown" }} />);
        expect(egg.querySelector('[data-layer="acc-head"]')).toBeNull();

        const { container: adult } = render(<Bubby stage={5} equipped={{ head: "crown", neck: "scarf" }} />);
        expect(adult.querySelector('[data-layer="acc-head"]')?.childElementCount).toBe(1);
        expect(adult.querySelector('[data-layer="acc-neck"]')?.childElementCount).toBe(1);
        expect(adult.querySelector('[data-layer="acc-hand"]')?.childElementCount).toBe(0);
    });

    it("labels stage and mood for screen readers", () => {
        render(<Bubby stage={3} mood="sleepy" />);
        expect(screen.getByRole("img", { name: "Bubby, chick, sleepy" })).toBeInTheDocument();
    });

    it("is hidden from screen readers when decorative, and skips fx when tiny", () => {
        const { container } = render(<Bubby stage={5} size="xs" decorative />);
        const svg = container.querySelector("svg")!;
        expect(svg.getAttribute("aria-hidden")).toBe("true");
        expect(layers(container)).not.toContain("fx-front");
        expect(layers(container)).not.toContain("fx-back");
    });

    it("exposes the reaction for CSS and swaps to sparkle eyes on celebrate", () => {
        const { container } = render(<Bubby stage={5} reaction="celebrate" />);
        expect(container.querySelector("svg")?.getAttribute("data-reaction")).toBe("celebrate");
        expect(container.querySelector(".bubby-sparkles")).not.toBeNull();
    });
});
