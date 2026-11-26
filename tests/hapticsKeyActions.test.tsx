import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { selectOption } from "./helpers/select";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { haptics } from "../src/lib/haptics";
import { feedback } from "../src/lib/delight/feedback";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { MobileBottomNav } from "../src/components/layout/MobileBottomNav";
import { DesktopSidebar } from "../src/components/layout/DesktopSidebar";
import { SpendPage } from "../src/pages/SpendPage";
import { PlanPage } from "../src/pages/PlanPage";
import { AddAccountModal } from "../src/components/accounts/AddAccountModal";
import { EditAccountModal } from "../src/components/accounts/EditAccountModal";
import { DeleteAccountModal } from "../src/components/accounts/DeleteAccountModal";
import { AddEditGoalModal } from "../src/components/goals/AddEditGoalModal";
import { AddRecurringModal } from "../src/components/recurring/AddRecurringModal";
import { RecurringPage } from "../src/pages/RecurringPage";
import { ManageCategoriesModal } from "../src/components/categories/ManageCategoriesModal";
import { BudgetEditorModal } from "../src/components/budget/BudgetEditorModal";
import { BonusFormModal } from "../src/components/bonus/BonusFormModal";
import { BonusLogPanel } from "../src/components/bonus/BonusLogPanel";
import { AddEditCreditCardModal } from "../src/components/accounts/AddEditCreditCardModal";
import { CreditCardTrackerSection } from "../src/components/accounts/CreditCardTrackerSection";
import { MarkCardPaidModal } from "../src/components/accounts/MarkCardPaidModal";
import SettingsPage from "../src/pages/SettingsPage";
import { AiSettingsSection } from "../src/components/settings/AiSettingsSection";
import { ExpenseSuccessCelebration } from "../src/components/expenses/ExpenseSuccessCelebration";
import { DeleteExpenseModal } from "../src/components/expenses/DeleteExpenseModal";
import { financeService } from "../src/services/financeService";
import {
    mockMembers,
    mockCategories,
    mockBaseProfiles,
    mockBaseAllocations,
} from "../src/data/mockSeedData";
import type {
    Account,
    BonusEvent,
    CreditCard,
    Expense,
    HouseholdMember,
    NotificationPreferences,
    RecurringItem,
    SavingsGoal,
} from "../src/types/finance";

function mockMatchMedia(reduce = false) {
    return (query: string) => ({
        matches: reduce && query.includes("prefers-reduced-motion: reduce"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
    });
}

function createTestQueryClient() {
    return new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: 0 },
            mutations: { retry: false },
        },
    });
}

function renderWithProviders(
    ui: React.ReactElement,
    {
        queryClient = createTestQueryClient(),
        initialEntry = "/",
        path = "/",
    }: {
        queryClient?: QueryClient;
        initialEntry?: string;
        path?: string;
    } = {},
) {
    return render(
        <QueryClientProvider client={queryClient}>
            <HouseholdProvider>
                <MemoryRouter initialEntries={[initialEntry]}>
                    <Routes>
                        <Route path={path} element={ui} />
                    </Routes>
                </MemoryRouter>
            </HouseholdProvider>
        </QueryClientProvider>,
    );
}

const mockMember: HouseholdMember = mockMembers[0];

const mockAccount: Account = {
    id: "acc-1",
    household_id: mockMember.household_id,
    owner_id: mockMember.id,
    name: "DBS Everyday",
    institution: "DBS",
    type: "Cash",
    balance: 1500,
    is_joint: false,
    currency: "SGD",
    updated_at: "2026-01-01T00:00:00Z",
};

const mockCreditCard: CreditCard = {
    id: "card-1",
    household_id: mockMember.household_id,
    owner_id: mockMember.id,
    name: "DBS Altitude",
    bank: "DBS",
    last4: "1234",
    billing_day: 15,
    due_day: 5,
    credit_limit: 10000,
    color: "#a855f7",
    is_active: true,
    created_at: "2026-01-01T00:00:00Z",
};

