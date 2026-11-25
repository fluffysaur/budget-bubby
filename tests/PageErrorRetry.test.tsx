import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { LazyMotion, domAnimation } from "motion/react";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { AuthProvider } from "../src/context/AuthContext";
import { DashboardPage } from "../src/pages/DashboardPage";
import { BudgetPage } from "../src/pages/BudgetPage";
import { AccountsPage } from "../src/pages/AccountsPage";
import { CreditCardTrackerSection } from "../src/components/accounts/CreditCardTrackerSection";
import { GoalsPage } from "../src/pages/GoalsPage";
import { RecurringPage } from "../src/pages/RecurringPage";
import { BonusLogPanel } from "../src/components/bonus/BonusLogPanel";
import { InboxPage } from "../src/pages/InboxPage";
import { queryClient } from "../src/lib/queryClient";
import { financeService } from "../src/services/financeService";
import { mockMembers } from "../src/data/mockSeedData";
import type { MonthlyBudgetDetail } from "../src/types/finance";

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <LazyMotion features={domAnimation} strict>
            <AuthProvider initialAuthenticated>
                <HouseholdProvider>
                    <MemoryRouter>{ui}</MemoryRouter>
                </HouseholdProvider>
            </AuthProvider>
        </LazyMotion>,
    );
}

const sampleBudgetDetail: MonthlyBudgetDetail = {
    budget: {
        id: "mb-err-test",
        household_id: "hh-00000000-0001",
        owner_id: "mem-00000000-0011",
        month: "2026-11",
        gross_salary: 6000,
        bonus: 0,
        cpf_deduction: 1200,
        taxes_deduction: 0,
        insurance_deduction: 0,
        after_deductions: 4800,
        is_locked: false,
    },
    categories: [
        {
            id: "mbc-1",
            monthly_budget_id: "mb-err-test",
            category_id: "cat-00000000-0101",
            percentage: 0.25,
            allocated_amount: 1200,
            actualSpent: 250,
            remaining: 950,
            category: {
                id: "cat-00000000-0101",
                household_id: "hh-00000000-0001",
                name: "Food",
                group: "spendable",
                color: "#10b981",
                icon: "utensils",
                is_system: true,
            },
        },
    ],
    disposablePool: 4800,
    totalSpent: 250,
    totalRemaining: 4550,
    spendableAllocated: 1200,
    spendableSpent: 250,
    spendableRemaining: 950,
};

