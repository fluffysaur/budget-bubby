import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { LazyMotion, domAnimation } from "motion/react";
import { AuthProvider } from "../../context/AuthContext";
import {
    PrivacyProvider,
    PRIVACY_MASK,
    PRIVACY_STORAGE_KEY,
} from "../../context/PrivacyContext";
import { SettingsProvider } from "../../context/SettingsContext";
import { BubbyAvatarButton } from "../../components/bubby/BubbyAvatarButton";
import { DashboardPage } from "../DashboardPage";
import { ExpensesPage } from "../ExpensesPage";
import * as useBubbyModule from "../../hooks/useBubby";
import * as householdModule from "../../context/HouseholdContext";
import * as financeQueriesModule from "../../hooks/useFinanceQueries";
import type { HouseholdMember, MonthlyBudgetDetail } from "../../types/finance";

const TEST_MEMBERS: HouseholdMember[] = [
    {
        id: "mem-1",
        household_id: "hh-1",
        display_name: "Alex",
        role: "owner",
        bubby_hatched_at: "2026-01-01T00:00:00Z",
    },
];

const TEST_BUDGET: MonthlyBudgetDetail = {
    budget: {
        id: "mb-1",
        household_id: "hh-1",
        owner_id: "mem-1",
        month: "2026-11",
        gross_salary: 5000,
        bonus: 0,
        cpf_deduction: 1000,
        taxes_deduction: 0,
        insurance_deduction: 0,
        after_deductions: 4000,
        is_locked: false,
    },
    disposablePool: 4000,
    totalSpent: 800,
    totalRemaining: 3200,
    spendableAllocated: 1500,
    spendableSpent: 350,
    spendableRemaining: 1150,
    categories: [
        {
            id: "bc-1",
            monthly_budget_id: "mb-1",
            category_id: "cat-1",
            percentage: 37.5,
            allocated_amount: 1500,
            actualSpent: 350,
            remaining: 1150,
            category: {
                id: "cat-1",
                household_id: "hh-1",
                name: "Food & Dining",
                group: "spendable",
                color: "#10b981",
                icon: "utensils",
                is_system: true,
            },
        },
    ],
};

function renderWithProviders(ui: React.ReactElement) {
    const qc = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return render(
        <LazyMotion features={domAnimation} strict>
            <QueryClientProvider client={qc}>
                <AuthProvider initialAuthenticated>
                    <SettingsProvider>
                        <PrivacyProvider>{ui}</PrivacyProvider>
                    </SettingsProvider>
                </AuthProvider>
            </QueryClientProvider>
        </LazyMotion>,
    );
}

