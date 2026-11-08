import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { PlanPage } from "../src/pages/PlanPage";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { financeService } from "../src/services/financeService";
import { mockFinanceService } from "../src/services/mockFinanceService";

describe("PlanPage Component", () => {
    it("renders all plan sub-tabs with no-scrollbar styling", () => {
        render(
            <MemoryRouter>
                <HouseholdProvider>
                    <PlanPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        expect(
            screen.getByRole("heading", { level: 1, name: "Plan" }),
        ).toBeInTheDocument();

        const tabNav = screen.getByRole("navigation", {
            name: "Navigation Tabs",
        });
        expect(tabNav).toBeInTheDocument();
        // Verify no-scrollbar class is applied to remove horizontal scrollbar
        expect(tabNav.className).toContain("no-scrollbar");

        expect(
            within(tabNav).getByRole("tab", { name: /Goals/i }),
        ).toBeInTheDocument();
        expect(
            within(tabNav).getByRole("tab", { name: /Loans/i }),
        ).toBeInTheDocument();
        expect(
            within(tabNav).getByRole("tab", { name: /Recurring/i }),
        ).toBeInTheDocument();
        expect(
            within(tabNav).getByRole("tab", { name: /Bonus/i }),
        ).toBeInTheDocument();
    });

    afterEach(() => {
        vi.restoreAllMocks();
        mockFinanceService.resetData();
    });

    it("switches sub-tabs when tab buttons are clicked", async () => {
        render(
            <MemoryRouter>
                <HouseholdProvider>
                    <PlanPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        const bonusTab = screen.getByRole("tab", { name: /Bonus/i });
        fireEvent.click(bonusTab);

        expect(bonusTab).toHaveAttribute("aria-selected", "true");
        expect(await screen.findByText("No Bonuses")).toBeInTheDocument();
        expect(
            screen.getAllByRole("button", { name: /log bonus/i }).length,
        ).toBeGreaterThanOrEqual(1);
    });

    it("shows the setup alert and legacy calculator when the bonus log is unavailable", async () => {
        vi.spyOn(financeService, "getBonusEvents").mockResolvedValue({
            available: false,
            events: [],
        });
        render(
            <MemoryRouter initialEntries={["/plan?tab=bonus"]}>
                <HouseholdProvider>
                    <PlanPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        expect(await screen.findByText("Not available")).toBeInTheDocument();
        expect(screen.getByText(/Bonus Splitter/i)).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /log bonus/i }),
        ).not.toBeInTheDocument();
    });

    it("lists Loans last and shows the Under Construction placeholder", () => {
        render(
            <MemoryRouter>
                <HouseholdProvider>
                    <PlanPage />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        const tabNav = screen.getByRole("navigation", {
            name: "Navigation Tabs",
        });
        const tabNames = within(tabNav)
            .getAllByRole("tab")
            .map((t) => t.textContent?.trim());
        expect(tabNames).toEqual(["Goals", "Recurring", "Bonus", "Loans"]);
        expect(
            within(tabNav).getByRole("tab", { name: /Goals/i }),
        ).toHaveAttribute("aria-selected", "true");

        fireEvent.click(within(tabNav).getByRole("tab", { name: /Loans/i }));

        expect(screen.getByText("Under Construction")).toBeInTheDocument();
        expect(
            screen.getByText("Bubby is building something for your loans."),
        ).toBeInTheDocument();
        expect(
            screen.queryByRole("button", { name: /add loan/i }),
        ).not.toBeInTheDocument();
    });
});
