import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { App, AppShell } from "../src/App";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { MemoryRouter } from "react-router-dom";

// Mock recharts ResponsiveContainer so chart elements render safely in jsdom
vi.mock("recharts", async (importOriginal) => {
    const original = await importOriginal<typeof import("recharts")>();
    return {
        ...original,
        ResponsiveContainer: ({ children }: any) => (
            <div
                className="recharts-responsive-container"
                style={{ width: 800, height: 400 }}
            >
                {children}
            </div>
        ),
    };
});

describe("App Integration & Routing", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders header, sidebar, and default Dashboard page", async () => {
        render(<App initialEntries={["/"]} />);

        // Header perspective buttons and badges
        const perspectiveNav = screen.getByRole("navigation", { name: /Perspective Switcher/i });
        expect(within(perspectiveNav).getByRole("button", { name: /Combined Household/i })).toBeInTheDocument();

        // Desktop sidebar navigation
        const sidebarNav = screen.getByRole("navigation", { name: "Sidebar" });
        expect(sidebarNav).toBeInTheDocument();
        expect(within(sidebarNav).getByRole("button", { name: /Home/i })).toBeInTheDocument();
        expect(within(sidebarNav).getByRole("button", { name: /Spend/i })).toBeInTheDocument();
        expect(within(sidebarNav).getByRole("button", { name: /Accounts/i })).toBeInTheDocument();
        expect(within(sidebarNav).getByRole("button", { name: /Plan/i })).toBeInTheDocument();

        // Default Dashboard page renders Net Worth card
        await waitFor(() => {
            expect(screen.getByText(/True Net Worth/i)).toBeInTheDocument();
        });
    });

    it("navigates to /spend and defaults to expenses ledger", async () => {
        render(<App initialEntries={["/spend"]} />);

        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Total Spent/i)).toBeInTheDocument();
            expect(within(main).getByRole("tab", { name: /Expenses/i })).toHaveAttribute("aria-selected", "true");
            expect(within(main).getByRole("tab", { name: /Budget/i })).toHaveAttribute("aria-selected", "false");
        });
    });

    it("navigates to /spend?tab=budget and activates budget sub-tab", async () => {
        render(<App initialEntries={["/spend?tab=budget"]} />);

        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Budget Waterfall/i)).toBeInTheDocument();
            expect(within(main).getByRole("tab", { name: /Budget/i })).toHaveAttribute("aria-selected", "true");
        });
    });

    it("navigates to /budget and renders budget waterfall and monthly allocations", async () => {
        render(<App initialEntries={["/budget"]} />);

        await waitFor(() => {
            expect(screen.getByText(/Budget Waterfall/i)).toBeInTheDocument();
        });
    });

    it("navigates to /expenses and renders expenses ledger and summary cards", async () => {
        render(<App initialEntries={["/expenses"]} />);

        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Total Spent/i)).toBeInTheDocument();
            expect(within(main).getByPlaceholderText(/Search merchant/i)).toBeInTheDocument();
        });
    });

    it("navigates to /accounts, /goals, /loans, and /recurring routes", async () => {
        const { unmount: unmountAccounts } = render(<App initialEntries={["/accounts"]} />);
        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByRole("heading", { name: /Accounts & Net Worth/i })).toBeInTheDocument();
        });
        unmountAccounts();

        const { unmount: unmountGoals } = render(<App initialEntries={["/goals"]} />);
        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Total Target/i)).toBeInTheDocument();
        });
        unmountGoals();

        const { unmount: unmountLoans } = render(<App initialEntries={["/loans"]} />);
        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Prepayment Simulator/i)).toBeInTheDocument();
        });
        unmountLoans();

        const { unmount: unmountRecurring } = render(<App initialEntries={["/recurring"]} />);
        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Active Policies & Schedules/i)).toBeInTheDocument();
        });
        unmountRecurring();
    });

    it("switches financial perspective when header pills are clicked", async () => {
        render(<App initialEntries={["/"]} />);

        const perspectiveNav = screen.getByRole("navigation", { name: /Perspective Switcher/i });
        const yijiaBtn = within(perspectiveNav).getByRole("button", { name: /Yi Jia/i });
        fireEvent.click(yijiaBtn);

        await waitFor(() => {
            expect(yijiaBtn).toHaveAttribute("aria-pressed", "true");
        });

        const householdBtn = within(perspectiveNav).getByRole("button", { name: /Combined/i });
        fireEvent.click(householdBtn);

        await waitFor(() => {
            expect(householdBtn).toHaveAttribute("aria-pressed", "true");
        });
    });

    it("clicking mobile Quick Add FAB opens the Quick Add Expense modal", async () => {
        render(<App initialEntries={["/"]} />);

        // Mobile FAB button
        const mobileNav = screen.getByRole("navigation", { name: /Mobile Navigation/i });
        const fabButton = within(mobileNav).getByRole("button", { name: "Quick Add" });
        expect(fabButton).toBeInTheDocument();

        fireEvent.click(fabButton);

        await waitFor(() => {
            expect(screen.getByRole("dialog")).toBeInTheDocument();
            expect(screen.getByText("Quick Add Expense")).toBeInTheDocument();
        });

        // Close modal
        const closeBtn = screen.getByRole("button", { name: /Close modal/i });
        fireEvent.click(closeBtn);

        await waitFor(() => {
            expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        });
    });

    it("clicking sidebar items navigates to the respective page", async () => {
        render(<App initialEntries={["/"]} />);

        const sidebarNav = screen.getByRole("navigation", { name: "Sidebar" });

        // Click Spend in sidebar
        const spendBtn = within(sidebarNav).getByRole("button", { name: /Spend/i });
        fireEvent.click(spendBtn);

        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Total Spent/i)).toBeInTheDocument();
        });

        // Switch to Budget sub-tab
        const budgetTab = screen.getByRole("tab", { name: /Budget/i });
        fireEvent.click(budgetTab);

        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Budget Waterfall/i)).toBeInTheDocument();
        });
    });

    it("renders correctly with AppShell inside MemoryRouter", async () => {
        render(
            <MemoryRouter initialEntries={["/budget"]}>
                <HouseholdProvider>
                    <AppShell />
                </HouseholdProvider>
            </MemoryRouter>,
        );

        await waitFor(() => {
            const main = screen.getByRole("main");
            expect(within(main).getByText(/Budget Waterfall/i)).toBeInTheDocument();
        });
    });
});
