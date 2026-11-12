/**
 * Expense form: Budget | Goal funding, edit mode and custom split.
 * - The Budget | Goal switch sits in the picker header (no scrolling to pick a goal)
 * - Goal pre-selection only when there's no choice (one goal, or opened from a goal)
 * - Edit mode shares the form, without add-only side effects
 */

import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
    within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ExpenseFormModal } from "../src/components/expenses/ExpenseFormModal";
import { financeService } from "../src/services/financeService";
import { mockCategories, mockMembers } from "../src/data/mockSeedData";
import type { Expense, SavingsGoal } from "../src/types/finance";

vi.mock("../src/lib/soundEffects", () => ({
    playChaChingSound: vi.fn(),
    playBudgetWarningSound: vi.fn(),
    playBudgetExceededSound: vi.fn(),
    playSuccessSound: vi.fn(),
    initAudioUnlock: vi.fn(),
}));

function makeGoal(
    id: string,
    title: string,
    overrides: Partial<SavingsGoal> = {},
): SavingsGoal {
    return {
        id,
        household_id: "hh-1",
        title,
        target_amount: 1000,
        saved_so_far: 500,
        target_date: "2027-12-01",
        emoji: "🎯",
        status: "on_track",
        ...overrides,
    };
}

const goals = [
    makeGoal("g1", "Wedding"),
    makeGoal("g2", "Japan Trip"),
    makeGoal("g3", "New Car"),
    makeGoal("g4", "Baby Fund"),
    makeGoal("g5", "Fully Funded Reno", {
        status: "achieved",
        saved_so_far: 1000,
    }),
];

const goalExpense: Expense = {
    id: "exp-goal-1",
    household_id: "hh-1",
    payer_id: mockMembers[0].id,
    category_id: null,
    date: "2026-10-20",
    time: "12:00",
    item: "Venue deposit",
    amount: 500,
    remarks: null,
    is_shared: true,
    split_ratio: 0.5,
    settled: false,
    tags: [],
    goal_id: "g2",
};

function renderForm(
    props: Partial<React.ComponentProps<typeof ExpenseFormModal>> = {},
) {
    return render(
        <ExpenseFormModal
            isOpen
            onClose={vi.fn()}
            categories={mockCategories}
            members={mockMembers}
            goals={goals}
            {...props}
        />,
    );
}

