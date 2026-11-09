import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QuestList } from "../src/components/bubby/QuestList";
import type { Quest } from "../src/lib/bubby/quests";

const quests: Quest[] = [
    { id: "log", label: "Log today", reward: "food", done: true },
    { id: "inbox", label: "Clear your inbox", reward: "exercise", done: false },
];

describe("QuestList", () => {
    it("selects pending quests and disables finished ones", () => {
        const onSelect = vi.fn();
        render(
            <QuestList quests={quests} label="Quests" onSelect={onSelect} />,
        );

        const done = screen.getByRole("button", { name: /Log today/ });
        expect(done).toBeDisabled();
        fireEvent.click(done);
        expect(onSelect).not.toHaveBeenCalled();

        fireEvent.click(
            screen.getByRole("button", { name: /Clear your inbox/ }),
        );
        expect(onSelect).toHaveBeenCalledWith(quests[1]);
    });

    it("disables pending quests that are not selectable right now", () => {
        const onSelect = vi.fn();
        render(
            <QuestList
                quests={quests}
                label="Quests"
                onSelect={onSelect}
                isSelectable={(q) => q.id !== "inbox"}
            />,
        );

        const inbox = screen.getByRole("button", { name: /Clear your inbox/ });
        expect(inbox).toBeDisabled();
        fireEvent.click(inbox);
        expect(onSelect).not.toHaveBeenCalled();
    });
});
