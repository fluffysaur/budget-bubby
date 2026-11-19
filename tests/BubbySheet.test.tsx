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

describe("BubbySheet unhatched egg & Starter Quests", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("shows unhatched egg and Starter Quests instead of daily/weekly quests", () => {
        mockUseBubby.mockReturnValue({
            ...makeBubbyState([makePenguin("m1", "Alex", true)]),
            hatched: false,
            onboardingQuests: [
                {
                    id: "budget",
                    label: "Set up Budget",
                    description: "Set take-home flow and category caps",
                    done: true,
                },
                {
                    id: "account",
                    label: "Add an Account",
                    description: "Track a bank account or balance",
                    done: false,
                },
                {
                    id: "expense",
                    label: "Log First Expense",
                    description: "Add a spend item or check in",
                    done: false,
                },
                {
                    id: "plan",
                    label: "Explore Plan",
                    description: "Check goals, bills, and card statements",
                    done: false,
                },
            ],
            hatch: vi.fn(),
        });

        render(<BubbySheet isOpen onClose={vi.fn()} />);

        expect(screen.getByTestId("bubby-egg")).toHaveAttribute(
            "data-stage",
            "1",
        );
        expect(
            screen.getByRole("list", { name: "Starter quests" }),
        ).toBeInTheDocument();
        expect(screen.getByText("1/4")).toBeInTheDocument();
        expect(screen.queryByTestId("hatch-bubby-btn")).not.toBeInTheDocument();
        expect(
            screen.queryByRole("list", { name: "Today's quests" }),
        ).not.toBeInTheDocument();
    });

    it("opens interactive tap-to-crack HatchStage and calls hatch on the 3rd tap", () => {
        const hatch = vi.fn();
        mockUseBubby.mockReturnValue({
            ...makeBubbyState([
                { ...makePenguin("m1", "Alex", true), hatched: false },
                { ...makePenguin("m2", "Sam", false), hatched: false },
            ]),
            hatched: false,
            onboardingQuests: [
                {
                    id: "budget",
                    label: "Set up Budget",
                    description: "Set your take-home flow and category caps",
                    done: true,
                },
                {
                    id: "account",
                    label: "Add an Account",
                    description: "Track your bank account or balance",
                    done: true,
                },
                {
                    id: "expense",
                    label: "Log First Expense",
                    description: "Add a spend item or check in",
                    done: true,
                },
                {
                    id: "plan",
                    label: "Explore Plan",
                    description: "Check goals, bills, and card statements",
                    done: true,
                },
            ],
            hatch,
        });

        render(<BubbySheet isOpen onClose={vi.fn()} />);

        expect(screen.getAllByTestId("bubby-egg-card")).toHaveLength(2);
        fireEvent.click(screen.getByTestId("hatch-bubby-btn"));

        // Tap-to-crack spotlight appears; 3 taps crack it open
        const eggTarget = screen.getByTestId("hatch-egg-target");
        fireEvent.click(eggTarget);
        expect(hatch).not.toHaveBeenCalled();
        fireEvent.click(eggTarget);
        expect(hatch).not.toHaveBeenCalled();
        fireEvent.click(eggTarget);
        expect(hatch).toHaveBeenCalledTimes(1);
        expect(
            screen.getByRole("heading", { name: "Bubby Hatched!" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("meet-bubby-btn")).toBeInTheDocument();
    });

    it("renders my hatched penguin alongside my partner's unhatched egg", () => {
        mockUseBubby.mockReturnValue({
            ...makeBubbyState([
                { ...makePenguin("m1", "Alex", true), hatched: true },
                { ...makePenguin("m2", "Sam", false), hatched: false },
            ]),
            hatched: true,
        });

        render(<BubbySheet isOpen onClose={vi.fn()} />);

        expect(screen.getAllByTestId("bubby-penguin")).toHaveLength(1);
        expect(screen.getAllByTestId("bubby-egg-card")).toHaveLength(1);
    });
});
