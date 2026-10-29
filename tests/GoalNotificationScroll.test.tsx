import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NotificationCenterPopover } from "../src/components/layout/NotificationCenterPopover";
import { GoalsPage } from "../src/pages/GoalsPage";
import { PlanPage } from "../src/pages/PlanPage";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { AuthProvider } from "../src/context/AuthContext";
import { financeService } from "../src/services/financeService";
import type { SavingsGoal } from "../src/types/finance";

const mockGoals: SavingsGoal[] = [
    {
        id: "goal-wedding-01",
        household_id: "hh-00000000-0001",
        owner_id: null,
        title: "Wedding Fund",
        target_amount: 50000,
        saved_so_far: 50000,
        target_date: "2027-05-01",
        monthly_contribution: 0,
        emoji: "💍",
        status: "achieved",
        created_at: "2026-01-01T00:00:00.000Z",
    },
    {
        id: "goal-reno-02",
        household_id: "hh-00000000-0001",
        owner_id: "mem-00000000-0012", // Rachel's goal
        title: "Renovation Fund",
        target_amount: 80000,
        saved_so_far: 15000,
        target_date: "2027-10-01",
        monthly_contribution: 1000,
        emoji: "🔨",
        status: "behind",
        created_at: "2026-01-01T00:00:00.000Z",
    },
];

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: {
                retry: false,
                gcTime: Infinity,
            },
        },
    });
}

function renderWithProviders(ui: React.ReactElement, initialEntries: string[] = ["/"]) {
    const queryClient = createTestQueryClient();
    return render(
        <QueryClientProvider client={queryClient}>
            <MemoryRouter initialEntries={initialEntries}>
                <AuthProvider initialAuthenticated={true} initialPartner="yijia">
                    <HouseholdProvider defaultPerspective="household">
                        {ui}
                    </HouseholdProvider>
                </AuthProvider>
            </MemoryRouter>
        </QueryClientProvider>
    );
}

describe("Goal Notification Navigation and Scroll", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
        vi.spyOn(financeService, "getGoals").mockResolvedValue(mockGoals);
        vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
        vi.spyOn(financeService, "getCategories").mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe("NotificationCenterPopover - View Goal action", () => {
        it("triggers navigation to /goals?goalId=... and calls onNavigateTab when View Goal is tapped", async () => {
            // Mock getGoals to return behind goal which generates pacing reminder
            vi.spyOn(financeService, "getGoals").mockResolvedValue([mockGoals[1]]);

            const onNavigateTab = vi.fn();

            renderWithProviders(
                <NotificationCenterPopover onNavigateTab={onNavigateTab} />
            );

            // Open notification popover
            const bellBtn = await screen.findByTestId("notification-bell-btn");
            await act(async () => {
                fireEvent.click(bellBtn);
            });

            const popover = screen.getByTestId("notification-center-popover");
            expect(popover).toBeInTheDocument();

            // Find View Goal button
            const viewGoalBtns = await screen.findAllByTestId("reminder-action-view_goals");
            expect(viewGoalBtns.length).toBeGreaterThanOrEqual(1);

            // Tap "View Goal"
            await act(async () => {
                fireEvent.click(viewGoalBtns[0]);
            });

            expect(onNavigateTab).toHaveBeenCalledWith("goals?goalId=goal-reno-02");
        });
    });

    describe("GoalsPage - Deep-linking & Scroll-into-view", () => {
        it("scrolls to the relevant goal card and displays the highlight ring when goalId param is in URL", async () => {
            const scrollIntoViewMock = vi.fn();
            window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

            renderWithProviders(<GoalsPage />, ["/goals?goalId=goal-reno-02"]);

            // Wait for goals to render
            await waitFor(() => {
                expect(screen.getByText("Renovation Fund")).toBeInTheDocument();
            });

            // Target card should have the highlight ring
            await waitFor(() => {
                expect(screen.getByTestId("goal-card-highlight-ring")).toBeInTheDocument();
            });

            // Should have called scrollIntoView with smooth behavior
            await waitFor(() => {
                expect(scrollIntoViewMock).toHaveBeenCalledWith({
                    behavior: "smooth",
                    block: "center",
                });
            });

            // Card container has proper id and testid
            const cardEl = screen.getByTestId("goal-card-goal-reno-02");
            expect(cardEl).toHaveAttribute("id", "goal-card-goal-reno-02");

            // Wait for highlight to gracefully fade out after 3s
            await waitFor(
                () => {
                    expect(screen.queryByTestId("goal-card-highlight-ring")).not.toBeInTheDocument();
                },
                { timeout: 4000 }
            );
        });

        it("automatically switches filter tab to 'all' if the goal would be hidden by 'in_progress' filter", async () => {
            const scrollIntoViewMock = vi.fn();
            window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

            // Target achieved goal (Wedding Fund), but user starts on in_progress filter
            renderWithProviders(<GoalsPage />, ["/goals?goalId=goal-wedding-01"]);

            // Since Wedding Fund is achieved, GoalsPage should ensure it is displayed
            await waitFor(() => {
                expect(screen.getByText("Wedding Fund")).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByTestId("goal-card-highlight-ring")).toBeInTheDocument();
                expect(scrollIntoViewMock).toHaveBeenCalled();
            });
        });

        it("automatically switches perspective to 'household' if target goal belongs to another member", async () => {
            const scrollIntoViewMock = vi.fn();
            window.HTMLElement.prototype.scrollIntoView = scrollIntoViewMock;

            const queryClient = createTestQueryClient();
            render(
                <QueryClientProvider client={queryClient}>
                    <MemoryRouter initialEntries={["/goals?goalId=goal-reno-02"]}>
                        <AuthProvider initialAuthenticated={true} initialPartner="yijia">
                            {/* Start with yijia's personal perspective, but goal-reno-02 is Rachel's */}
                            <HouseholdProvider defaultPerspective="yijia">
                                <GoalsPage />
                            </HouseholdProvider>
                        </AuthProvider>
                    </MemoryRouter>
                </QueryClientProvider>
            );

            // Renovation Fund should be displayed because perspective switched to household
            await waitFor(() => {
                expect(screen.getByText("Renovation Fund")).toBeInTheDocument();
            });

            await waitFor(() => {
                expect(screen.getByTestId("goal-card-highlight-ring")).toBeInTheDocument();
                expect(scrollIntoViewMock).toHaveBeenCalled();
            });
        });
    });

    describe("PlanPage - Sub-tab routing with goalId param", () => {
        it("automatically activates 'goals' subtab when goalId param is present even if initialTab was another tab", async () => {
            renderWithProviders(<PlanPage initialTab="recurring" />, ["/plan?goalId=goal-reno-02"]);

            // GoalsPage should be rendered inside PlanPage
            await waitFor(() => {
                expect(screen.getByText("Renovation Fund")).toBeInTheDocument();
            });
        });
    });
});
