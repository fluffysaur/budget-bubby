import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { SpendPage } from "../src/pages/SpendPage";

// Mock recharts ResponsiveContainer so chart elements render safely in jsdom
vi.mock("recharts", async (importOriginal) => {
    const original = await importOriginal<typeof import("recharts")>();
    return {
        ...original,
        ResponsiveContainer: ({ children }: any) => (
            <div className="recharts-responsive-container" style={{ width: 800, height: 400 }}>
                {children}
            </div>
        ),
    };
});

function renderWithProviders(ui: React.ReactElement, initialEntry = "/spend") {
    return render(
        <QueryClientProvider client={queryClient}>
            <HouseholdProvider>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <Routes>
                        <Route path="/spend" element={ui} />
                    </Routes>
                </MemoryRouter>
            </HouseholdProvider>
        </QueryClientProvider>,
    );
}

describe("SpendPage Component & Sub-Tab Navigation", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders Spend page header and SegmentedTabs with Expenses selected by default", async () => {
        renderWithProviders(<SpendPage />);

        expect(screen.getByRole("heading", { name: "Spend", level: 1 })).toBeInTheDocument();

        const expensesTab = screen.getByRole("tab", { name: /Expenses/i });
        const budgetTab = screen.getByRole("tab", { name: /Budget/i });

        expect(expensesTab).toBeInTheDocument();
        expect(budgetTab).toBeInTheDocument();
        expect(expensesTab).toHaveAttribute("aria-selected", "true");
        expect(budgetTab).toHaveAttribute("aria-selected", "false");

        // Embedded ExpensesPage content is rendered
        await waitFor(() => {
            expect(screen.getByText(/Spendable Remaining/i)).toBeInTheDocument();
            expect(screen.getByPlaceholderText(/Search merchant/i)).toBeInTheDocument();
        });
    });

    it("switches to Budget tab and renders budget waterfall and monthly allocations", async () => {
        renderWithProviders(<SpendPage />);

        const budgetTab = screen.getByRole("tab", { name: /Budget/i });
        fireEvent.click(budgetTab);

        expect(budgetTab).toHaveAttribute("aria-selected", "true");
        expect(screen.getByRole("tab", { name: /Expenses/i })).toHaveAttribute("aria-selected", "false");

        await waitFor(() => {
            expect(screen.getByText(/Budget Waterfall/i)).toBeInTheDocument();
            expect(screen.getAllByText(/Gross Pay/i)[0]).toBeInTheDocument();
            expect(screen.getAllByText(/Disposable Pool/i)[0]).toBeInTheDocument();
        });
    });

    it("respects initialTab prop when set to budget", async () => {
        renderWithProviders(<SpendPage initialTab="budget" />);

        const budgetTab = screen.getByRole("tab", { name: /Budget/i });
        expect(budgetTab).toHaveAttribute("aria-selected", "true");

        await waitFor(() => {
            expect(screen.getByText(/Budget Waterfall/i)).toBeInTheDocument();
        });
    });

    it("respects ?tab=budget query parameter from initial URL", async () => {
        renderWithProviders(<SpendPage />, "/spend?tab=budget");

        const budgetTab = screen.getByRole("tab", { name: /Budget/i });
        expect(budgetTab).toHaveAttribute("aria-selected", "true");

        await waitFor(() => {
            expect(screen.getByText(/Budget Waterfall/i)).toBeInTheDocument();
        });
    });
});
