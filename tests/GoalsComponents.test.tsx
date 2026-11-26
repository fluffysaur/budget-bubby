/**
 * Comprehensive Unit & Integration Tests for Task 10:
 * Savings Goals & Milestone Tracker
 * - GoalCard
 * - AddEditGoalModal
 * - GoalsPage
 */

import {
    render,
    screen,
    fireEvent,
    waitFor,
    cleanup,
    within,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { GoalCard } from "../src/components/goals/GoalCard";
import { AddEditGoalModal } from "../src/components/goals/AddEditGoalModal";
import { GoalsPage } from "../src/pages/GoalsPage";
import { financeService } from "../src/services/financeService";
import { formatSGD } from "../src/lib/currency";
import type { SavingsGoal } from "../src/types/finance";
import { makePlan } from "./helpers/roadmapFixtures";

const WEDDING_CARD = "goal-card-goal-wedding-01";
const HDB_CARD = "goal-card-goal-hdb-02";
const RENO_CARD = "goal-card-goal-reno-03";

function renderGoalsPage() {
    return render(
        <MemoryRouter>
            <HouseholdProvider>
                <GoalsPage />
            </HouseholdProvider>
        </MemoryRouter>,
    );
}

const sampleAchievedGoal: SavingsGoal = {
    id: "goal-wedding-01",
    household_id: "hh-01",
    owner_id: null,
    title: "Wedding Fund",
    target_amount: 55000.0,
    target_date: "2027-05-01",
    emoji: "💍",
    status: "achieved",
    created_at: "2026-01-01T00:00:00.000Z",
};

const sampleOnTrackGoal: SavingsGoal = {
    id: "goal-hdb-02",
    household_id: "hh-01",
    owner_id: null,
    title: "HDB Down Payment",
    target_amount: 190000.0,
    target_date: "2027-07-01",
    emoji: "🏠",
    status: "on_track",
    created_at: "2026-01-01T00:00:00.000Z",
};

const sampleBehindGoal: SavingsGoal = {
    id: "goal-reno-03",
    household_id: "hh-01",
    owner_id: null,
    title: "Renovation Fund",
    target_amount: 90000.0,
    target_date: "2027-09-01",
    emoji: "🔨",
    status: "on_track",
    created_at: "2026-01-01T00:00:00.000Z",
};

describe("GoalCard Component", () => {
    const hdbPlan = makePlan(
        {
            stillNeeded: 190000,
            fundedToday: 100000,
            progress: 100000 / 190000,
            monthsLeft: 8,
            fillMonth: "2027-05",
        },
        { id: sampleOnTrackGoal.id, title: "HDB Down Payment" },
    );
    const renoPlan = makePlan(
        {
            status: "short",
            stillNeeded: 90000,
            fundedToday: 10000,
            progress: 10000 / 90000,
            shortPerMonth: 919.2,
            monthsLeft: 10,
        },
        { id: sampleBehindGoal.id, title: "Renovation Fund" },
    );

    it("renders emoji, title, Left to Fill and the breakdown amounts", () => {
        render(<GoalCard goal={sampleOnTrackGoal} plan={hdbPlan} />);

        expect(screen.getByText("🏠")).toBeInTheDocument();
        expect(screen.getByText("HDB Down Payment")).toBeInTheDocument();

        // Left to Fill = stillNeeded - fundedToday, "of <target>"
        expect(screen.getByText("Left to Fill")).toBeInTheDocument();
        expect(screen.getByText(formatSGD(90000))).toBeInTheDocument();
        expect(screen.getByText(/^of/)).toHaveTextContent(formatSGD(190000.0));

        fireEvent.click(screen.getByRole("button", { name: /breakdown/i }));
        expect(screen.getByText("Target Amount")).toBeInTheDocument();
        expect(screen.getByText("Covered Today")).toBeInTheDocument();
        expect(screen.getByText(formatSGD(100000))).toBeInTheDocument();
        expect(screen.getByText("Goal Spend")).toBeInTheDocument();
        expect(screen.getByText("Pace")).toBeInTheDocument();
        expect(screen.getByText("Fills May 2027")).toBeInTheDocument();
    });

    it("shows goal spend in the breakdown without changing Left to Fill", () => {
        const mockExpense = {
            id: "exp-goal-1",
            household_id: "hh-1",
            payer_id: "user-1",
            category_id: null,
            date: "2026-10-15",
            item: "Renovation deposit",
            amount: 15000.0,
            is_shared: true,
            split_ratio: 0.5,
            settled: false,
            goal_id: sampleOnTrackGoal.id,
        };

        render(
            <GoalCard
                goal={sampleOnTrackGoal}
                plan={hdbPlan}
                linkedExpenses={[mockExpense]}
            />,
        );
        fireEvent.click(screen.getByRole("button", { name: /breakdown/i }));

        // Goal spend: 15,000 (appears in the breakdown and linked expenses list)
        expect(screen.getAllByText(formatSGD(15000.0)).length).toBeGreaterThan(
            0,
        );
        expect(screen.getByText(formatSGD(90000))).toBeInTheDocument();
    });

    it("renders accessible progress bar with the plan's percentage", () => {
        render(<GoalCard goal={sampleOnTrackGoal} plan={hdbPlan} />);

        // 100,000 / 190,000 = 52.6% -> 53%
        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toHaveAttribute("aria-valuenow", "53");
        expect(screen.getByText("53%")).toBeInTheDocument();
    });

    it("renders 100% progress and Target for a done goal", () => {
        render(<GoalCard goal={sampleAchievedGoal} />);

        const progressBar = screen.getByRole("progressbar");
        expect(progressBar).toHaveAttribute("aria-valuenow", "100");
        expect(screen.getByText("100%")).toBeInTheDocument();
        expect(screen.getByText("Target")).toBeInTheDocument();
        expect(screen.queryByText("Left to Fill")).not.toBeInTheDocument();
    });

    it("renders status badges from the plan: Done, Covered, On Track, Short, Paid for?", () => {
        const { rerender } = render(<GoalCard goal={sampleAchievedGoal} />);
        expect(screen.getAllByText("Done").length).toBeGreaterThanOrEqual(1);

        rerender(
            <GoalCard
                goal={sampleOnTrackGoal}
                plan={makePlan({ status: "funded" })}
            />,
        );
        expect(screen.getByText("Covered")).toBeInTheDocument();

        rerender(<GoalCard goal={sampleOnTrackGoal} plan={hdbPlan} />);
        expect(screen.getByText("On Track")).toBeInTheDocument();

        rerender(<GoalCard goal={sampleBehindGoal} plan={renoPlan} />);
        expect(screen.getByText("Short")).toBeInTheDocument();

        rerender(
            <GoalCard
                goal={sampleBehindGoal}
                plan={makePlan({ status: "overdue", monthsLeft: 0 })}
            />,
        );
        expect(screen.getByText("Paid for?")).toBeInTheDocument();
    });

    it("shows the monthly shortfall to the cent in the Pace cell when short", () => {
        render(<GoalCard goal={sampleBehindGoal} plan={renoPlan} />);
        fireEvent.click(screen.getByRole("button", { name: /breakdown/i }));

        expect(screen.getByText("Short S$919.20/mo")).toBeInTheDocument();
    });

    it("prompts to mark an overdue goal done", () => {
        const onMarkDone = vi.fn();
        render(
            <GoalCard
                goal={sampleBehindGoal}
                plan={makePlan({ status: "overdue", monthsLeft: 0 })}
                onMarkDone={onMarkDone}
            />,
        );

        expect(screen.getByText(/Paid for\? Mark it done\./)).toBeVisible();
        expect(screen.getByText("Date passed")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Mark Done" }));
        expect(onMarkDone).toHaveBeenCalledWith(sampleBehindGoal);
    });

    it("displays target date and remaining months countdown", () => {
        render(<GoalCard goal={sampleOnTrackGoal} plan={hdbPlan} />);

        expect(screen.getByText(/2027/)).toBeInTheDocument();
        expect(screen.getByText("8 mos left")).toBeInTheDocument();

        cleanup();
        render(
            <GoalCard
                goal={sampleOnTrackGoal}
                plan={makePlan({ monthsLeft: 1 })}
            />,
        );
        expect(screen.getByText("1 mo left")).toBeInTheDocument();
    });

    it("fires onEdit, onSpendFromGoal and onMarkDone callbacks", () => {
        const onEdit = vi.fn();
        const onSpend = vi.fn();
        const onMarkDone = vi.fn();

        render(
            <GoalCard
                goal={sampleOnTrackGoal}
                plan={hdbPlan}
                onEdit={onEdit}
                onSpendFromGoal={onSpend}
                onMarkDone={onMarkDone}
            />,
        );

        fireEvent.click(
            screen.getByRole("button", { name: /edit hdb down payment/i }),
        );
        expect(onEdit).toHaveBeenCalledWith(sampleOnTrackGoal);

        fireEvent.click(
            screen.getByRole("button", {
                name: "+ Spend from HDB Down Payment",
            }),
        );
        expect(onSpend).toHaveBeenCalledWith(sampleOnTrackGoal);

        fireEvent.click(
            screen.getByRole("button", {
                name: "Mark HDB Down Payment done",
            }),
        );
        expect(onMarkDone).toHaveBeenCalledWith(sampleOnTrackGoal);
        expect(
            screen.queryByRole("button", { name: /deposit/i }),
        ).not.toBeInTheDocument();
    });

    it("offers Reopen instead of Done for a done goal", () => {
        const onReopen = vi.fn();
        render(<GoalCard goal={sampleAchievedGoal} onReopen={onReopen} />);

        expect(
            screen.queryByRole("button", { name: /Mark Wedding Fund done/ }),
        ).not.toBeInTheDocument();
        fireEvent.click(
            screen.getByRole("button", { name: "Reopen Wedding Fund" }),
        );
        expect(onReopen).toHaveBeenCalledWith(sampleAchievedGoal);
    });
});

describe("AddEditGoalModal Component", () => {
    it("does not render when isOpen is false", () => {
        render(<AddEditGoalModal isOpen={false} onClose={() => {}} />);
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    it("renders in create mode with empty form and emoji selector presets", () => {
        render(<AddEditGoalModal isOpen={true} onClose={() => {}} />);

        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { name: /New Savings Goal/i }),
        ).toBeInTheDocument();

        // Suggested tags (label and emoji only)
        const templates = within(
            screen.getByRole("group", { name: "Suggested tags" }),
        ).getAllByRole("button");
        expect(templates.map((b) => b.getAttribute("aria-label"))).toEqual([
            "Wedding",
            "Housing",
            "Child",
            "Education",
            "Travel",
            "Car",
        ]);
    });

    it("templates replace only an empty or template title", () => {
        render(<AddEditGoalModal isOpen={true} onClose={() => {}} />);
        const title = screen.getByLabelText(/Goal Title/i);
        fireEvent.click(screen.getByRole("button", { name: "Wedding" }));
        fireEvent.click(screen.getByRole("button", { name: "Travel" }));
        expect(title).toHaveValue("Travel");
        fireEvent.change(title, { target: { value: "Japan trip" } });
        fireEvent.click(screen.getByRole("button", { name: "Car" }));
        expect(title).toHaveValue("Japan trip");
        expect(screen.getByRole("button", { name: "Car" })).toHaveAttribute(
            "aria-pressed",
            "true",
        );
    });

    it("adds free-form tags and removes them", async () => {
        const addGoalSpy = vi
            .spyOn(financeService, "addGoal")
            .mockResolvedValueOnce({ ...sampleOnTrackGoal, id: "g-tags" });
        render(<AddEditGoalModal isOpen={true} onClose={() => {}} />);

        const tagInput = screen.getByLabelText("Add tag");
        fireEvent.change(tagInput, { target: { value: "BTO flat" } });
        fireEvent.keyDown(tagInput, { key: "Enter" });
        fireEvent.change(tagInput, { target: { value: "bto FLAT" } });
        fireEvent.keyDown(tagInput, { key: "Enter" });
        fireEvent.change(tagInput, { target: { value: "Reno" } });
        fireEvent.keyDown(tagInput, { key: "Enter" });
        fireEvent.click(screen.getByRole("button", { name: "Remove Reno" }));
        fireEvent.click(screen.getByRole("button", { name: "Housing" }));

        fireEvent.change(screen.getByLabelText(/^Target \*/i), {
            target: { value: "50000" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Create/i }));

        await waitFor(() =>
            expect(addGoalSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    title: "Housing",
                    emoji: "🏠",
                    tags: ["BTO flat", "Housing"],
                }),
            ),
        );
        addGoalSpy.mockRestore();
    });

    it("creates a buffer sized from average spending", async () => {
        const addGoalSpy = vi
            .spyOn(financeService, "addGoal")
            .mockResolvedValueOnce({ ...sampleOnTrackGoal, id: "g-buf" });
        render(
            <AddEditGoalModal
                isOpen={true}
                onClose={() => {}}
                averageMonthlySpend={2500}
            />,
        );

        fireEvent.click(screen.getByRole("radio", { name: /Buffer/ }));
        expect(screen.getByLabelText(/Goal Title/i)).toHaveValue("Buffer");
        expect(screen.getByLabelText(/^Target \*/i)).toHaveValue(15000);
        expect(screen.queryByLabelText("Add tag")).toBeNull();
        expect(screen.queryByText("Use CPF OA")).toBeNull();

        fireEvent.change(screen.getByLabelText(/Months of spending/i), {
            target: { value: "3" },
        });
        expect(screen.getByLabelText(/^Target \*/i)).toHaveValue(7500);
        fireEvent.click(screen.getByRole("button", { name: /Create/i }));

        await waitFor(() =>
            expect(addGoalSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    goal_type: "buffer",
                    buffer_months: 3,
                    target_amount: 7500,
                    tags: [],
                    use_cpf_oa: false,
                }),
            ),
        );
        addGoalSpy.mockRestore();
    });

    it("hides the buffer type once the household has one", () => {
        render(
            <AddEditGoalModal isOpen={true} onClose={() => {}} hasBufferGoal />,
        );
        expect(
            screen.queryByRole("radiogroup", { name: "Goal type" }),
        ).toBeNull();
    });

    it("refreshes a buffer target from today's average", () => {
        render(
            <AddEditGoalModal
                isOpen={true}
                onClose={() => {}}
                averageMonthlySpend={3000}
                goal={{
                    ...sampleOnTrackGoal,
                    title: "Buffer",
                    goal_type: "buffer",
                    buffer_months: 4,
                    target_amount: 8000,
                }}
            />,
        );
        const target = screen.getByLabelText(/^Target \*/i);
        expect(target).toHaveValue(8000);
        fireEvent.click(screen.getByRole("button", { name: /Refresh target/ }));
        expect(target).toHaveValue(12000);
    });

    it("validates required fields before submitting", async () => {
        render(<AddEditGoalModal isOpen={true} onClose={() => {}} />);

        const submitBtn = screen.getByRole("button", { name: /Create/i });
        fireEvent.click(submitBtn);

        // Shows validation error
        await waitFor(() => {
            expect(screen.getByText(/Add a title/i)).toBeInTheDocument();
        });
    });

    it("submits new goal with valid data via financeService.addGoal", async () => {
        const addGoalSpy = vi
            .spyOn(financeService, "addGoal")
            .mockResolvedValueOnce({
                ...sampleOnTrackGoal,
                id: "new-goal-123",
            });
        const onCloseMock = vi.fn();
        const onGoalSavedMock = vi.fn();

        render(
            <AddEditGoalModal
                isOpen={true}
                onClose={onCloseMock}
                onGoalSaved={onGoalSavedMock}
            />,
        );

        // A template sets the emoji and title, never an amount
        fireEvent.click(screen.getByRole("button", { name: "Child" }));
        expect(screen.getByLabelText(/Goal Title/i)).toHaveValue("Child");
        expect(screen.getByLabelText(/^Target \*/i)).toHaveValue(null);

        // Fill form
        fireEvent.change(screen.getByLabelText(/Goal Title/i), {
            target: { value: "Baby Fund" },
        });
        fireEvent.change(screen.getByLabelText(/^Target \*/i), {
            target: { value: "30000" },
        });
        expect(screen.queryByLabelText(/Saved/i)).toBeNull();
        fireEvent.change(screen.getByLabelText(/Target Date/i), {
            target: { value: "2028-12-31" },
        });
        expect(screen.queryByLabelText(/Monthly/i)).toBeNull();

        // Submit
        fireEvent.click(screen.getByRole("button", { name: /Create/i }));

        await waitFor(() => {
            expect(addGoalSpy).toHaveBeenCalledTimes(1);
            expect(addGoalSpy).toHaveBeenCalledWith(
                expect.objectContaining({
                    emoji: "👶",
                    title: "Baby Fund",
                    target_amount: 30000,
                    tags: ["Child"],
                    goal_type: "standard",
                }),
            );
            expect(onGoalSavedMock).toHaveBeenCalledTimes(1);
            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });

        addGoalSpy.mockRestore();
    });

    it("renders in edit mode and updates goal via financeService.updateGoal", async () => {
        const updateGoalSpy = vi
            .spyOn(financeService, "updateGoal")
            .mockResolvedValueOnce({
                ...sampleOnTrackGoal,
                target_amount: 200000,
            });
        const onCloseMock = vi.fn();
        const onGoalSavedMock = vi.fn();

        render(
            <AddEditGoalModal
                isOpen={true}
                goal={sampleOnTrackGoal}
                onClose={onCloseMock}
                onGoalSaved={onGoalSavedMock}
            />,
        );

        expect(
            screen.getByRole("heading", { name: /Edit Savings Goal/i }),
        ).toBeInTheDocument();

        // Verify prefilled values
        const titleInput = screen.getByLabelText(
            /Goal Title/i,
        ) as HTMLInputElement;
        expect(titleInput.value).toBe("HDB Down Payment");

        // Update target amount
        fireEvent.change(screen.getByLabelText(/^Target \*/i), {
            target: { value: "200000" },
        });

        // Submit update
        fireEvent.click(screen.getByRole("button", { name: /Save/i }));

        await waitFor(() => {
            expect(updateGoalSpy).toHaveBeenCalledWith(
                sampleOnTrackGoal.id,
                expect.objectContaining({
                    target_amount: 200000,
                }),
            );
            expect(onGoalSavedMock).toHaveBeenCalledTimes(1);
            expect(onCloseMock).toHaveBeenCalledTimes(1);
        });

        updateGoalSpy.mockRestore();
    });

    it("saves CPF OA funding with an optional cap", async () => {
        const updateGoalSpy = vi
            .spyOn(financeService, "updateGoal")
            .mockResolvedValue(sampleOnTrackGoal);

        render(
            <AddEditGoalModal
                isOpen={true}
                goal={sampleOnTrackGoal}
                onClose={() => {}}
            />,
        );

        const toggle = screen.getByRole("switch", { name: "Use CPF OA" });
        expect(toggle).toHaveAttribute("aria-checked", "false");
        expect(screen.queryByLabelText("Up to")).toBeNull();

        fireEvent.click(toggle);
        expect(
            screen.getByRole("link", { name: "Check CPF limits" }),
        ).toHaveAttribute("rel", "noopener noreferrer");
        fireEvent.change(screen.getByLabelText("Up to"), {
            target: { value: "50000.46" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Save/i }));

        await waitFor(() => {
            expect(updateGoalSpy).toHaveBeenCalledWith(
                sampleOnTrackGoal.id,
                expect.objectContaining({
                    use_cpf_oa: true,
                    cpf_oa_cap: 50000.46,
                }),
            );
        });

        updateGoalSpy.mockRestore();
    });

    it("closes on escape key or cancel button", () => {
        const onCloseMock = vi.fn();
        render(<AddEditGoalModal isOpen={true} onClose={onCloseMock} />);

        fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
        expect(onCloseMock).toHaveBeenCalledTimes(1);

        fireEvent.keyDown(window, { key: "Escape" });
        expect(onCloseMock).toHaveBeenCalledTimes(2);
    });
});