describe("Page Query Error Alerts with Retry", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.clear();
        queryClient.clear();
        queryClient.setDefaultOptions({
            queries: {
                retry: false,
            },
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    describe("DashboardPage", () => {
        it("shows Couldn't load Alert with Retry when primary budget query fails and recovers on Retry", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getMonthlyBudget").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("Database timeout"));
                    }
                    return Promise.resolve(sampleBudgetDetail);
                },
            );

            renderWithProviders(<DashboardPage />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Database timeout/i),
                ).toBeInTheDocument();
            });

            expect(
                screen.queryByTestId("left-to-spend-amount"),
            ).not.toBeInTheDocument();

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
                expect(
                    screen.getByTestId("left-to-spend-amount"),
                ).toBeInTheDocument();
            });
        });

        it("keeps last-good cached data visible when a subsequent budget refetch fails", async () => {
            let shouldFail = false;
            vi.spyOn(financeService, "getMonthlyBudget").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("Connection dropped"));
                    }
                    return Promise.resolve(sampleBudgetDetail);
                },
            );

            renderWithProviders(<DashboardPage />);

            await waitFor(() => {
                expect(
                    screen.getByTestId("left-to-spend-amount"),
                ).toBeInTheDocument();
            });

            shouldFail = true;
            await queryClient.invalidateQueries({
                queryKey: ["finance", "budget-detail"],
            });

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Connection dropped/i),
                ).toBeInTheDocument();
            });
            expect(
                screen.getByTestId("left-to-spend-amount"),
            ).toBeInTheDocument();
        });
    });

    describe("BudgetPage", () => {
        it("shows Couldn't load Alert with Retry when primary budget query fails and hides fake zero cards", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getMonthlyBudget").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("Network offline"));
                    }
                    return Promise.resolve(sampleBudgetDetail);
                },
            );

            renderWithProviders(<BudgetPage />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Network offline/i),
                ).toBeInTheDocument();
            });

            expect(screen.queryByText("On Track")).not.toBeInTheDocument();

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
                expect(screen.getByText("On Track")).toBeInTheDocument();
            });
        });

        it("keeps last-good cached data visible when a subsequent budget refetch fails", async () => {
            let shouldFail = false;
            vi.spyOn(financeService, "getMonthlyBudget").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("Request timed out"));
                    }
                    return Promise.resolve(sampleBudgetDetail);
                },
            );

            renderWithProviders(<BudgetPage />);

            await waitFor(() => {
                expect(screen.getByText("On Track")).toBeInTheDocument();
            });

            shouldFail = true;
            await queryClient.invalidateQueries({
                queryKey: ["finance", "budget-detail"],
            });

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Request timed out/i),
                ).toBeInTheDocument();
            });

            expect(screen.getByText("On Track")).toBeInTheDocument();
        });
    });

    describe("Other primary pages", () => {
        it("AccountsPage shows Alert with Retry when getAccounts fails", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getAccounts").mockImplementation(() => {
                if (shouldFail) {
                    return Promise.reject(new Error("Accounts timeout"));
                }
                return Promise.resolve([]);
            });

            renderWithProviders(<AccountsPage />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Accounts timeout/i),
                ).toBeInTheDocument();
            });

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
            });
        });

        it("CreditCardTrackerSection shows Alert with Retry when getCreditCards fails", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getCreditCards").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("Cards unreachable"));
                    }
                    return Promise.resolve([]);
                },
            );

            renderWithProviders(
                <CreditCardTrackerSection members={mockMembers} />,
            );

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Cards unreachable/i),
                ).toBeInTheDocument();
            });

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
            });
        });

        it("GoalsPage shows Alert with Retry when getGoals fails and avoids false No Goals state", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getGoals").mockImplementation(() => {
                if (shouldFail) {
                    return Promise.reject(new Error("Goals unavailable"));
                }
                return Promise.resolve([]);
            });

            renderWithProviders(<GoalsPage />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Goals unavailable/i),
                ).toBeInTheDocument();
            });

            expect(screen.queryByText("No Goals")).not.toBeInTheDocument();

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
                expect(
                    screen.getAllByText("No Goals").length,
                ).toBeGreaterThan(0);
            });
        });

        it("RecurringPage shows Alert with Retry when getRecurringItems fails", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getRecurringItems").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(
                            new Error("Recurring fetch error"),
                        );
                    }
                    return Promise.resolve([]);
                },
            );

            renderWithProviders(<RecurringPage />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Recurring fetch error/i),
                ).toBeInTheDocument();
            });

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
            });
        });

        it("BonusLogPanel shows Alert with Retry when getBonusEvents fails", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getBonusEvents").mockImplementation(
                () => {
                    if (shouldFail) {
                        return Promise.reject(new Error("Bonus query failed"));
                    }
                    return Promise.resolve({ available: true, events: [] });
                },
            );

            renderWithProviders(<BonusLogPanel />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Bonus query failed/i),
                ).toBeInTheDocument();
            });

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
                expect(screen.getByText("No Bonuses")).toBeInTheDocument();
            });
        });

        it("InboxPage shows Alert with Retry when getInboxItems fails and hides false empty state", async () => {
            let shouldFail = true;
            vi.spyOn(financeService, "getInboxItems").mockImplementation(() => {
                if (shouldFail) {
                    return Promise.reject(new Error("Inbox sync error"));
                }
                return Promise.resolve({ available: true, items: [] });
            });

            renderWithProviders(<InboxPage />);

            await waitFor(() => {
                expect(screen.getByText("Couldn't load")).toBeInTheDocument();
                expect(
                    screen.getByText(/Inbox sync error/i),
                ).toBeInTheDocument();
            });

            expect(screen.queryByText("All Sorted")).not.toBeInTheDocument();
            expect(screen.queryByText("No Captures")).not.toBeInTheDocument();

            shouldFail = false;
            fireEvent.click(screen.getByRole("button", { name: /^Retry$/i }));

            await waitFor(() => {
                expect(
                    screen.queryByText("Couldn't load"),
                ).not.toBeInTheDocument();
            });
        });
    });
});
