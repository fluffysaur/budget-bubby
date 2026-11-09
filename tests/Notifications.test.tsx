/**
 * Notifications engine, reminder rules and the Bubby nudge
 */

import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { NotificationCenterPopover } from "../src/components/layout/NotificationCenterPopover";
import { NotificationSettingsModal } from "../src/components/layout/NotificationSettingsModal";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { AuthProvider } from "../src/context/AuthContext";
import { financeService } from "../src/services/financeService";
import {
    checkBubbyReminder,
    checkBalanceUpdateReminder,
    checkCreditCardDueReminders,
    checkMissingCreditCardStatements,
    checkPartnerSharedSpendReminders,
    checkSettlementReminder,
    checkBudgetLimitReminders,
    checkRecurringBillsReminders,
    checkGoalPacingReminders,
    checkMonthlyBudgetReviewReminder,
    evaluateAndDispatchReminders,
    requestNotificationPermission,
    dispatchPWANotification,
    getDismissedReminderIds,
    migrateLegacyDismissals,
    computeActiveReminders,
    getDueStage,
    getCcDueReminderDays,
    isWithinQuietHours,
    timeToMinutes,
    checkAndPromptInitialNotificationPermission,
} from "../src/lib/notificationScheduler";
import { getDefaultNotificationPreferences } from "../src/data/mockSeedData";
import { isSoundEffectsEnabled } from "../src/lib/soundEffects";
import * as pushSubscriptionModule from "../src/lib/pushSubscription";
import { getTodayDateString, getCurrentMonth } from "../src/lib/dateUtils";
import { mockFinanceService } from "../src/services/mockFinanceService";
import type {
    AccountSnapshot,
    CreditCardStatement,
    CreditCard,
    Expense,
    HouseholdMember,
    SettlementSummary,
    DailyCheckin,
    MonthlyBudgetDetail,
    RecurringItem,
    SavingsGoal,
} from "../src/types/finance";

function renderWithProviders(ui: React.ReactElement) {
    return render(
        <MemoryRouter>
            <AuthProvider initialAuthenticated={true} initialPartner="yijia">
                <HouseholdProvider defaultPerspective="household">
                    {ui}
                </HouseholdProvider>
            </AuthProvider>
        </MemoryRouter>,
    );
}

