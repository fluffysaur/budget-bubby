import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QuestProgressBars } from "../src/components/bubby/QuestProgressBars";
import type { Quest } from "../src/lib/bubby/quests";

const q = (id: Quest["id"], done: boolean): Quest => ({
    id,
    label: id,
    reward: "food",
    done,
});

describe("QuestProgressBars", () => {
    it("fills in proportion to done over total and shows the count", () => {
        render(
            <QuestProgressBars
                tiers={[
                    {
                        label: "Today",
                        quests: [
                            q("log", true),
                            q("pet", false),
                            q("inbox", true),
                        ],
                    },
                ]}
            />,
        );
        const bar = screen.getByRole("progressbar", {
            name: "Today: 2 of 3 done",
        });
        expect(bar).toHaveAttribute("aria-valuenow", "67");
        expect(screen.getByText("2/3")).toBeInTheDocument();
    });

    it("keeps the ok tone when a tier is complete (not the over-budget red)", () => {
        const { container } = render(
            <QuestProgressBars
                tiers={[{ label: "Week", quests: [q("balances", true)] }]}
            />,
        );
        expect(container.querySelector(".bg-\\(--tone-ok\\)")).not.toBeNull();
        expect(container.querySelector(".bg-\\(--tone-over\\)")).toBeNull();
    });

    it("leaves out empty tiers, and renders nothing when all are empty", () => {
        const { container, rerender } = render(
            <QuestProgressBars
                tiers={[
                    { label: "Today", quests: [q("log", false)] },
                    { label: "Month", quests: [] },
                ]}
            />,
        );
        expect(
            screen.queryByRole("progressbar", { name: /^Month/ }),
        ).toBeNull();
        rerender(
            <QuestProgressBars tiers={[{ label: "Month", quests: [] }]} />,
        );
        expect(container).toBeEmptyDOMElement();
    });
});