describe("GoalsPage Integration", () => {
    const mockGoals: SavingsGoal[] = [
        sampleAchievedGoal,
        sampleOnTrackGoal,
        sampleBehindGoal,
    ];

    beforeEach(() => {
        vi.spyOn(financeService, "getGoals").mockResolvedValue(mockGoals);
    });

    it("loads goals and renders the roadmap card instead of summary stat cards", async () => {
        renderGoalsPage();

        await waitFor(() => {
            expect(screen.getByTestId("roadmap-card")).toBeInTheDocument();
        });
        expect(screen.getByTestId("roadmap-verdict")).toBeInTheDocument();
        expect(
            screen.getByTestId(`goal-card-${sampleOnTrackGoal.id}`),
        ).toBeInTheDocument();
        expect(screen.queryByText("Monthly Pace")).not.toBeInTheDocument();
        expect(screen.queryByText("Total Saved")).not.toBeInTheDocument();
    });

    it("filters goals using Active, Done and All tabs with Active as default", async () => {
        renderGoalsPage();

        await waitFor(() => {
            expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        });

        const filterNav = screen.getByRole("navigation", {
            name: "Goals status filter",
        });
        const tabs = within(filterNav).getAllByRole("tab");
        expect(
            tabs.map((t) => t.textContent?.replace(/\d+$/, "").trim()),
        ).toEqual(["Active", "Done", "All"]);

        const activeTab = within(filterNav).getByRole("tab", {
            name: /Active/i,
        });
        const doneTab = within(filterNav).getByRole("tab", { name: /Done/i });
        const allTab = within(filterNav).getByRole("tab", { name: /All/i });

        // Active is selected by default: Wedding (achieved) is hidden; HDB and Reno visible
        expect(activeTab).toHaveAttribute("aria-selected", "true");
        expect(screen.queryByTestId(WEDDING_CARD)).not.toBeInTheDocument();
        expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        expect(screen.getByTestId(RENO_CARD)).toBeInTheDocument();

        // Click "Done" tab
        fireEvent.click(doneTab);
        expect(doneTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByTestId(WEDDING_CARD)).toBeInTheDocument();
        expect(screen.queryByTestId(HDB_CARD)).not.toBeInTheDocument();
        expect(screen.queryByTestId(RENO_CARD)).not.toBeInTheDocument();

        // Click "All" tab
        fireEvent.click(allTab);
        expect(allTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByTestId(WEDDING_CARD)).toBeInTheDocument();
        expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        expect(screen.getByTestId(RENO_CARD)).toBeInTheDocument();

        // Click "Active" tab
        fireEvent.click(activeTab);
        expect(activeTab).toHaveAttribute("aria-selected", "true");
        expect(screen.queryByTestId(WEDDING_CARD)).not.toBeInTheDocument();
        expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        expect(screen.getByTestId(RENO_CARD)).toBeInTheDocument();
    });

    it('opens AddEditGoalModal when "+ New Goal" button is clicked and refreshes upon creation', async () => {
        const addSpy = vi
            .spyOn(financeService, "addGoal")
            .mockResolvedValueOnce({
                id: "new-honeymoon",
                household_id: "hh-01",
                owner_id: null,
                title: "Japan Trip",
                target_amount: 8000,
                target_date: "2027-11-01",
                emoji: "✈️",
                status: "on_track",
            });

        const getGoalsSpy = vi.spyOn(financeService, "getGoals");

        render(
            <MemoryRouter>
                <HouseholdProvider>
                    <GoalsPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        });

        // Click "+ New Goal"
        fireEvent.click(screen.getByRole("button", { name: /\+ New Goal/i }));

        // Modal opens
        expect(
            screen.getByRole("heading", { name: /New Savings Goal/i }),
        ).toBeInTheDocument();

        // Fill and submit
        fireEvent.change(screen.getByLabelText(/Goal Title/i), {
            target: { value: "Japan Trip" },
        });
        fireEvent.change(screen.getByLabelText(/^Target \*/i), {
            target: { value: "8000" },
        });
        fireEvent.change(screen.getByLabelText(/Target Date/i), {
            target: { value: "2027-11-01" },
        });
        fireEvent.click(screen.getByRole("button", { name: /Create/i }));

        await waitFor(() => {
            expect(addSpy).toHaveBeenCalled();
            // Should have re-fetched goals
            expect(getGoalsSpy).toHaveBeenCalledTimes(2);
        });

        addSpy.mockRestore();
    });

    it("marks a goal done after confirmation", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateGoal")
            .mockResolvedValueOnce({
                ...sampleOnTrackGoal,
                status: "achieved",
            });
        renderGoalsPage();

        await waitFor(() => {
            expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        });
        fireEvent.click(
            screen.getByRole("button", {
                name: "Mark HDB Down Payment done",
            }),
        );

        expect(await screen.findByText("Mark Done?")).toBeInTheDocument();
        expect(updateSpy).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Mark Done" }));

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(sampleOnTrackGoal.id, {
                status: "achieved",
            });
        });
    });

    it("reopens a done goal as on_track", async () => {
        const updateSpy = vi
            .spyOn(financeService, "updateGoal")
            .mockResolvedValueOnce({
                ...sampleAchievedGoal,
                status: "on_track",
            });
        renderGoalsPage();

        await waitFor(() => {
            expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        });
        fireEvent.click(screen.getByRole("tab", { name: /Done/i }));
        await waitFor(() => {
            expect(screen.getByTestId(WEDDING_CARD)).toBeInTheDocument();
        });
        fireEvent.click(
            screen.getByRole("button", { name: "Reopen Wedding Fund" }),
        );

        await waitFor(() => {
            expect(updateSpy).toHaveBeenCalledWith(sampleAchievedGoal.id, {
                status: "on_track",
            });
        });
    });

    it("renders empty state when no goals exist", async () => {
        vi.spyOn(financeService, "getGoals").mockResolvedValueOnce([]);

        render(
            <MemoryRouter>
                <HouseholdProvider>
                    <GoalsPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        await waitFor(() => {
            expect(screen.getAllByText(/No Goals/i).length).toBeGreaterThan(0);
        });

        expect(
            screen.getByText("Add a goal to start tracking savings progress."),
        ).toBeInTheDocument();
        expect(
            screen.getAllByRole("button", { name: /Add Goal/i }).length,
        ).toBeGreaterThan(0);
    });

    it("renders view-specific empty state on Active tab when only achieved goals exist", async () => {
        vi.spyOn(financeService, "getGoals").mockResolvedValueOnce([
            sampleAchievedGoal,
        ]);

        renderGoalsPage();

        await waitFor(() => {
            expect(
                screen.getByText("No goals found in this view."),
            ).toBeInTheDocument();
        });
        expect(
            screen.queryByText(
                "Add a goal to start tracking savings progress.",
            ),
        ).not.toBeInTheDocument();
    });

    it("renders goals sorted by target_date with earliest first", async () => {
        vi.spyOn(financeService, "getGoals").mockResolvedValueOnce([
            sampleBehindGoal, // 2027-09-01
            sampleAchievedGoal, // 2027-05-01
            sampleOnTrackGoal, // 2027-07-01
        ]);

        renderGoalsPage();

        await waitFor(() => {
            expect(screen.getByTestId(HDB_CARD)).toBeInTheDocument();
        });

        const activeCards = screen.getAllByTestId(/^goal-card-goal-/);
        expect(activeCards.map((el) => el.getAttribute("data-testid"))).toEqual(
            [HDB_CARD, RENO_CARD],
        );

        fireEvent.click(screen.getByRole("tab", { name: /All/i }));
        await waitFor(() => {
            expect(screen.getByTestId(WEDDING_CARD)).toBeInTheDocument();
        });

        const allCards = screen.getAllByTestId(/^goal-card-goal-/);
        expect(allCards.map((el) => el.getAttribute("data-testid"))).toEqual([
            WEDDING_CARD,
            HDB_CARD,
            RENO_CARD,
        ]);
    });
});