describe("Notifications Engine", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        vi.restoreAllMocks();
        mockFinanceService.resetData();
        // Empty demo inbox: a pending inbox replaces the daily check-in nudge
        mockFinanceService.inbox.setItems([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    // =========================================================================
    // 2. Notification Scheduler & NotificationCenterPopover
    // =========================================================================
    describe("Notification Engine & NotificationCenterPopover", () => {
        it("Bubby nudges only while Bubby looks hungry, from the check-in time, once a day", () => {
            const chk = (date: string): DailyCheckin => ({
                id: `c-${date}`,
                household_id: "hh-1",
                member_id: "mem-2",
                checkin_date: date,
                type: "expense",
            });

            // Normal Bubby (fed 2 days ago): never a nudge
            expect(
                checkBubbyReminder(
                    [chk("2026-10-26")],
                    [],
                    19,
                    "mem-1",
                    "2026-10-28",
                ),
            ).toBeNull();

            // 3+ days: rumbling tummy, but only from the check-in time
            expect(
                checkBubbyReminder(
                    [chk("2026-10-25")],
                    [],
                    14,
                    "mem-1",
                    "2026-10-28",
                ),
            ).toBeNull();
            const rumbly = checkBubbyReminder(
                [chk("2026-10-25")],
                [],
                19,
                "mem-1",
                "2026-10-28",
            );
            expect(rumbly?.type).toBe("daily_checkin");
            expect(rumbly?.title).toBe("Bubby");
            expect(rumbly?.message).toBe("Bubby's tummy is rumbling 🐧");
            expect(rumbly?.id).toBe("reminder-daily-checkin-mem-1-2026-10-28");

            expect(
                checkBubbyReminder(
                    [chk("2026-10-21")],
                    [],
                    19,
                    "mem-1",
                    "2026-10-28",
                )?.message,
            ).toBe("Bubby misses you 🐧");

            // Inbox items waiting: the line points there
            expect(
                checkBubbyReminder(
                    [chk("2026-10-25")],
                    [],
                    19,
                    "mem-1",
                    "2026-10-28",
                    "18:00",
                    3,
                )?.message,
            ).toBe("3 to sort — Bubby's waiting 🐧");

            // Mood words never appear
            for (const date of ["2026-10-25", "2026-10-23", "2026-10-20"]) {
                const r = checkBubbyReminder(
                    [chk(date)],
                    [],
                    19,
                    "mem-1",
                    "2026-10-28",
                );
                expect(r?.message).not.toMatch(
                    /hungry|sad|lonely|teary|rumbly/i,
                );
            }
        });

        it("creates monthly balance update reminder on 1st and last days of month when snapshots are missing", () => {
            const currentMonth = getCurrentMonth();
            const firstDay = new Date(`${currentMonth}-01T12:00:00`);
            const midDay = new Date(`${currentMonth}-15T12:00:00`);
            const lastDay = new Date(`${currentMonth}-30T12:00:00`);

            const emptySnapshots: AccountSnapshot[] = [];
            const updatedSnapshots: AccountSnapshot[] = [
                {
                    id: "snap-1",
                    household_id: "hh-00000000-0001",
                    account_id: "acc-1",
                    snapshot_date: `${currentMonth}-01`,
                    balance: 1000,
                },
            ];

            // Missing on 1st -> reminder
            const r1 = checkBalanceUpdateReminder(emptySnapshots, firstDay);
            expect(r1).not.toBeNull();
            expect(r1?.type).toBe("balance_update");
            expect(r1?.title).toBe("Update Balances");
            expect(r1?.actionLabel).toBe("Update");

            // Missing on 15th -> no reminder (only 1st or end of month)
            const rMid = checkBalanceUpdateReminder(emptySnapshots, midDay);
            expect(rMid).toBeNull();

            // Missing on end of month -> reminder
            const rLast = checkBalanceUpdateReminder(emptySnapshots, lastDay);
            expect(rLast).not.toBeNull();

            // Already updated this month -> no reminder
            const rUpdated = checkBalanceUpdateReminder(
                updatedSnapshots,
                firstDay,
            );
            expect(rUpdated).toBeNull();
        });

        it("creates credit card payment due alerts when unpaid statement is due within 5 days", () => {
            const today = "2026-10-25";
            const statements: CreditCardStatement[] = [
                {
                    id: "stmt-1",
                    household_id: "hh-00000000-0001",
                    card_id: "card-1",
                    month: "2026-10",
                    statement_amount: 1245.5,
                    due_date: "2026-10-28", // 3 days away -> should alert
                    is_paid: false,
                    card: {
                        id: "card-1",
                        household_id: "hh-00000000-0001",
                        owner_id: "mem-00000000-0011",
                        name: "DBS Altitude",
                        bank: "DBS",
                        billing_day: 1,
                        due_day: 28,
                        color: "#10B981",
                        is_active: true,
                    },
                },
                {
                    id: "stmt-2",
                    household_id: "hh-00000000-0001",
                    card_id: "card-2",
                    month: "2026-10",
                    statement_amount: 850,
                    due_date: "2026-11-15", // 21 days away -> no alert
                    is_paid: false,
                    card: {
                        id: "card-2",
                        household_id: "hh-00000000-0001",
                        owner_id: "mem-00000000-0011",
                        name: "OCBC 365",
                        bank: "OCBC",
                        billing_day: 1,
                        due_day: 15,
                        color: "#EC4899",
                        is_active: true,
                    },
                },
                {
                    id: "stmt-3",
                    household_id: "hh-00000000-0001",
                    card_id: "card-3",
                    month: "2026-10",
                    statement_amount: 500,
                    due_date: "2026-10-26", // 1 day away but paid -> no alert
                    is_paid: true,
                    card: {
                        id: "card-3",
                        household_id: "hh-00000000-0001",
                        owner_id: "mem-00000000-0012",
                        name: "UOB One",
                        bank: "UOB",
                        billing_day: 1,
                        due_day: 26,
                        color: "#3B82F6",
                        is_active: true,
                    },
                },
            ];

            const alerts = checkCreditCardDueReminders(statements, today);
            expect(alerts).toHaveLength(1);
            expect(alerts[0].title).toBe("DBS Altitude Due in 3 Days");
            expect(alerts[0].message).toBe("S$1,245.50 statement");
            expect(alerts[0].actionLabel).toBe("View Bill");
            expect(alerts[0].id).toBe("reminder-cc-due-stmt-1-d5");
        });

        it("escalates credit card due reminders through each configured offset", () => {
            expect(getDueStage(8, [7, 3, 1, 0])).toBeNull();
            expect(getDueStage(7, [7, 3, 1, 0])).toBe("d7");
            expect(getDueStage(5, [7, 3, 1, 0])).toBe("d7");
            expect(getDueStage(2, [7, 3, 1, 0])).toBe("d3");
            expect(getDueStage(1, [7, 3, 1, 0])).toBe("d1");
            expect(getDueStage(0, [7, 3, 1, 0])).toBe("d0");
            expect(getDueStage(-1, [7, 3, 1, 0])).toBe("overdue");
            // Offsets turned off never fire
            expect(getDueStage(5, [1, 0])).toBeNull();

            const stmt: CreditCardStatement = {
                id: "stmt-esc",
                household_id: "hh-00000000-0001",
                card_id: "card-1",
                month: "2026-10",
                statement_amount: 100,
                due_date: "2026-10-28",
                is_paid: false,
            };
            const ids = [
                "2026-10-21",
                "2026-10-24",
                "2026-10-25",
                "2026-10-27",
                "2026-10-28",
                "2026-10-29",
            ].map(
                (day) =>
                    checkCreditCardDueReminders([stmt], day, [7, 3, 1, 0])[0]
                        ?.id,
            );
            expect(ids).toEqual([
                "reminder-cc-due-stmt-esc-d7",
                "reminder-cc-due-stmt-esc-d7",
                "reminder-cc-due-stmt-esc-d3",
                "reminder-cc-due-stmt-esc-d1",
                "reminder-cc-due-stmt-esc-d0",
                "reminder-cc-due-stmt-esc-overdue",
            ]);
        });

        it("dispatches PWA notification when permitted", async () => {
            // Mock window Notification
            const showNotificationMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(window, "Notification", {
                value: class MockNotification {
                    static permission = "granted";
                    static requestPermission = vi
                        .fn()
                        .mockResolvedValue("granted");
                },
                configurable: true,
                writable: true,
            });

            // Mock navigator.serviceWorker
            Object.defineProperty(navigator, "serviceWorker", {
                value: {
                    getRegistration: vi.fn().mockResolvedValue({
                        showNotification: showNotificationMock,
                    }),
                },
                configurable: true,
            });

            const dispatched = await dispatchPWANotification("Test Title", {
                body: "Test body",
            });
            expect(dispatched).toBe(true);
            expect(showNotificationMock).toHaveBeenCalledWith(
                "Test Title",
                expect.objectContaining({
                    body: "Test body",
                }),
            );

            // Test permission request
            const perm = await requestNotificationPermission();
            expect(perm).toBe("granted");
        });

        it("renders notification bell with badge count in NotificationCenterPopover and handles quick actions", async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            vi.setSystemTime(new Date("2026-10-29T19:00:00+08:00"));

            // Mock active reminders via computeActiveReminders
            // Nobody has logged for 4 days, so Bubby nudges
            vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([
                {
                    id: "old",
                    household_id: "hh-00000000-0001",
                    member_id: "mem-00000000-0012",
                    checkin_date: "2026-10-25",
                    type: "expense",
                },
            ]);
            vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
            vi.spyOn(
                financeService,
                "getAllAccountSnapshots",
            ).mockResolvedValue([]);
            vi.spyOn(
                financeService,
                "getCreditCardStatements",
            ).mockResolvedValue([
                {
                    id: "stmt-alert",
                    household_id: "hh-00000000-0001",
                    card_id: "card-1",
                    month: "2026-10",
                    statement_amount: 450,
                    due_date: getTodayDateString(),
                    is_paid: false,
                    card: {
                        id: "card-1",
                        household_id: "hh-00000000-0001",
                        owner_id: "mem-00000000-0011",
                        name: "DBS Altitude",
                        bank: "DBS",
                        billing_day: 1,
                        due_day: 28,
                        color: "#10B981",
                        is_active: true,
                    },
                },
            ]);

            const onNavigateTab = vi.fn();

            renderWithProviders(
                <NotificationCenterPopover onNavigateTab={onNavigateTab} />,
            );

            // Bell button should display badge count
            const bellBtn = await screen.findByTestId("notification-bell-btn");
            expect(bellBtn).toBeInTheDocument();

            const badge = await screen.findByTestId("notification-badge-count");
            expect(Number(badge.textContent)).toBeGreaterThanOrEqual(1);

            // Open popover
            await act(async () => {
                fireEvent.click(bellBtn);
            });

            const popover = screen.getByTestId("notification-center-popover");
            expect(popover).toBeInTheDocument();
            expect(screen.getByText("Notifications")).toBeInTheDocument();

            // Opening the bell marks reminders read and clears the badge
            await waitFor(() => {
                expect(
                    screen.queryByTestId("notification-badge-count"),
                ).not.toBeInTheDocument();
            });

            const recordSpy = vi
                .spyOn(financeService, "recordDailyCheckin")
                .mockResolvedValueOnce({
                    id: "chk-quick-notif",
                    household_id: "hh-00000000-0001",
                    member_id: "mem-00000000-0011",
                    checkin_date: getTodayDateString(),
                    type: "no_spend",
                });

            // "Add Expense" opens the add-expense flow and does NOT record a check-in
            const quickAddListener = vi.fn();
            window.addEventListener("openQuickAdd", quickAddListener);
            const checkinActionBtn = screen.getByTestId(
                "reminder-action-check_in",
            );
            expect(checkinActionBtn.textContent).toContain("Add Expense");
            await act(async () => {
                fireEvent.click(checkinActionBtn);
            });
            window.removeEventListener("openQuickAdd", quickAddListener);
            expect(quickAddListener).toHaveBeenCalledTimes(1);
            expect(recordSpy).not.toHaveBeenCalled();

            // Reopen; "No Spend" records an explicit no-spend check-in
            await act(async () => {
                fireEvent.click(bellBtn);
            });
            await act(async () => {
                fireEvent.click(screen.getByTestId("reminder-action-no-spend"));
            });
            expect(recordSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                getTodayDateString(),
                "no_spend",
            );

            // Check CC Action button
            const ccActionBtns = screen.getAllByTestId(
                "reminder-action-view_cc",
            );
            expect(ccActionBtns.length).toBeGreaterThanOrEqual(1);
            await act(async () => {
                fireEvent.click(ccActionBtns[0]);
            });
            expect(onNavigateTab).toHaveBeenCalledWith("expenses");
        });

        it("renders mobile full-screen notification overlay on mobile viewports, does NOT close when clicking inside, and allows closing via close button", async () => {
            vi.spyOn(window, "innerWidth", "get").mockReturnValue(375);
            renderWithProviders(<NotificationCenterPopover />);

            const bellBtn = await screen.findByTestId("notification-bell-btn");
            await act(async () => {
                fireEvent.click(bellBtn);
            });

            const overlay = screen.getByTestId(
                "notification-center-mobile-overlay",
            );
            expect(overlay).toBeInTheDocument();

            // Clicking anywhere inside the overlay must NOT close it
            await act(async () => {
                fireEvent.mouseDown(overlay);
                fireEvent.click(overlay);
            });
            expect(
                screen.getByTestId("notification-center-mobile-overlay"),
            ).toBeInTheDocument();

            const closeBtn = screen.getByTestId(
                "close-notification-overlay-btn",
            );
            expect(closeBtn).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(closeBtn);
            });

            expect(
                screen.queryByTestId("notification-center-mobile-overlay"),
            ).not.toBeInTheDocument();
        });

        it("stores dismissals in the notification log per member", async () => {
            const memberId = "mem-test-dismiss";
            await financeService.dismissNotification(memberId, {
                key: "rem-1",
                type: "budget_limit",
            });
            await financeService.dismissNotification(memberId, {
                key: "rem-2",
                type: "budget_limit",
            });

            const dismissed = (
                await financeService.getNotificationLog(memberId)
            )
                .filter((e) => e.dismissed_at)
                .map((e) => e.reminder_key);
            expect(dismissed).toEqual(
                expect.arrayContaining(["rem-1", "rem-2"]),
            );
            expect(dismissed).not.toContain("rem-3");
            expect(
                await financeService.getNotificationLog("mem-other"),
            ).toHaveLength(0);
        });

        it("migrates legacy localStorage dismissals into the notification log", async () => {
            const memberId = "mem-test-legacy";
            localStorage.setItem(
                `bb_notif_dismissed_${memberId}`,
                JSON.stringify(["old-1", "old-2"]),
            );

            await migrateLegacyDismissals(memberId);

            expect(getDismissedReminderIds(memberId).size).toBe(0);
            const keys = (await financeService.getNotificationLog(memberId))
                .filter((e) => e.dismissed_at)
                .map((e) => e.reminder_key);
            expect(keys).toEqual(expect.arrayContaining(["old-1", "old-2"]));
        });

        it("hides dismissed reminders from computeActiveReminders", async () => {
            const memberId = "mem-00000000-0011";
            const referenceDate = new Date("2026-10-29T19:00:00");
            // Bubby has gone 4 days without food, so the nudge is active
            vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
            vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([
                {
                    id: "old",
                    household_id: "hh-1",
                    member_id: "mem-00000000-0012",
                    checkin_date: "2026-10-25",
                    type: "expense",
                },
            ]);
            const before = await computeActiveReminders({
                memberId,
                currentHour: 19,
                referenceDate,
            });
            const checkin = before.find((r) => r.type === "daily_checkin");
            expect(checkin).toBeDefined();

            await financeService.dismissNotification(memberId, {
                key: checkin!.id,
                type: checkin!.type,
            });

            const after = await computeActiveReminders({
                memberId,
                currentHour: 19,
                referenceDate,
            });
            expect(after.find((r) => r.id === checkin!.id)).toBeUndefined();
        });

        it("does not request notification permission on mount and only prompts from an explicit button tap", async () => {
            const requestMock = vi.fn().mockResolvedValue("granted");
            Object.defineProperty(window, "Notification", {
                value: {
                    permission: "default",
                    requestPermission: requestMock,
                },
                configurable: true,
                writable: true,
            });

            const perm = await checkAndPromptInitialNotificationPermission();
            expect(perm).toBe("default");
            expect(requestMock).not.toHaveBeenCalled();
            expect(
                localStorage.getItem("bb_notif_initial_prompted"),
            ).toBeNull();

            renderWithProviders(<NotificationCenterPopover />);
            const bellBtn = await screen.findByTestId("notification-bell-btn");
            expect(requestMock).not.toHaveBeenCalled();
            expect(
                localStorage.getItem("bb_notif_initial_prompted"),
            ).toBeNull();

            await act(async () => {
                fireEvent.click(bellBtn);
            });

            const enableBtn = await screen.findByTestId(
                "enable-push-notifications-btn",
            );
            await act(async () => {
                fireEvent.click(enableBtn);
            });

            expect(requestMock).toHaveBeenCalledTimes(1);
            expect(localStorage.getItem("bb_notif_initial_prompted")).toBe(
                "true",
            );
        });

        it("uses logged-in member (me.id) for push sync, claims, read/dismiss state, and No Spend check-in in Combined view", async () => {
            vi.useFakeTimers({ shouldAdvanceTime: true });
            vi.setSystemTime(new Date("2026-10-29T19:00:00+08:00"));

            const syncSpy = vi
                .spyOn(pushSubscriptionModule, "syncPushSubscription")
                .mockResolvedValue();
            vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([
                {
                    id: "old",
                    household_id: "hh-00000000-0001",
                    member_id: "mem-00000000-0011",
                    checkin_date: "2026-10-25",
                    type: "expense",
                },
            ]);
            vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
            vi.spyOn(
                financeService,
                "getAllAccountSnapshots",
            ).mockResolvedValue([]);
            const markReadSpy = vi.spyOn(
                financeService,
                "markNotificationsRead",
            );
            const dismissSpy = vi.spyOn(financeService, "dismissNotification");
            const recordSpy = vi
                .spyOn(financeService, "recordDailyCheckin")
                .mockResolvedValue({
                    id: "chk-rachel",
                    household_id: "hh-00000000-0001",
                    member_id: "mem-00000000-0012",
                    checkin_date: getTodayDateString(),
                    type: "no_spend",
                });

            render(
                <MemoryRouter>
                    <AuthProvider
                        initialAuthenticated={true}
                        initialPartner="rachel"
                    >
                        <HouseholdProvider defaultPerspective="household">
                            <NotificationCenterPopover />
                        </HouseholdProvider>
                    </AuthProvider>
                </MemoryRouter>,
            );

            await waitFor(() => {
                expect(syncSpy).toHaveBeenCalledWith(
                    "mem-00000000-0012",
                    expect.any(Boolean),
                );
            });

            const bellBtn = await screen.findByTestId("notification-bell-btn");
            await screen.findByTestId("notification-badge-count");

            await act(async () => {
                fireEvent.click(bellBtn);
            });

            await waitFor(() => {
                expect(markReadSpy).toHaveBeenCalledWith(
                    "mem-00000000-0012",
                    expect.any(Array),
                );
            });

            const noSpendBtn = await screen.findByTestId(
                "reminder-action-no-spend",
            );
            await act(async () => {
                fireEvent.click(noSpendBtn);
            });

            expect(recordSpy).toHaveBeenCalledWith(
                "mem-00000000-0012",
                getTodayDateString(),
                "no_spend",
            );
            expect(dismissSpy).toHaveBeenCalledWith(
                "mem-00000000-0012",
                expect.objectContaining({ type: "daily_checkin" }),
            );
        });
    });

    // =========================================================================
    // 3. Expanded Notification Domain Checkers
    // =========================================================================
    describe("Expanded Notification Domain Checkers", () => {
        it("checkMissingCreditCardStatements detects cards past billing day with no statement", () => {
            const cards: CreditCard[] = [
                {
                    id: "card-1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    name: "DBS Altitude",
                    bank: "DBS",
                    billing_day: 10,
                    due_day: 28,
                    color: "#10B981",
                    is_active: true,
                },
                {
                    id: "card-2",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    name: "OCBC 365",
                    bank: "OCBC",
                    billing_day: 25,
                    due_day: 15,
                    color: "#EC4899",
                    is_active: true,
                },
            ];

            const statements: CreditCardStatement[] = [
                {
                    id: "stmt-1",
                    card_id: "card-1",
                    household_id: "hh-1",
                    month: "2026-10",
                    statement_amount: 500,
                    due_date: "2026-10-28",
                    is_paid: false,
                },
            ];

            // On Oct 15: card-1 billing day (10) passed but has statement.
            // card-2 billing day (25) not yet passed.
            const r1 = checkMissingCreditCardStatements(
                cards,
                statements,
                new Date("2026-10-15T12:00:00"),
            );
            expect(r1).toHaveLength(0);

            // On Oct 26: card-2 billing day (25) passed and has NO statement!
            const r2 = checkMissingCreditCardStatements(
                cards,
                statements,
                new Date("2026-10-26T12:00:00"),
            );
            expect(r2).toHaveLength(1);
            expect(r2[0].type).toBe("credit_card_missing_stmt");
            expect(r2[0].title).toBe("OCBC 365 Statement Ready");
            expect(r2[0].message).toBe("Cycle closed on day 25.");
        });

        it("checkPartnerSharedSpendReminders alerts for recent unsettled expenses paid by partner", () => {
            const members: HouseholdMember[] = [
                {
                    id: "mem-1",
                    household_id: "hh-1",
                    display_name: "Yi Jia",
                    role: "owner",
                },
                {
                    id: "mem-2",
                    household_id: "hh-1",
                    display_name: "Rachel",
                    role: "member",
                },
            ];

            const expenses: Expense[] = [
                {
                    id: "exp-1",
                    household_id: "hh-1",
                    payer_id: "mem-2", // Rachel paid
                    date: "2026-10-27",
                    item: "Din Tai Fung",
                    amount: 80,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                },
                {
                    id: "exp-2",
                    household_id: "hh-1",
                    payer_id: "mem-1", // Yi Jia paid -> don't alert Yi Jia
                    date: "2026-10-27",
                    item: "Groceries",
                    amount: 50,
                    is_shared: true,
                    split_ratio: 0.5,
                    settled: false,
                },
            ];

            const reminders = checkPartnerSharedSpendReminders(
                expenses,
                members,
                "mem-1",
                "2026-10-28",
            );
            expect(reminders).toHaveLength(1);
            expect(reminders[0].type).toBe("partner_shared_spend");
            expect(reminders[0].title).toBe("Rachel Logged Din Tai Fung");
            expect(reminders[0].message).toBe("Your share: S$40.00");
        });

        it("checkPartnerSharedSpendReminders sends one daily summary for several expenses", () => {
            const members: HouseholdMember[] = [
                {
                    id: "mem-1",
                    household_id: "hh-1",
                    display_name: "Yi Jia",
                    role: "owner",
                },
                {
                    id: "mem-2",
                    household_id: "hh-1",
                    display_name: "Rachel",
                    role: "member",
                },
            ];
            const shared = {
                household_id: "hh-1",
                payer_id: "mem-2",
                is_shared: true,
                split_ratio: 0.5,
                settled: false,
            };
            const expenses: Expense[] = [
                {
                    ...shared,
                    id: "exp-a",
                    date: "2026-10-26",
                    item: "Dinner",
                    amount: 60,
                },
                {
                    ...shared,
                    id: "exp-b",
                    date: "2026-10-27",
                    item: "Taxi",
                    amount: 20,
                },
                {
                    ...shared,
                    id: "exp-c",
                    date: "2026-10-28",
                    item: "Groceries",
                    amount: 100,
                },
            ];

            const day1 = checkPartnerSharedSpendReminders(
                expenses,
                members,
                "mem-1",
                "2026-10-28",
            );
            expect(day1).toHaveLength(1);
            expect(day1[0].title).toBe("Rachel Logged 3 Expenses");
            expect(day1[0].message).toBe("Your share: S$90.00");
            expect(day1[0].id).toBe(
                "reminder-partner-spend-mem-1-mem-2-2026-10-28",
            );

            // Next day is a new summary key
            const day2 = checkPartnerSharedSpendReminders(
                expenses,
                members,
                "mem-1",
                "2026-10-29",
            );
            expect(day2[0].id).toBe(
                "reminder-partner-spend-mem-1-mem-2-2026-10-29",
            );
        });

        it("checkSettlementReminder triggers when net balance exceeds threshold or month-end", () => {
            const summary: SettlementSummary = {
                netBalance: 250,
                debtorId: "mem-2",
                creditorId: "mem-1",
                settlementText: "Rachel owes Yi Jia S$250.00",
                member1OwesMember2: 0,
                member2OwesMember1: 250,
            };

            // Exceeds 200 threshold
            const rExceed = checkSettlementReminder(
                summary,
                200,
                new Date("2026-10-15T12:00:00"),
            );
            expect(rExceed).not.toBeNull();
            expect(rExceed?.type).toBe("settlement_due");
            expect(rExceed?.message).toBe("S$250.00 unsettled");

            // Balance changes within the month keep the same key (one push per month)
            const rExceedLater = checkSettlementReminder(
                { ...summary, netBalance: 310 },
                200,
                new Date("2026-10-20T12:00:00"),
            );
            expect(rExceedLater?.id).toBe(rExceed?.id);
            expect(rExceed?.id).toBe("reminder-settlement-2026-10");

            // Below threshold and mid-month -> null
            const summarySmall: SettlementSummary = {
                ...summary,
                netBalance: 50,
            };
            const rSmallMid = checkSettlementReminder(
                summarySmall,
                200,
                new Date("2026-10-15T12:00:00"),
            );
            expect(rSmallMid).toBeNull();

            // Below threshold but month-end (>= 27th) -> triggers reminder
            const rSmallEnd = checkSettlementReminder(
                summarySmall,
                200,
                new Date("2026-10-28T12:00:00"),
            );
            expect(rSmallEnd).not.toBeNull();
            expect(rSmallEnd?.type).toBe("settlement_due");
            // Month-end reminder has its own key
            expect(rSmallEnd?.id).toBe("reminder-settlement-monthend-2026-10");
        });

        it("checkBudgetLimitReminders alerts for spendable categories nearing or exceeding cap", () => {
            const monthlyBudget: MonthlyBudgetDetail = {
                budget: {
                    id: "b-1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    month: "2026-10",
                    gross_salary: 5000,
                    bonus: 0,
                    cpf_deduction: 1000,
                    taxes_deduction: 200,
                    insurance_deduction: 300,
                    after_deductions: 3500,
                    is_locked: false,
                },
                disposablePool: 3500,
                totalSpent: 1500,
                totalRemaining: 2000,
                categories: [
                    {
                        id: "c-1",
                        monthly_budget_id: "b-1",
                        category_id: "cat-groceries",
                        percentage: 0.2,
                        allocated_amount: 500,
                        actualSpent: 420, // 84% -> nearing warning
                        remaining: 80,
                        category: {
                            id: "cat-groceries",
                            household_id: "hh-1",
                            name: "Groceries",
                            color: "#10B981",
                            icon: "shopping-cart",
                            is_system: false,
                            group: "spendable",
                        },
                    },
                    {
                        id: "c-2",
                        monthly_budget_id: "b-1",
                        category_id: "cat-dining",
                        percentage: 0.2,
                        allocated_amount: 400,
                        actualSpent: 450, // 112.5% -> exceeded alert
                        remaining: -50,
                        category: {
                            id: "cat-dining",
                            household_id: "hh-1",
                            name: "Dining Out",
                            color: "#F59E0B",
                            icon: "utensils",
                            is_system: false,
                            group: "spendable",
                        },
                    },
                ],
            };

            const alerts = checkBudgetLimitReminders(monthlyBudget, 80);
            expect(alerts).toHaveLength(2);
            const exceeded = alerts.find((a) => a.severity === "alert");
            const nearing = alerts.find((a) => a.severity === "warning");
            expect(exceeded?.title).toBe("Dining Out Over Budget");
            expect(exceeded?.message).toBe("S$50.00 over (113%)");
            expect(nearing?.title).toBe("Groceries at 84%");
            expect(nearing?.message).toBe("S$80.00 left");

            // Same key all month regardless of the exact percentage
            const later = checkBudgetLimitReminders(
                {
                    ...monthlyBudget,
                    categories: monthlyBudget.categories.map((c) =>
                        c.category_id === "cat-groceries"
                            ? { ...c, actualSpent: 470 }
                            : c,
                    ),
                },
                80,
            );
            expect(later.find((a) => a.severity === "warning")?.id).toBe(
                nearing?.id,
            );
            expect(nearing?.id).toBe(
                "reminder-budget-nearing-cat-groceries-2026-10",
            );
            expect(exceeded?.id).toBe(
                "reminder-budget-exceeded-cat-dining-2026-10",
            );
        });

        it("checkRecurringBillsReminders alerts for annual recurring items due in current month", () => {
            const recurringItems: RecurringItem[] = [
                {
                    id: "pol-1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    type: "insurance",
                    name: "Manulife LifeReady Plus",
                    amount: 2400,
                    frequency: "annually",
                    payment_month: 10, // October
                    due_day: 25,
                    monthly_amortized_amount: 200,
                },
                {
                    id: "pol-2",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    type: "insurance",
                    name: "IncomeShield Plan",
                    amount: 600,
                    frequency: "annually",
                    payment_month: 3, // March
                    monthly_amortized_amount: 50,
                },
            ];

            const rOct = checkRecurringBillsReminders(
                recurringItems,
                new Date("2026-10-15T12:00:00"),
            );
            expect(rOct).toHaveLength(1);
            expect(rOct[0].type).toBe("recurring_bill_due");
            expect(rOct[0].title).toBe(
                "Manulife LifeReady Plus Renews in 10 Days",
            );
            expect(rOct[0].message).toBe("S$2,400.00 insurance");
            expect(rOct[0].id).toBe("reminder-recurring-pol-1-2026-10-25");
        });

        it("checkRecurringBillsReminders uses due day for monthly items and clamps short months", () => {
            const base = {
                household_id: "hh-1",
                owner_id: "mem-1",
                type: "bill" as const,
                amount: 90,
                frequency: "monthly" as const,
                monthly_amortized_amount: 90,
            };
            const recurringItems: RecurringItem[] = [
                { ...base, id: "bill-31", name: "SP Utilities", due_day: 31 },
                { ...base, id: "bill-10", name: "Phone Plan", due_day: 10 },
                {
                    ...base,
                    id: "bill-ended",
                    name: "Old Gym",
                    due_day: 30,
                    end_date: "2026-10-31",
                },
            ];

            // 28 Nov 2026: day 31 clamps to 30 Nov -> due in 2 days; day 10 is 12 days away
            const r = checkRecurringBillsReminders(
                recurringItems,
                new Date("2026-11-28T09:00:00"),
            );
            expect(r).toHaveLength(1);
            expect(r[0].title).toBe("SP Utilities Due in 2 Days");
            expect(r[0].message).toBe("S$90.00 bill");
            expect(r[0].id).toBe("reminder-recurring-bill-31-2026-11-30");
        });

        it("checkRecurringBillsReminders skips annual items more than 30 days away", () => {
            const recurringItems: RecurringItem[] = [
                {
                    id: "ins-dec",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    type: "insurance",
                    name: "Year End Shield",
                    amount: 1200,
                    frequency: "annually",
                    payment_month: 12,
                    due_day: 20,
                    monthly_amortized_amount: 100,
                },
            ];
            expect(
                checkRecurringBillsReminders(
                    recurringItems,
                    new Date("2026-11-04T09:00:00"),
                ),
            ).toHaveLength(0);
            const r = checkRecurringBillsReminders(
                recurringItems,
                new Date("2026-11-25T09:00:00"),
            );
            expect(r).toHaveLength(1);
            expect(r[0].title).toBe("Year End Shield Renews in 25 Days");
        });

        it("checkGoalPacingReminders alerts when savings goals are behind target or achieved", () => {
            const goals: SavingsGoal[] = [
                {
                    id: "goal-1",
                    household_id: "hh-1",
                    title: "Japan Holiday",
                    target_amount: 6000,
                    saved_so_far: 2000,
                    target_date: "2026-12-31",
                    monthly_contribution: 500,
                    emoji: "✈️",
                    status: "behind",
                },
                {
                    id: "goal-2",
                    household_id: "hh-1",
                    title: "Emergency Fund",
                    target_amount: 10000,
                    saved_so_far: 10000,
                    target_date: "2027-01-01",
                    monthly_contribution: 1000,
                    emoji: "🛡️",
                    status: "achieved",
                },
            ];

            const r = checkGoalPacingReminders(
                goals,
                new Date("2026-10-15T12:00:00"),
            );
            expect(r).toHaveLength(2);
            const behind = r.find((g) => g.data?.goalId === "goal-1");
            const achieved = r.find((g) => g.data?.goalId === "goal-2");
            expect(behind?.title).toBe("Japan Holiday Behind Pace");
            expect(behind?.message).toBe("S$2,000.00 of S$6,000.00 saved");
            expect(achieved?.title).toBe("Goal Reached: Emergency Fund");

            // Behind: new key each month. Achieved: one key forever.
            const nextMonth = checkGoalPacingReminders(
                goals,
                new Date("2026-11-02T12:00:00"),
            );
            expect(behind?.id).toBe("reminder-goal-behind-goal-1-2026-10");
            expect(nextMonth.find((g) => g.data?.goalId === "goal-1")?.id).toBe(
                "reminder-goal-behind-goal-1-2026-11",
            );
            expect(nextMonth.find((g) => g.data?.goalId === "goal-2")?.id).toBe(
                achieved?.id,
            );
        });

        it("checkMonthlyBudgetReviewReminder triggers on days 1-5 when budget is unlocked", () => {
            const monthlyBudget: MonthlyBudgetDetail = {
                budget: {
                    id: "b-1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    month: "2026-11",
                    gross_salary: 5000,
                    bonus: 0,
                    cpf_deduction: 1000,
                    taxes_deduction: 200,
                    insurance_deduction: 300,
                    after_deductions: 3500,
                    is_locked: false,
                },
                disposablePool: 3500,
                totalSpent: 0,
                totalRemaining: 3500,
                categories: [],
            };

            // Day 3 -> triggers
            const rDay3 = checkMonthlyBudgetReviewReminder(
                monthlyBudget,
                new Date("2026-11-03T12:00:00"),
            );
            expect(rDay3).not.toBeNull();
            expect(rDay3?.type).toBe("monthly_budget_review");
            expect(rDay3?.title).toBe("Review Nov Budget");

            // Day 10 -> no reminder
            const rDay10 = checkMonthlyBudgetReviewReminder(
                monthlyBudget,
                new Date("2026-11-10T12:00:00"),
            );
            expect(rDay10).toBeNull();
        });
    });

    // =========================================================================
    // 3b. Timing: check-in time and quiet hours
    // =========================================================================
    describe("Notification Timing", () => {
        const hungry: DailyCheckin[] = [
            {
                id: "c",
                household_id: "hh-1",
                member_id: "mem-1",
                checkin_date: "2026-10-24",
                type: "expense",
            },
        ];

        it("starts the Bubby nudge at the member check-in time", () => {
            expect(
                checkBubbyReminder(
                    hungry,
                    [],
                    19,
                    "mem-1",
                    "2026-10-28",
                    "20:00",
                ),
            ).toBeNull();
            expect(
                checkBubbyReminder(
                    hungry,
                    [],
                    20,
                    "mem-1",
                    "2026-10-28",
                    "20:00",
                ),
            ).not.toBeNull();
            expect(
                checkBubbyReminder(
                    hungry,
                    [],
                    7,
                    "mem-1",
                    "2026-10-28",
                    "07:00",
                ),
            ).not.toBeNull();
        });

        it("detects quiet hours, including windows past midnight", () => {
            expect(timeToMinutes("18:30")).toBe(1110);
            expect(timeToMinutes("18:30:00")).toBe(1110);
            expect(timeToMinutes("bad")).toBeNull();

            // 22:00 -> 08:00 wraps midnight
            expect(
                isWithinQuietHours(timeToMinutes("23:15")!, "22:00", "08:00"),
            ).toBe(true);
            expect(
                isWithinQuietHours(timeToMinutes("03:00")!, "22:00", "08:00"),
            ).toBe(true);
            expect(
                isWithinQuietHours(timeToMinutes("08:00")!, "22:00", "08:00"),
            ).toBe(false);
            expect(
                isWithinQuietHours(timeToMinutes("21:59")!, "22:00", "08:00"),
            ).toBe(false);
            // Same-day window
            expect(
                isWithinQuietHours(timeToMinutes("13:00")!, "12:00", "14:00"),
            ).toBe(true);
            expect(
                isWithinQuietHours(timeToMinutes("14:00")!, "12:00", "14:00"),
            ).toBe(false);
            // Equal start and end disables quiet hours
            expect(
                isWithinQuietHours(timeToMinutes("13:00")!, "12:00", "12:00"),
            ).toBe(false);
        });

        it("falls back to the legacy lead time for rows without cc_due_reminder_days", () => {
            const base = getDefaultNotificationPreferences("mem-1");
            expect(getCcDueReminderDays(base)).toEqual([7, 3, 1, 0]);
            expect(
                getCcDueReminderDays({
                    ...base,
                    cc_due_reminder_days: undefined,
                    cc_due_days_before: 5,
                }),
            ).toEqual([5]);
            expect(
                getCcDueReminderDays({ ...base, cc_due_reminder_days: [] }),
            ).toEqual([]);
        });

        it("holds pushes during quiet hours and sends them after", async () => {
            const showNotificationMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(window, "Notification", {
                value: class MockNotification {
                    static permission = "granted";
                    static requestPermission = vi
                        .fn()
                        .mockResolvedValue("granted");
                },
                configurable: true,
                writable: true,
            });
            Object.defineProperty(navigator, "serviceWorker", {
                value: {
                    getRegistration: vi.fn().mockResolvedValue({
                        showNotification: showNotificationMock,
                    }),
                },
                configurable: true,
            });

            const memberId = "mem-00000000-0011";
            await financeService.updateNotificationPreferences(memberId, {
                quiet_hours_start: "18:00",
                quiet_hours_end: "20:00",
            });
            const referenceDate = new Date("2026-10-29T19:00:00");

            // 19:00 is inside 18:00-20:00: nothing pushed
            const active = await evaluateAndDispatchReminders({
                memberId,
                currentHour: 19,
                referenceDate,
            });
            expect(active.length).toBeGreaterThan(0);
            expect(showNotificationMock).not.toHaveBeenCalled();

            // 20:00: quiet hours over, held reminders push
            await evaluateAndDispatchReminders({
                memberId,
                currentHour: 20,
                referenceDate,
            });
            expect(showNotificationMock).toHaveBeenCalled();
        });
    });

    // =========================================================================
    // 4. Notification Settings Modal
    // =========================================================================
    describe("NotificationSettingsModal Component", () => {
        it("renders master channels, category toggles, custom thresholds, and updates preferences", async () => {
            const onClose = vi.fn();
            renderWithProviders(
                <NotificationSettingsModal
                    isOpen={true}
                    onClose={onClose}
                    memberId="mem-00000000-0011"
                />,
            );

            expect(
                await screen.findByRole("heading", { name: "Settings" }),
            ).toBeInTheDocument();
            expect(screen.getByText("Push Notifications")).toBeInTheDocument();
            expect(
                screen.getByRole("heading", { name: "Sound Effects" }),
            ).toBeInTheDocument();

            // CC due chips: all on by default
            for (const day of [7, 3, 1, 0]) {
                expect(
                    await screen.findByTestId(`chip-cc-due-${day}`),
                ).toHaveAttribute("aria-pressed", "true");
            }

            const budgetWarningInput = screen.getByTestId(
                "input-budget-warning-pct",
            );
            expect(budgetWarningInput).toBeInTheDocument();
            expect(budgetWarningInput).toHaveValue(80);

            const updateSpy = vi.spyOn(
                financeService,
                "updateNotificationPreferences",
            );

            // Turning off 7d keeps the legacy lead time in sync with the largest offset
            await act(async () => {
                fireEvent.click(screen.getByTestId("chip-cc-due-7"));
            });
            expect(updateSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                expect.objectContaining({
                    cc_due_reminder_days: [3, 1, 0],
                    cc_due_days_before: 3,
                }),
            );
            expect(screen.getByTestId("chip-cc-due-7")).toHaveAttribute(
                "aria-pressed",
                "false",
            );

            // Timing fields
            expect(screen.getByTestId("input-checkin-time")).toHaveValue(
                "18:00",
            );
            expect(
                screen.getByText("6:00 PM nudge when Bubby needs a snack"),
            ).toBeInTheDocument();
            await act(async () => {
                fireEvent.change(screen.getByTestId("input-checkin-time"), {
                    target: { value: "20:30" },
                });
            });
            expect(updateSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                expect.objectContaining({ checkin_time: "20:30" }),
            );
            expect(
                screen.getByText("8:30 PM nudge when Bubby needs a snack"),
            ).toBeInTheDocument();

            await act(async () => {
                fireEvent.change(screen.getByTestId("input-quiet-start"), {
                    target: { value: "23:00" },
                });
            });
            expect(updateSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                expect.objectContaining({ quiet_hours_start: "23:00" }),
            );

            // Reset to defaults
            const resetBtn = screen.getByTestId(
                "reset-notification-defaults-btn",
            );
            await act(async () => {
                fireEvent.click(resetBtn);
            });

            expect(updateSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                expect.objectContaining({
                    cc_due_reminder_days: [7, 3, 1, 0],
                    checkin_time: "18:00",
                    budget_warning_pct: 80,
                }),
            );

            // Click Done
            const doneBtn = screen.getByRole("button", { name: /done/i });
            await act(async () => {
                fireEvent.click(doneBtn);
            });
            expect(onClose).toHaveBeenCalled();
        });

        it("hides notification types and custom thresholds when push_enabled is toggled off", async () => {
            const onClose = vi.fn();
            renderWithProviders(
                <NotificationSettingsModal
                    isOpen={true}
                    onClose={onClose}
                    memberId="mem-00000000-0011"
                />,
            );

            expect(
                await screen.findByText("Notification Types"),
            ).toBeInTheDocument();
            expect(screen.getByText("Custom Thresholds")).toBeInTheDocument();

            const pushToggle = screen.getByTestId("toggle-push-enabled");
            await act(async () => {
                fireEvent.click(pushToggle);
            });

            expect(
                screen.queryByText("Notification Types"),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByText("Custom Thresholds"),
            ).not.toBeInTheDocument();
            expect(screen.getByText(/Push is off/i)).toBeInTheDocument();

            // Sound Effects section remains accessible in its own category
            expect(
                screen.getByRole("heading", { name: "Sound Effects" }),
            ).toBeInTheDocument();
        });

        it("isSoundEffectsEnabled respects sound_enabled preference in localStorage", () => {
            localStorage.setItem(
                "bb_notif_prefs_mem-00000000-0011",
                JSON.stringify({ sound_enabled: false }),
            );
            expect(isSoundEffectsEnabled()).toBe(false);

            localStorage.setItem(
                "bb_notif_prefs_mem-00000000-0011",
                JSON.stringify({ sound_enabled: true }),
            );
            expect(isSoundEffectsEnabled()).toBe(true);
        });

        it("lets user type 65 into budget warning % without mid-typing clamping and saves on blur or Enter", async () => {
            const updateSpy = vi.spyOn(
                financeService,
                "updateNotificationPreferences",
            );
            renderWithProviders(
                <NotificationSettingsModal
                    isOpen={true}
                    onClose={vi.fn()}
                    memberId="mem-00000000-0011"
                />,
            );

            const input = await screen.findByTestId("input-budget-warning-pct");
            expect(input).toHaveValue(80);
            updateSpy.mockClear();

            // Clear and type "6" then "65"
            fireEvent.change(input, { target: { value: "" } });
            fireEvent.change(input, { target: { value: "6" } });
            expect(input).toHaveValue(6);
            fireEvent.change(input, { target: { value: "65" } });
            expect(input).toHaveValue(65);
            expect(updateSpy).not.toHaveBeenCalled();

            // Save on blur
            await act(async () => {
                fireEvent.blur(input);
            });
            expect(input).toHaveValue(65);
            expect(updateSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                expect.objectContaining({ budget_warning_pct: 65 }),
            );

            // Clamp and save on Enter
            updateSpy.mockClear();
            fireEvent.change(input, { target: { value: "30" } });
            expect(input).toHaveValue(30);
            await act(async () => {
                fireEvent.keyDown(input, { key: "Enter" });
            });
            expect(input).toHaveValue(50);
            expect(updateSpy).toHaveBeenCalledWith(
                "mem-00000000-0011",
                expect.objectContaining({ budget_warning_pct: 50 }),
            );
        });

        it("hides the Haptic Feedback row when navigator.vibrate is missing", async () => {
            const originalNavigator = window.navigator;
            const navWithoutVibrate = Object.create(
                Object.getPrototypeOf(originalNavigator),
                Object.getOwnPropertyDescriptors(originalNavigator),
            );
            delete (navWithoutVibrate as { vibrate?: unknown }).vibrate;
            Object.defineProperty(window, "navigator", {
                value: navWithoutVibrate,
                configurable: true,
                writable: true,
            });

            try {
                renderWithProviders(
                    <NotificationSettingsModal
                        isOpen={true}
                        onClose={vi.fn()}
                        memberId="mem-00000000-0011"
                    />,
                );
                expect(
                    await screen.findByRole("heading", { name: "Settings" }),
                ).toBeInTheDocument();
                expect(
                    screen.queryByTestId("toggle-haptics-enabled"),
                ).not.toBeInTheDocument();
                expect(
                    screen.queryByRole("heading", { name: "Haptic Feedback" }),
                ).not.toBeInTheDocument();
            } finally {
                Object.defineProperty(window, "navigator", {
                    value: originalNavigator,
                    configurable: true,
                    writable: true,
                });
            }
        });
    });

    // =========================================================================
    // 5. Double-Firing Prevention & Member Scoping
    // =========================================================================
    describe("Double-Firing Prevention & Member Scoping", () => {
        beforeEach(() => {
            sessionStorage.clear();
            localStorage.clear();
        });

        it("prevents double-firing when evaluateAndDispatchReminders is called concurrently", async () => {
            const showNotificationMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(window, "Notification", {
                value: class MockNotification {
                    static permission = "granted";
                    static requestPermission = vi
                        .fn()
                        .mockResolvedValue("granted");
                },
                configurable: true,
                writable: true,
            });

            Object.defineProperty(navigator, "serviceWorker", {
                value: {
                    getRegistration: vi.fn().mockResolvedValue({
                        showNotification: showNotificationMock,
                    }),
                },
                configurable: true,
            });

            vi.spyOn(
                financeService,
                "getAllAccountSnapshots",
            ).mockResolvedValue([]);
            vi.spyOn(
                financeService,
                "getCreditCardStatements",
            ).mockResolvedValue([]);
            vi.spyOn(financeService, "getCreditCards").mockResolvedValue([]);
            vi.spyOn(financeService, "getExpenses").mockResolvedValue([]);
            vi.spyOn(financeService, "getRecurringItems").mockResolvedValue([]);
            vi.spyOn(financeService, "getGoals").mockResolvedValue([]);
            // Nobody has logged for 5 days, so Bubby nudges
            vi.spyOn(financeService, "getDailyCheckins").mockResolvedValue([
                {
                    id: "old",
                    household_id: "hh-1",
                    member_id: "mem-2",
                    checkin_date: "2020-01-01",
                    type: "expense",
                },
            ]);
            vi.spyOn(financeService, "getMonthlyBudget").mockResolvedValue({
                budget: {
                    id: "b-1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    month: "2026-10",
                    gross_salary: 5000,
                    bonus: 0,
                    cpf_deduction: 1000,
                    taxes_deduction: 200,
                    insurance_deduction: 300,
                    after_deductions: 3500,
                    is_locked: true,
                },
                disposablePool: 3500,
                totalSpent: 0,
                totalRemaining: 3500,
                categories: [],
            });
            vi.spyOn(
                financeService,
                "getNotificationPreferences",
            ).mockResolvedValue({
                household_id: "hh-1",
                member_id: "mem-1",
                push_enabled: true,
                sound_enabled: true,
                haptics_enabled: true,
                streak_and_logging: true,
                monthly_balance_updates: false,
                cc_payment_due: false,
                cc_missing_statement: false,
                partner_shared_spend: false,
                budget_limit_alerts: false,
                recurring_bills_due: false,
                goal_pacing_alerts: false,
                monthly_budget_review: false,
                cc_due_days_before: 5,
                budget_warning_pct: 80,
                settlement_threshold_sgd: 200,
            });

            // Fire twice simultaneously during evening (currentHour: 19)
            await Promise.all([
                evaluateAndDispatchReminders({
                    memberId: "mem-1",
                    currentHour: 19,
                }),
                evaluateAndDispatchReminders({
                    memberId: "mem-1",
                    currentHour: 19,
                }),
            ]);

            // Daily check-in notification should have fired EXACTLY ONCE
            expect(showNotificationMock).toHaveBeenCalledTimes(1);

            // A new session (sessionStorage cleared, like reopening the PWA) does not push again
            sessionStorage.clear();
            await evaluateAndDispatchReminders({
                memberId: "mem-1",
                currentHour: 19,
            });
            expect(showNotificationMock).toHaveBeenCalledTimes(1);
        });

        it("does not push a dismissed reminder", async () => {
            const showNotificationMock = vi.fn().mockResolvedValue(undefined);
            Object.defineProperty(window, "Notification", {
                value: class MockNotification {
                    static permission = "granted";
                    static requestPermission = vi
                        .fn()
                        .mockResolvedValue("granted");
                },
                configurable: true,
                writable: true,
            });
            Object.defineProperty(navigator, "serviceWorker", {
                value: {
                    getRegistration: vi.fn().mockResolvedValue({
                        showNotification: showNotificationMock,
                    }),
                },
                configurable: true,
            });

            const memberId = "mem-00000000-0011";
            const referenceDate = new Date("2026-10-29T19:00:00");
            const active = await computeActiveReminders({
                memberId,
                currentHour: 19,
                referenceDate,
            });
            for (const r of active) {
                await financeService.dismissNotification(memberId, {
                    key: r.id,
                    type: r.type,
                });
            }

            await evaluateAndDispatchReminders({
                memberId,
                currentHour: 19,
                referenceDate,
            });
            expect(showNotificationMock).not.toHaveBeenCalled();
        });

        it("strictly scopes credit card due reminders to active member", () => {
            const today = "2026-10-25";
            const statements: CreditCardStatement[] = [
                {
                    id: "stmt-mem1",
                    household_id: "hh-1",
                    card_id: "card-mem1",
                    month: "2026-10",
                    statement_amount: 1200,
                    due_date: "2026-10-28",
                    is_paid: false,
                    card: {
                        id: "card-mem1",
                        household_id: "hh-1",
                        owner_id: "mem-1",
                        name: "Yi Jia Card",
                        bank: "DBS",
                        billing_day: 1,
                        due_day: 28,
                        color: "#10B981",
                        is_active: true,
                    },
                },
                {
                    id: "stmt-mem2",
                    household_id: "hh-1",
                    card_id: "card-mem2",
                    month: "2026-10",
                    statement_amount: 800,
                    due_date: "2026-10-28",
                    is_paid: false,
                    card: {
                        id: "card-mem2",
                        household_id: "hh-1",
                        owner_id: "mem-2",
                        name: "Rachel Card",
                        bank: "UOB",
                        billing_day: 1,
                        due_day: 28,
                        color: "#EC4899",
                        is_active: true,
                    },
                },
            ];

            // For mem-1: only mem-1's card
            const alertsMem1 = checkCreditCardDueReminders(
                statements,
                today,
                5,
                "mem-1",
            );
            expect(alertsMem1).toHaveLength(1);
            expect(alertsMem1[0].title).toContain("Yi Jia Card");

            // For mem-2: only mem-2's card
            const alertsMem2 = checkCreditCardDueReminders(
                statements,
                today,
                5,
                "mem-2",
            );
            expect(alertsMem2).toHaveLength(1);
            expect(alertsMem2[0].title).toContain("Rachel Card");
        });

        it("strictly scopes missing credit card statements to active member", () => {
            const cards: CreditCard[] = [
                {
                    id: "card-mem1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    name: "Yi Jia Card",
                    bank: "DBS",
                    billing_day: 10,
                    due_day: 28,
                    color: "#10B981",
                    is_active: true,
                },
                {
                    id: "card-mem2",
                    household_id: "hh-1",
                    owner_id: "mem-2",
                    name: "Rachel Card",
                    bank: "OCBC",
                    billing_day: 10,
                    due_day: 28,
                    color: "#EC4899",
                    is_active: true,
                },
            ];

            const statements: CreditCardStatement[] = [];
            const testDate = new Date("2026-10-15T12:00:00");

            const alertsMem1 = checkMissingCreditCardStatements(
                cards,
                statements,
                testDate,
                "mem-1",
            );
            expect(alertsMem1).toHaveLength(1);
            expect(alertsMem1[0].title).toContain("Yi Jia Card");

            const alertsMem2 = checkMissingCreditCardStatements(
                cards,
                statements,
                testDate,
                "mem-2",
            );
            expect(alertsMem2).toHaveLength(1);
            expect(alertsMem2[0].title).toContain("Rachel Card");
        });

        it("strictly scopes recurring bills to active member", () => {
            const recurringItems: RecurringItem[] = [
                {
                    id: "pol-mem1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    type: "insurance",
                    name: "Yi Jia Life Insurance",
                    amount: 1500,
                    frequency: "annually",
                    payment_month: 10,
                    due_day: 20,
                    monthly_amortized_amount: 125,
                },
                {
                    id: "pol-mem2",
                    household_id: "hh-1",
                    owner_id: "mem-2",
                    type: "insurance",
                    name: "Rachel Health Insurance",
                    amount: 800,
                    frequency: "annually",
                    payment_month: 10,
                    due_day: 20,
                    monthly_amortized_amount: 66.67,
                },
            ];

            const testDate = new Date("2026-10-15T12:00:00");
            const alertsMem1 = checkRecurringBillsReminders(
                recurringItems,
                testDate,
                "mem-1",
            );
            expect(alertsMem1).toHaveLength(1);
            expect(alertsMem1[0].title).toContain("Yi Jia Life Insurance");

            const alertsMem2 = checkRecurringBillsReminders(
                recurringItems,
                testDate,
                "mem-2",
            );
            expect(alertsMem2).toHaveLength(1);
            expect(alertsMem2[0].title).toContain("Rachel Health Insurance");
        });

        it("surfaces goal pacing reminders across household goals to keep both partners aligned", () => {
            const goals: SavingsGoal[] = [
                {
                    id: "goal-mem1",
                    household_id: "hh-1",
                    owner_id: "mem-1",
                    title: "Yi Jia Tech Upgrade",
                    target_amount: 3000,
                    saved_so_far: 1000,
                    target_date: "2026-12-31",
                    monthly_contribution: 500,
                    emoji: "💻",
                    status: "behind",
                },
                {
                    id: "goal-joint",
                    household_id: "hh-1",
                    owner_id: null,
                    title: "Couple Vacation",
                    target_amount: 6000,
                    saved_so_far: 2000,
                    target_date: "2026-12-31",
                    monthly_contribution: 1000,
                    emoji: "🏖️",
                    status: "behind",
                },
            ];

            const alerts = checkGoalPacingReminders(goals);
            expect(alerts).toHaveLength(2);
            expect(
                alerts.some((g) => g.title.includes("Yi Jia Tech Upgrade")),
            ).toBe(true);
            expect(
                alerts.some((g) => g.title.includes("Couple Vacation")),
            ).toBe(true);
        });

        it("provides directional settlement notifications for debtor vs creditor", () => {
            const summary: SettlementSummary = {
                netBalance: 250,
                debtorId: "mem-2",
                creditorId: "mem-1",
                debtorName: "Rachel",
                creditorName: "Yi Jia",
                settlementText: "Rachel owes Yi Jia S$250.00",
                member1OwesMember2: 0,
                member2OwesMember1: 250,
            };

            const testDate = new Date("2026-10-15T12:00:00");

            // Debtor (mem-2) sees "You Owe Yi Jia"
            const debtorReminder = checkSettlementReminder(
                summary,
                200,
                testDate,
                "mem-2",
            );
            expect(debtorReminder).not.toBeNull();
            expect(debtorReminder?.title).toBe("You Owe Yi Jia");
            expect(debtorReminder?.message).toBe("S$250.00 to settle");
            expect(debtorReminder?.actionLabel).toBe("Settle Up");

            // Creditor (mem-1) sees "Rachel Owes You"
            const creditorReminder = checkSettlementReminder(
                summary,
                200,
                testDate,
                "mem-1",
            );
            expect(creditorReminder).not.toBeNull();
            expect(creditorReminder?.title).toBe("Rachel Owes You");
            expect(creditorReminder?.message).toBe("S$250.00 to settle");
            expect(creditorReminder?.actionLabel).toBe("View");
        });

        it("scopes reminder IDs with memberId to prevent cross-member collisions", () => {
            const hungry: DailyCheckin[] = [
                {
                    id: "c",
                    household_id: "hh-1",
                    member_id: "mem-1",
                    checkin_date: "2026-10-20",
                    type: "expense",
                },
            ];

            const r1 = checkBubbyReminder(
                hungry,
                [],
                19,
                "mem-1",
                "2026-10-28",
            );
            const r2 = checkBubbyReminder(
                hungry,
                [],
                19,
                "mem-2",
                "2026-10-28",
            );

            expect(r1?.id).toContain("mem-1");
            expect(r2?.id).toContain("mem-2");
            expect(r1?.id).not.toBe(r2?.id);
        });
    });
});