const mockRecurring: RecurringItem = {
    id: "rec-1",
    household_id: mockMember.household_id,
    owner_id: mockMember.id,
    name: "Spotify Duo",
    type: "subscription",
    amount: 17.98,
    monthly_amortized_amount: 17.98,
    frequency: "monthly",
    payment_month: null,
    due_day: 10,
    category_id: null,
    start_date: "2026-01-01",
    end_date: null,
    notes: null,
    paid_from_cpf_oa: false,
};

const mockBonus: BonusEvent = {
    id: "bon-1",
    household_id: mockMember.household_id,
    recipient_id: mockMember.id,
    received_on: "2026-11-20",
    type: "aws",
    gross: 5000,
    cpf: 1000,
    net: 4000,
    note: "Year end bonus",
    split: [
        { key: "savings", amount: 2000, pct: 0.5 },
        { key: "investments", amount: 2000, pct: 0.5 },
    ],
    created_at: "2026-11-20T00:00:00Z",
};

describe("Haptics on Key Actions (Issue #49)", () => {
    let vibrateSpy: ReturnType<typeof vi.fn>;
    const originalNavigator = window.navigator;

    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        vibrateSpy = vi.fn().mockReturnValue(true);
        Object.defineProperty(window, "navigator", {
            value: { vibrate: vibrateSpy },
            writable: true,
            configurable: true,
        });
        window.matchMedia = vi.fn().mockImplementation(mockMatchMedia(false)) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
        Object.defineProperty(window, "navigator", {
            value: originalNavigator,
            writable: true,
            configurable: true,
        });
    });

    describe("1. Tab Switches", () => {
        it("MobileBottomNav: fires light haptic on switching primary tabs, skips on currently active tab", () => {
            const lightTapSpy = vi.spyOn(haptics, "lightTap");
            const onSelectTab = vi.fn();

            const { rerender } = render(
                <MobileBottomNav activeTab="dashboard" onSelectTab={onSelectTab} />,
            );

            // Click already active tab "dashboard" -> no haptic
            const homeBtn = screen.getByRole("button", { name: "Dashboard" });
            fireEvent.click(homeBtn);
            expect(lightTapSpy).not.toHaveBeenCalled();
            expect(onSelectTab).toHaveBeenCalledWith("dashboard");

            // Click different tab "spend" -> fires haptic
            const spendBtn = screen.getByRole("button", { name: "Spend" });
            fireEvent.click(spendBtn);
            expect(lightTapSpy).toHaveBeenCalledTimes(1);
            expect(onSelectTab).toHaveBeenCalledWith("spend");

            // Re-render with activeTab="spend"
            rerender(
                <MobileBottomNav activeTab="spend" onSelectTab={onSelectTab} />,
            );
            fireEvent.click(spendBtn);
            expect(lightTapSpy).toHaveBeenCalledTimes(1); // Still 1, skipped because already active

            // Click "accounts" -> fires haptic
            const accountsBtn = screen.getByRole("button", { name: "Accounts" });
            fireEvent.click(accountsBtn);
            expect(lightTapSpy).toHaveBeenCalledTimes(2);

            // Click "plan" -> fires haptic
            const planBtn = screen.getByRole("button", { name: "Plan" });
            fireEvent.click(planBtn);
            expect(lightTapSpy).toHaveBeenCalledTimes(3);
        });

        it("DesktopSidebar: fires light haptic on tab switch, skips on active tab", () => {
            const lightTapSpy = vi.spyOn(haptics, "lightTap");
            const onSelectTab = vi.fn();

            renderWithProviders(
                <DesktopSidebar activeTab="dashboard" onSelectTab={onSelectTab} />,
            );

            // Click Home (already active) -> no haptic
            const homeBtn = screen.getByRole("button", { name: /home/i });
            fireEvent.click(homeBtn);
            expect(lightTapSpy).not.toHaveBeenCalled();

            // Click Spend -> fires haptic
            const spendBtn = screen.getByRole("button", { name: /spend/i });
            fireEvent.click(spendBtn);
            expect(lightTapSpy).toHaveBeenCalledTimes(1);
            expect(onSelectTab).toHaveBeenCalledWith("spend");
        });

        it("SpendPage: fires light haptic when switching sub-tabs", async () => {
            const lightTapSpy = vi.spyOn(haptics, "lightTap");
            renderWithProviders(<SpendPage initialTab="expenses" />, {
                initialEntry: "/spend",
                path: "/spend",
            });

            const budgetSubTab = screen.getByRole("tab", { name: /budget/i });
            await act(async () => {
                fireEvent.click(budgetSubTab);
            });
            expect(lightTapSpy).toHaveBeenCalledTimes(1);

            // Clicking budget again -> skips haptic
            await act(async () => {
                fireEvent.click(budgetSubTab);
            });
            expect(lightTapSpy).toHaveBeenCalledTimes(1);
        });

        it("PlanPage: fires light haptic when switching sub-tabs", async () => {
            const lightTapSpy = vi.spyOn(haptics, "lightTap");
            renderWithProviders(<PlanPage initialTab="goals" />, {
                initialEntry: "/plan",
                path: "/plan",
            });

            const recurringSubTab = screen.getByRole("tab", { name: /recurring/i });
            await act(async () => {
                fireEvent.click(recurringSubTab);
            });
            expect(lightTapSpy).toHaveBeenCalledTimes(1);

            // Clicking recurring again -> skips haptic
            await act(async () => {
                fireEvent.click(recurringSubTab);
            });
            expect(lightTapSpy).toHaveBeenCalledTimes(1);
        });

        it("Tab switches respect haptics_enabled=false and prefers-reduced-motion", () => {
            // Disabled via preference
            localStorage.setItem(
                "bb_notif_prefs_mem-1",
                JSON.stringify({ haptics_enabled: false }),
            );

            render(
                <MobileBottomNav activeTab="dashboard" onSelectTab={vi.fn()} />,
            );
            fireEvent.click(screen.getByRole("button", { name: "Spend" }));
            expect(vibrateSpy).not.toHaveBeenCalled();

            // Reduced motion
            localStorage.clear();
            window.matchMedia = vi.fn().mockImplementation(mockMatchMedia(true)) as unknown as typeof window.matchMedia;

            fireEvent.click(screen.getByRole("button", { name: "Accounts" }));
            expect(vibrateSpy).not.toHaveBeenCalled();
        });
    });

    describe("2. App-wide Save & Delete Actions", () => {
        describe("Accounts", () => {
            it("AddAccountModal triggers feedback.routine('save') on creation", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "createAccount").mockResolvedValue(mockAccount);

                renderWithProviders(
                    <AddAccountModal
                        isOpen={true}
                        onClose={vi.fn()}
                        members={[mockMember]}
                    />,
                );

                fireEvent.change(screen.getByLabelText(/account name/i), {
                    target: { value: "New Stash" },
                });
                fireEvent.change(screen.getByPlaceholderText("0.00"), {
                    target: { value: "200" },
                });
                fireEvent.click(screen.getByRole("radio", { name: "Existing account" }));

                const submitBtn = screen.getByRole("button", { name: /create account/i });
                await act(async () => {
                    fireEvent.click(submitBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
            });

            it("EditAccountModal triggers feedback.routine('save') on update", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "updateAccount").mockResolvedValue(mockAccount);

                renderWithProviders(
                    <EditAccountModal
                        isOpen={true}
                        onClose={vi.fn()}
                        account={mockAccount}
                        members={[mockMember]}
                    />,
                );

                const saveBtn = screen.getByRole("button", { name: /save changes/i });
                await act(async () => {
                    fireEvent.click(saveBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
            });

            it("DeleteAccountModal triggers feedback.routine('delete') on account deletion", async () => {
                const deleteSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "deleteAccount").mockResolvedValue(undefined);

                renderWithProviders(
                    <DeleteAccountModal
                        isOpen={true}
                        onClose={vi.fn()}
                        account={mockAccount}
                    />,
                );

                const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
                await act(async () => {
                    fireEvent.click(confirmBtn);
                });

                expect(deleteSpy).toHaveBeenCalledWith("delete");
            });
        });

        describe("Goals", () => {
            it("AddEditGoalModal triggers feedback.routine('save') on saving a goal", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                const mockGoal: SavingsGoal = {
                    id: "goal-1",
                    household_id: "hh-1",
                    emoji: "🏖️",
                    title: "Vacation",
                    target_amount: 3000,
                    target_date: "2027-12-01",
                    status: "on_track",
                    created_at: "2026-01-01T00:00:00Z",
                };
                vi.spyOn(financeService, "addGoal").mockResolvedValue(mockGoal);

                renderWithProviders(
                    <AddEditGoalModal
                        isOpen={true}
                        onClose={vi.fn()}
                        householdId="hh-1"
                    />,
                );

                fireEvent.change(screen.getByPlaceholderText(/e\.g\. Wedding Banquet/i), {
                    target: { value: "Tokyo Trip" },
                });
                fireEvent.change(screen.getByPlaceholderText("20,000"), {
                    target: { value: "3000" },
                });
                fireEvent.change(screen.getByLabelText(/target date/i), {
                    target: { value: "2027-12-01" },
                });

                const saveBtn = screen.getByRole("button", { name: /^create$/i });
                await act(async () => {
                    fireEvent.click(saveBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
            });
        });

        describe("Recurring", () => {
            it("AddRecurringModal triggers feedback.routine('save') on saving recurring item", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                const onSave = vi.fn().mockResolvedValue(undefined);

                render(
                    <AddRecurringModal
                        isOpen={true}
                        onClose={vi.fn()}
                        onSave={onSave}
                    />,
                );

                fireEvent.change(screen.getByLabelText(/name \*/i), {
                    target: { value: "Netflix" },
                });
                fireEvent.change(screen.getByPlaceholderText("1200.00"), {
                    target: { value: "22.98" },
                });

                const saveBtn = screen.getByRole("button", { name: /^save$/i });
                await act(async () => {
                    fireEvent.click(saveBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
                expect(onSave).toHaveBeenCalledTimes(1);
            });

            it("RecurringPage triggers feedback.routine('delete') on deleting recurring item", async () => {
                const deleteSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "getRecurringItems").mockResolvedValue([mockRecurring]);
                vi.spyOn(financeService, "deleteRecurringItem").mockResolvedValue(undefined);

                renderWithProviders(<RecurringPage />);

                const deleteBtn = await screen.findByRole("button", { name: /delete spotify duo/i });
                await act(async () => {
                    fireEvent.click(deleteBtn);
                });

                expect(deleteSpy).toHaveBeenCalledWith("delete");
            });
        });

        describe("Categories", () => {
            it("ManageCategoriesModal triggers feedback.routine('save') on add and 'delete' on deletion", async () => {
                const routineSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "getCategories").mockResolvedValue([
                    {
                        id: "cat-1",
                        household_id: "hh-1",
                        name: "Dining",
                        color: "#f87171",
                        icon: "Utensils",
                        is_system: false,
                        group: "spendable",
                    },
                ]);
                vi.spyOn(financeService, "addCategory").mockResolvedValue({
                    id: "cat-new",
                    household_id: "hh-1",
                    name: "Hobbies",
                    color: "#a855f7",
                    icon: "Palette",
                    is_system: false,
                    group: "spendable",
                });
                vi.spyOn(financeService, "deleteCategory").mockResolvedValue(undefined);
                vi.spyOn(financeService, "getBaseProfiles").mockResolvedValue([]);

                renderWithProviders(
                    <ManageCategoriesModal
                        isOpen={true}
                        onClose={vi.fn()}
                    />,
                );

                // Add Category
                const newCatBtn = await screen.findByRole("button", { name: /add category/i });
                fireEvent.click(newCatBtn);

                const nameInput = screen.getByLabelText(/category name/i);
                fireEvent.change(nameInput, { target: { value: "Hobbies" } });

                const createBtn = screen.getByRole("button", { name: /create category/i });
                await act(async () => {
                    fireEvent.click(createBtn);
                });

                expect(routineSpy).toHaveBeenCalledWith("save");

                // Delete Category
                const deleteTriggerBtn = await screen.findByTitle("Delete Category");
                fireEvent.click(deleteTriggerBtn);

                const confirmDeleteBtn = await screen.findByRole("button", { name: /^delete$/i });
                await act(async () => {
                    fireEvent.click(confirmDeleteBtn);
                });

                expect(routineSpy).toHaveBeenCalledWith("delete");
            });
        });

        describe("Budget", () => {
            it("BudgetEditorModal triggers feedback.routine('save') on profile/budget save", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                const profile = mockBaseProfiles[0];
                const allocations = mockBaseAllocations.filter((a) => a.profile_id === profile.id);
                vi.spyOn(financeService, "updateBaseProfile").mockResolvedValue(undefined);

                renderWithProviders(
                    <BudgetEditorModal
                        isOpen={true}
                        onClose={vi.fn()}
                        profile={profile}
                        allocations={allocations}
                        members={mockMembers}
                        categories={mockCategories}
                    />,
                );

                const saveBtn = screen.getByRole("button", { name: /^save$/i });
                await act(async () => {
                    fireEvent.click(saveBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
            });
        });

        describe("Bonus", () => {
            it("BonusFormModal edit triggers feedback.routine('save'), new bonus skips to avoid double-fire with celebration", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "saveBonusEvent").mockResolvedValue(mockBonus);
                vi.spyOn(financeService, "getBonusSplitDefault").mockResolvedValue([
                    { key: "savings", pct: 0.5 },
                    { key: "investments", pct: 0.5 },
                ]);

                // Edit existing bonus
                const { unmount } = renderWithProviders(
                    <BonusFormModal
                        isOpen={true}
                        onClose={vi.fn()}
                        members={[mockMember]}
                        editingEvent={mockBonus}
                    />,
                );

                const nextBtn = screen.getByRole("button", { name: /^next$/i });
                fireEvent.click(nextBtn);

                const saveBtn = screen.getByRole("button", { name: /^save$/i });
                await act(async () => {
                    fireEvent.click(saveBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
                unmount();

                // Create new bonus -> skips routine("save") so BonusCelebration handles it
                saveSpy.mockClear();
                renderWithProviders(
                    <BonusFormModal
                        isOpen={true}
                        onClose={vi.fn()}
                        members={[mockMember]}
                    />,
                );

                fireEvent.change(screen.getByLabelText("Gross"), {
                    target: { value: "5000" },
                });
                const nextBtnNew = screen.getByRole("button", { name: /^next$/i });
                fireEvent.click(nextBtnNew);

                const saveBtnNew = screen.getByRole("button", { name: /log bonus/i });
                await act(async () => {
                    fireEvent.click(saveBtnNew);
                });

                // Routine save was skipped so BonusCelebration handles celebration haptic!
                expect(saveSpy).not.toHaveBeenCalledWith("save");
            });

            it("BonusLogPanel triggers feedback.routine('delete') on bonus deletion", async () => {
                const deleteSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "getBonusEvents").mockResolvedValue({
                    available: true,
                    events: [mockBonus],
                });
                vi.spyOn(financeService, "deleteBonusEvent").mockResolvedValue(undefined);

                renderWithProviders(<BonusLogPanel />);

                const deleteBtn = await screen.findByRole("button", { name: /delete bonus/i });
                fireEvent.click(deleteBtn);

                const confirmBtn = await screen.findByRole("button", { name: /^delete$/i });
                await act(async () => {
                    fireEvent.click(confirmBtn);
                });

                expect(deleteSpy).toHaveBeenCalledWith("delete");
            });
        });

        describe("Credit Cards", () => {
            it("AddEditCreditCardModal triggers feedback.routine('save') on card save", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "addCreditCard").mockResolvedValue(mockCreditCard);

                render(
                    <AddEditCreditCardModal
                        isOpen={true}
                        onClose={vi.fn()}
                        members={[mockMember]}
                    />,
                );

                fireEvent.change(screen.getByLabelText(/card name/i), {
                    target: { value: "Citi Cash Back" },
                });
                fireEvent.change(screen.getByLabelText(/issuing bank/i), {
                    target: { value: "Citi" },
                });

                const saveBtn = screen.getByRole("button", { name: /add card/i });
                await act(async () => {
                    fireEvent.click(saveBtn);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
            });

            it("CreditCardTrackerSection triggers feedback.routine('save') on statement save", async () => {
                const routineSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "getCreditCards").mockResolvedValue([mockCreditCard]);
                vi.spyOn(financeService, "getCreditCardStatements").mockResolvedValue([]);
                vi.spyOn(financeService, "upsertCreditCardStatement").mockResolvedValue({
                    id: "stmt-1",
                    card_id: "card-1",
                    household_id: "hh-1",
                    month: "2026-11",
                    statement_amount: 450,
                    due_date: "2026-12-05",
                    is_paid: false,
                    paid_at: null,
                    notes: null,
                });

                renderWithProviders(<CreditCardTrackerSection members={[mockMember]} />);

                // Log statement
                const logStmtBtn = await screen.findByRole("button", { name: /log statement/i });
                fireEvent.click(logStmtBtn);

                const amtInput = screen.getByPlaceholderText("e.g. 842.50");
                fireEvent.change(amtInput, { target: { value: "450" } });

                const saveStmtBtn = screen.getByRole("button", { name: /save statement/i });
                await act(async () => {
                    fireEvent.click(saveStmtBtn);
                });

                expect(routineSpy).toHaveBeenCalledWith("save");
            });

            it("MarkCardPaidModal fires milestone('bill-paid') without double-firing routine save", async () => {
                const milestoneSpy = vi.spyOn(feedback, "milestone");
                const routineSpy = vi.spyOn(feedback, "routine");
                vi.spyOn(financeService, "upsertCreditCardStatement").mockResolvedValue({
                    id: "stmt-1",
                    card_id: "card-1",
                    household_id: "hh-1",
                    month: "2026-11",
                    statement_amount: 150,
                    due_date: "2026-12-05",
                    is_paid: true,
                    paid_at: new Date().toISOString(),
                    notes: null,
                });

                render(
                    <MarkCardPaidModal
                        onClose={vi.fn()}
                        cycle={{
                            key: "card-1:2026-11",
                            card: mockCreditCard,
                            month: "2026-11",
                            statementDate: "2026-11-15",
                            dueDate: "2026-12-05",
                            amount: 150,
                            statement: null,
                            status: "unpaid",
                            daysUntilDue: 10,
                        }}
                        onPaid={vi.fn()}
                    />,
                );

                const confirmPaidBtn = screen.getByRole("button", { name: /mark paid/i });
                await act(async () => {
                    fireEvent.click(confirmPaidBtn);
                });

                expect(milestoneSpy).toHaveBeenCalledWith("bill-paid", expect.anything());
                expect(routineSpy).not.toHaveBeenCalledWith("save");
            });
        });

        describe("Settings", () => {
            it("Settings page triggers feedback.routine('save') on updating preference", async () => {
                const saveSpy = vi.spyOn(feedback, "routine");
                const mockPrefs: NotificationPreferences = {
                    household_id: "hh-1",
                    member_id: "mem-1",
                    push_enabled: true,
                    sound_enabled: true,
                    haptics_enabled: true,
                    cc_payment_due: true,
                    cc_missing_statement: true,
                    streak_and_logging: true,
                    monthly_balance_updates: true,
                    partner_shared_spend: true,
                    budget_limit_alerts: true,
                    recurring_bills_due: true,
                    goal_pacing_alerts: true,
                    monthly_budget_review: true,
                    cc_due_days_before: 5,
                    budget_warning_pct: 80,
                    settlement_threshold_sgd: 200,
                };
                vi.spyOn(financeService, "getNotificationPreferences").mockResolvedValue(mockPrefs);
                vi.spyOn(financeService, "updateNotificationPreferences").mockResolvedValue(mockPrefs);

                renderWithProviders(<SettingsPage />, {
                    initialEntry: "/settings/general",
                    path: "/settings/*",
                });

                const soundToggle = await screen.findByTestId("toggle-sound-enabled");
                await act(async () => {
                    fireEvent.click(soundToggle);
                });

                expect(saveSpy).toHaveBeenCalledWith("save");
            });

            it("AiSettingsSection triggers routine('save') on key save and routine('delete') on clear", async () => {
                const routineSpy = vi.spyOn(feedback, "routine");

                render(<AiSettingsSection />);

                // Expand collapsible
                const toggleCollapsible = screen.getByRole("button", { name: /bubby ai/i });
                fireEvent.click(toggleCollapsible);

                // Select Gemini provider
                await selectOption(
                    screen.getByTestId("ai-provider-select"),
                    "Gemini",
                );

                // Enter new key and save
                const input = screen.getByLabelText(/gemini api key/i);
                fireEvent.change(input, { target: { value: "AIzaSyTestKey123" } });

                const saveBtn = screen.getByTestId("save-ai-key-btn");
                fireEvent.click(saveBtn);

                expect(routineSpy).toHaveBeenCalledWith("save");

                // Clear key
                const clearBtn = screen.getByTestId("clear-ai-key-btn");
                fireEvent.click(clearBtn);

                expect(routineSpy).toHaveBeenCalledWith("delete");
            });
        });

        describe("No Double-Firing on Already Wired Expense Actions", () => {
            it("ExpenseSuccessCelebration fires only 1 haptic (success)", () => {
                const successSpy = vi.spyOn(haptics, "success");
                const lightTapSpy = vi.spyOn(haptics, "lightTap");

                const mockExpense: Expense = {
                    id: "exp-1",
                    household_id: "hh-1",
                    amount: 25,
                    item: "Chicken Rice",
                    date: "2026-11-22",
                    category_id: "cat-1",
                    payer_id: "mem-1",
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-11-22T00:00:00Z",
                };

                render(<ExpenseSuccessCelebration expense={mockExpense} />);

                expect(successSpy).toHaveBeenCalledTimes(1);
                expect(lightTapSpy).not.toHaveBeenCalled();
            });

            it("DeleteExpenseModal fires only 1 haptic (destructive)", async () => {
                const destructiveSpy = vi.spyOn(haptics, "destructive");
                const lightTapSpy = vi.spyOn(haptics, "lightTap");
                vi.spyOn(financeService, "deleteExpense").mockResolvedValue(undefined);

                const mockExpense: Expense = {
                    id: "exp-1",
                    household_id: "hh-1",
                    amount: 25,
                    item: "Chicken Rice",
                    date: "2026-11-22",
                    category_id: "cat-1",
                    payer_id: "mem-1",
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                    created_at: "2026-11-22T00:00:00Z",
                };

                render(
                    <DeleteExpenseModal
                        isOpen={true}
                        onClose={vi.fn()}
                        expense={mockExpense}
                        onDeleted={vi.fn()}
                    />,
                );

                const deleteBtn = screen.getByRole("button", { name: /confirm delete/i });
                await act(async () => {
                    fireEvent.click(deleteBtn);
                });

                expect(destructiveSpy).toHaveBeenCalledTimes(1);
                expect(lightTapSpy).not.toHaveBeenCalled();
            });
        });
    });
});