describe("Cold start skeleton & cached privacy masking", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        localStorage.clear();
        sessionStorage.clear();
    });

    it("renders compact Skeleton instead of BubbyEgg when member is loading", () => {
        vi.spyOn(useBubbyModule, "useBubby").mockReturnValue({
            isReady: false,
            isMemberLoading: true,
            weeklyQuestsReady: true,
            monthlyQuestsReady: true,
            body: "regular",
            mood: "normal",
            condition: {
                body: "regular",
                mood: "normal",
                nourishment: 1,
                fitness: 1,
                daysSinceFed: 0,
                fedToday: new Set(),
            },
            reaction: null,
            penguins: [],
            sleepy: false,
            fedToday: new Set(),
            dailyQuests: [],
            weeklyQuests: [],
            monthlyQuests: [],
            snacks: [],
            me: null,
            partner: null,
            members: [],
            today: "2026-11-22",
            minutes: 600,
            checkinMinutes: 1080,
            pet: vi.fn(),
            hatched: false,
            onboardingQuests: [],
            hatch: vi.fn(),
        });

        renderWithProviders(<BubbyAvatarButton />);

        expect(screen.getByTestId("bubby-avatar-skeleton")).toBeInTheDocument();
        expect(screen.queryByTestId("bubby-egg")).not.toBeInTheDocument();
        expect(screen.getByTestId("bubby-avatar")).toHaveAttribute(
            "data-hatched",
            "loading",
        );
    });

    it("renders hatched Bubby immediately on warm cache without egg flash", () => {
        vi.spyOn(useBubbyModule, "useBubby").mockReturnValue({
            isReady: true,
            isMemberLoading: false,
            weeklyQuestsReady: true,
            monthlyQuestsReady: true,
            body: "regular",
            mood: "normal",
            condition: {
                body: "regular",
                mood: "normal",
                nourishment: 1,
                fitness: 1,
                daysSinceFed: 0,
                fedToday: new Set(),
            },
            reaction: null,
            penguins: [],
            sleepy: false,
            fedToday: new Set(),
            dailyQuests: [],
            weeklyQuests: [],
            monthlyQuests: [],
            snacks: [],
            me: TEST_MEMBERS[0],
            partner: null,
            members: TEST_MEMBERS,
            today: "2026-11-22",
            minutes: 600,
            checkinMinutes: 1080,
            pet: vi.fn(),
            hatched: true,
            onboardingQuests: [],
            hatch: vi.fn(),
        });

        renderWithProviders(<BubbyAvatarButton />);

        expect(screen.getByTestId("bubby-avatar")).toHaveAttribute(
            "data-hatched",
            "true",
        );
        expect(screen.queryByTestId("bubby-egg")).not.toBeInTheDocument();
        expect(
            screen.queryByTestId("bubby-avatar-skeleton"),
        ).not.toBeInTheDocument();
    });

    it("renders DashboardSkeleton when members are unresolved in live mode", () => {
        vi.spyOn(householdModule, "useHousehold").mockReturnValue({
            perspective: "household",
            setPerspective: vi.fn(),
            members: [],
            activeMember: null,
            theme: "light",
            toggleTheme: vi.fn(),
            isMockMode: false,
            overview: null,
            loading: true,
            refreshData: vi.fn(),
        });
        vi.spyOn(financeQueriesModule, "useBudgetDetailQuery").mockReturnValue({
            data: undefined,
            isLoading: false,
            isPending: true,
            isPlaceholderData: false,
        } as unknown as ReturnType<typeof financeQueriesModule.useBudgetDetailQuery>);

        renderWithProviders(<DashboardPage />);

        expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
        expect(screen.queryByText("S$0")).not.toBeInTheDocument();
    });

    it("masks cached DashboardPage amounts on first paint when privacy mode is enabled", () => {
        localStorage.setItem(PRIVACY_STORAGE_KEY, "1");

        vi.spyOn(householdModule, "useHousehold").mockReturnValue({
            perspective: "household",
            setPerspective: vi.fn(),
            members: TEST_MEMBERS,
            activeMember: null,
            theme: "light",
            toggleTheme: vi.fn(),
            isMockMode: false,
            overview: null,
            loading: false,
            refreshData: vi.fn(),
        });
        vi.spyOn(financeQueriesModule, "useBudgetDetailQuery").mockReturnValue({
            data: TEST_BUDGET,
            isLoading: false,
            isPending: false,
            isPlaceholderData: false,
        } as unknown as ReturnType<typeof financeQueriesModule.useBudgetDetailQuery>);

        renderWithProviders(<DashboardPage />);

        expect(
            screen.queryByTestId("dashboard-skeleton"),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/1,150/)).not.toBeInTheDocument();
        expect(screen.getAllByText(PRIVACY_MASK).length).toBeGreaterThan(0);
    });

    it("shows skeleton on ExpensesPage Spendable card while budget or members are pending", () => {
        vi.spyOn(householdModule, "useHousehold").mockReturnValue({
            perspective: "household",
            setPerspective: vi.fn(),
            members: [],
            activeMember: null,
            theme: "light",
            toggleTheme: vi.fn(),
            isMockMode: false,
            overview: null,
            loading: true,
            refreshData: vi.fn(),
        });
        vi.spyOn(financeQueriesModule, "useExpensesQuery").mockReturnValue({
            data: [],
            isLoading: false,
            isPending: false,
            isPlaceholderData: false,
            isError: false,
            error: null,
            refetch: vi.fn(),
        } as unknown as ReturnType<typeof financeQueriesModule.useExpensesQuery>);
        vi.spyOn(financeQueriesModule, "useBudgetDetailQuery").mockReturnValue({
            data: undefined,
            isLoading: false,
            isPending: true,
            isPlaceholderData: false,
        } as unknown as ReturnType<typeof financeQueriesModule.useBudgetDetailQuery>);

        renderWithProviders(<ExpensesPage />);

        const spendableLabel = screen.getByText("Spendable");
        const card = spendableLabel.closest("[aria-busy]");
        expect(card).toHaveAttribute("aria-busy", "true");
    });
});