function fillRequired() {
    fireEvent.change(screen.getByPlaceholderText("0.00"), {
        target: { value: "20.00" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
        target: { value: "Thing" },
    });
}

describe("Expense form funding source", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("hides the Budget | Goal switch when there are no goals", () => {
        renderForm({ goals: [] });
        expect(
            screen.queryByRole("tab", { name: /goal/i }),
        ).not.toBeInTheDocument();
        expect(screen.getByText("Category")).toBeInTheDocument();
    });

    it("explains goal funding in an info popover next to the switch", () => {
        renderForm();
        expect(screen.getByLabelText("Goal funding info")).toBeInTheDocument();
    });

    it("lists achieved goals, since they're funded pots you can spend from", () => {
        renderForm();
        fireEvent.click(screen.getByRole("tab", { name: /goal/i }));
        fireEvent.click(screen.getByRole("button", { name: /\+ more/i }));
        expect(
            screen.getByRole("button", { name: /fully funded reno/i }),
        ).toBeInTheDocument();
    });

    it("requires picking a goal when there are several", async () => {
        const addSpy = vi.spyOn(financeService, "addExpense");
        renderForm();
        fillRequired();
        fireEvent.click(screen.getByRole("tab", { name: /goal/i }));

        const goalGroup = screen.getByLabelText("Goal Selection");
        for (const chip of within(goalGroup).getAllByRole("button")) {
            expect(chip).toHaveAttribute("aria-pressed", "false");
        }

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
        });
        expect(
            screen.getByText(/select which savings goal/i),
        ).toBeInTheDocument();
        expect(addSpy).not.toHaveBeenCalled();
    });

    it("pre-selects the goal when there's only one", () => {
        renderForm({ goals: [goals[0]] });
        fireEvent.click(screen.getByRole("tab", { name: /goal/i }));
        expect(
            screen.getByRole("button", { name: /wedding/i }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("restores the picked goal after switching to Budget and back", () => {
        renderForm();
        fireEvent.click(screen.getByRole("tab", { name: /goal/i }));
        fireEvent.click(screen.getByRole("button", { name: /japan trip/i }));
        fireEvent.click(screen.getByRole("tab", { name: /budget/i }));
        expect(screen.getByLabelText("Category Selection")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("tab", { name: /goal/i }));
        expect(
            screen.getByRole("button", { name: /japan trip/i }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("opens with an initial goal picked and visible even beyond the first four chips", async () => {
        const addSpy = vi
            .spyOn(financeService, "addExpense")
            .mockImplementation(
                async (input) =>
                    ({
                        id: "new",
                        household_id: "hh",
                        settled: false,
                        ...input,
                    }) as Expense,
            );
        renderForm({ initialGoalId: "g5" });

        expect(screen.getByRole("tab", { name: /goal/i })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(
            screen.getByRole("button", { name: /fully funded reno/i }),
        ).toHaveAttribute("aria-pressed", "true");

        fillRequired();
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
        });
        await waitFor(() =>
            expect(addSpy).toHaveBeenCalledWith(
                expect.objectContaining({ goal_id: "g5", category_id: null }),
            ),
        );
    });

    it("doesn't open More just because goal funding is on", () => {
        renderForm({ initialGoalId: "g1" });
        expect(screen.getByRole("button", { name: /^more/i })).toHaveAttribute(
            "aria-expanded",
            "false",
        );
    });
});

describe("Expense form edit mode", () => {
    beforeEach(() => {
        localStorage.clear();
    });
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("loads a goal-funded expense with its goal picked", () => {
        renderForm({ expense: goalExpense });
        expect(
            screen.getByRole("heading", { name: "Edit Expense" }),
        ).toBeInTheDocument();
        expect(screen.getByRole("tab", { name: /goal/i })).toHaveAttribute(
            "aria-selected",
            "true",
        );
        expect(
            screen.getByRole("button", { name: /japan trip/i }),
        ).toHaveAttribute("aria-pressed", "true");
    });

    it("requires a category when moving a goal expense to Budget, then clears the goal", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateExpense")
            .mockImplementation(
                async (_id, updates) =>
                    ({ ...goalExpense, ...updates }) as Expense,
            );
        renderForm({ expense: goalExpense });

        fireEvent.click(screen.getByRole("tab", { name: /budget/i }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
        });
        expect(screen.getByText(/pick a category/i)).toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();

        fireEvent.click(
            within(screen.getByLabelText("Category Selection")).getByRole(
                "button",
                { name: /food/i },
            ),
        );
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
        });
        await waitFor(() =>
            expect(updateSpy).toHaveBeenCalledWith(
                "exp-goal-1",
                expect.objectContaining({
                    goal_id: null,
                    category_id: "cat-00000000-0101",
                }),
            ),
        );
    });

    it("skips the celebration event and leaves the remembered split alone", async () => {
        vi.spyOn(financeService, "updateExpense").mockResolvedValue(
            goalExpense,
        );
        const onUpdated = vi.fn();
        const eventSpy = vi.fn();
        window.addEventListener("expenseAdded", eventSpy);
        localStorage.setItem("budget_bubby_last_split_v1", "personal");

        renderForm({ expense: goalExpense, onExpenseUpdated: onUpdated });
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
        });

        await waitFor(() => expect(onUpdated).toHaveBeenCalled());
        expect(eventSpy).not.toHaveBeenCalled();
        expect(localStorage.getItem("budget_bubby_last_split_v1")).toBe(
            "personal",
        );
        window.removeEventListener("expenseAdded", eventSpy);
    });

    it("opens More for a custom split and keeps the ratio on save", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateExpense")
            .mockResolvedValue(goalExpense);
        renderForm({ expense: { ...goalExpense, split_ratio: 0.7 } });

        expect(screen.getByRole("button", { name: /^more/i })).toHaveAttribute(
            "aria-expanded",
            "true",
        );
        expect(screen.getByTestId("expense-more-summary")).toHaveTextContent(
            "Shared 30/70",
        );
        expect(screen.getByLabelText(/partner's share/i)).toHaveValue("0.7");

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Save$/ }));
        });
        await waitFor(() =>
            expect(updateSpy).toHaveBeenCalledWith(
                "exp-goal-1",
                expect.objectContaining({ split_ratio: 0.7 }),
            ),
        );
    });
});

describe("Expense form custom split (add mode)", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("saves a custom partner share chosen on the slider", async () => {
        const addSpy = vi
            .spyOn(financeService, "addExpense")
            .mockImplementation(
                async (input) =>
                    ({
                        id: "new",
                        household_id: "hh",
                        settled: false,
                        ...input,
                    }) as Expense,
            );
        renderForm({ defaultShared: true });
        fillRequired();

        fireEvent.click(screen.getByRole("button", { name: /^more/i }));
        fireEvent.change(screen.getByLabelText(/partner's share/i), {
            target: { value: "0.25" },
        });

        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^Add$/ }));
        });
        await waitFor(() =>
            expect(addSpy).toHaveBeenCalledWith(
                expect.objectContaining({ is_shared: true, split_ratio: 0.25 }),
            ),
        );
    });
});
