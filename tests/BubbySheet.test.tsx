import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { BubbySheet } from "../src/components/bubby/BubbySheet";
import type { BubbyPenguin } from "../src/hooks/useBubby";

const mockUseBubby = vi.fn();

vi.mock("../src/hooks/useBubby", () => ({
    useBubby: () => mockUseBubby(),
}));

vi.mock("../src/hooks/useQuestActions", () => ({
    useQuestActions: () => vi.fn(),
    isQuestSelectable: () => false,
}));

vi.mock("../src/contexts/PrivacyContext", () => ({
    usePrivacy: () => ({ isPrivacyMode: false }),
}));

function makePenguin(id: string, name: string, isMe: boolean): BubbyPenguin {
    return {
        member: {
            id,
            display_name: name,
            avatar_url: null,
            role: "member",
        } as BubbyPenguin["member"],
        isMe,
        body: "regular",
        mood: "normal",
        reaction: null,
        scarf: undefined,
        sleepy: false,
        condition: {
            nourishment: 0.7,
            fitness: 0.6,
            body: "regular",
            mood: "normal",
            daysSinceFed: 0,
            fedToday: new Set<string>(),
        },
    };
}

function makeBubbyState(penguins: BubbyPenguin[]) {
    const primary = penguins[0];
    return {
        body: primary.body,
        mood: primary.mood,
        reaction: primary.reaction,
        condition: primary.condition,
        members: penguins.map((p) => p.member),
        dailyQuests: [],
        weeklyQuests: [],
        monthlyQuests: [],
        snacks: [],
        penguins,
        sleepy: false,
        fedToday: new Set<string>(),
        pet: vi.fn(),
    };
}

describe("BubbySheet GrowTips header placement", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("renders 'How it grows' pill in the modal header for solo layout and toggles the popover", () => {
        mockUseBubby.mockReturnValue(
            makeBubbyState([makePenguin("m1", "Alex", true)]),
        );

        render(<BubbySheet isOpen onClose={vi.fn()} />);

        const triggers = screen.getAllByRole("button", {
            name: "How Bubby grows",
        });
        expect(triggers).toHaveLength(1);

        const trigger = triggers[0];
        expect(trigger).toHaveTextContent("How it grows");
        expect(trigger).toHaveAttribute("aria-expanded", "false");

        // Trigger sits in the header alongside the close button, not inside the body
        const closeButton = screen.getByRole("button", { name: "Close modal" });
        expect(closeButton.parentElement).toContainElement(trigger);

        expect(
            screen.queryByText(/clearing inbox, updating balances/i),
        ).not.toBeInTheDocument();

        fireEvent.click(trigger);

        expect(trigger).toHaveAttribute("aria-expanded", "true");
        expect(
            screen.getByRole("heading", { name: "How Bubby grows" }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/Log spend, pet Bubby/i),
        ).toBeInTheDocument();
    });

    it("renders 'How it grows' pill in the modal header for paired layout", () => {
        mockUseBubby.mockReturnValue(
            makeBubbyState([
                makePenguin("m1", "Alex", true),
                makePenguin("m2", "Sam", false),
            ]),
        );

        render(<BubbySheet isOpen onClose={vi.fn()} />);

        const triggers = screen.getAllByRole("button", {
            name: "How Bubby grows",
        });
        expect(triggers).toHaveLength(1);

        const trigger = triggers[0];
        expect(trigger).toHaveTextContent("How it grows");

        const closeButton = screen.getByRole("button", { name: "Close modal" });
        expect(closeButton.parentElement).toContainElement(trigger);
    });
});
