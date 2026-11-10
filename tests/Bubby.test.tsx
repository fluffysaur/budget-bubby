import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Bubby } from "../src/components/bubby/Bubby";

function layers(container: HTMLElement): string[] {
    return Array.from(container.querySelectorAll("[data-layer]")).map(
        (el) => el.getAttribute("data-layer") ?? "",
    );
}

describe("Bubby", () => {
    it("is always a penguin: same layers for every body", () => {
        for (const body of ["regular", "chubby", "lean", "buff"] as const) {
            const { container, unmount } = render(<Bubby body={body} />);
            expect(
                container.querySelector("svg")?.getAttribute("data-body"),
            ).toBe(body);
            expect(layers(container)).toEqual([
                "ground",
                "fx-back",
                "idle",
                "body",
                "flipper-l",
                "flipper-r",
                "face",
                "fx-front",
            ]);
            unmount();
        }
    });

    it.each([
        ["normal", null],
        ["rumbly", "rumble"],
        ["teary", "tears"],
        ["missyou", "sign"],
    ] as const)("draws the %s mood as an overlay only", (mood, overlay) => {
        const { container } = render(<Bubby mood={mood} />);
        const found =
            container
                .querySelector("[data-overlay]")
                ?.getAttribute("data-overlay") ?? null;
        expect(found).toBe(overlay);
    });

    it("never names the mood for screen readers", () => {
        render(<Bubby mood="teary" />);
        expect(screen.getByRole("img", { name: "Bubby" })).toBeInTheDocument();
    });

    it("drops the sign text and fx when tiny, and hides when decorative", () => {
        const { container } = render(
            <Bubby mood="missyou" size="xs" decorative />,
        );
        expect(
            container.querySelector("svg")?.getAttribute("aria-hidden"),
        ).toBe("true");
        expect(container.querySelector("text")).toBeNull();
        expect(layers(container)).not.toContain("fx-front");
    });

    it("a reaction shows the happy face (the reunion after a feed)", () => {
        const { container } = render(<Bubby mood="teary" reaction="reunion" />);
        expect(
            container.querySelector("svg")?.getAttribute("data-reaction"),
        ).toBe("reunion");
        expect(container.querySelector('[data-overlay="tears"]')).toBeNull();
    });
});
