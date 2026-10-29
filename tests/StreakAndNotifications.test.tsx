/**
 * Daily Check-in Streak & Notifications Engine
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DailyCheckinStreakBar } from '../src/components/dashboard/DailyCheckinStreakBar';
import { NotificationCenterPopover } from '../src/components/layout/NotificationCenterPopover';
import { NotificationSettingsModal } from '../src/components/layout/NotificationSettingsModal';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { AuthProvider } from '../src/context/AuthContext';
import { financeService } from '../src/services/financeService';
import {
  checkDailyCheckinReminder,
  checkBalanceUpdateReminder,
  checkCreditCardDueReminders,
  checkMissingCreditCardStatements,
  checkPartnerSharedSpendReminders,
  checkSettlementReminder,
  checkCoupleStreakRiskReminder,
  checkBudgetLimitReminders,
  checkRecurringBillsReminders,
  checkGoalPacingReminders,
  checkMonthlyBudgetReviewReminder,
  requestNotificationPermission,
  dispatchPWANotification,
  dismissReminderId,
  getDismissedReminderIds,
  checkAndPromptInitialNotificationPermission,
} from '../src/lib/notificationScheduler';
import { isSoundEffectsEnabled } from '../src/lib/soundEffects';
import { getTodayDateString, getCurrentMonth } from '../src/lib/dateUtils';
import type {
  StreakSummary,
  AccountSnapshot,
  CreditCardStatement,
  CreditCard,
  Expense,
  HouseholdMember,
  SettlementSummary,
  DailyCheckin,
  MonthlyBudgetDetail,
  RecurringPolicy,
  SavingsGoal,
} from '../src/types/finance';

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <MemoryRouter>
      <AuthProvider initialAuthenticated={true} initialPartner="yijia">
        <HouseholdProvider defaultPerspective="household">
          {ui}
        </HouseholdProvider>
      </AuthProvider>
    </MemoryRouter>
  );
}

describe('Daily Check-in Streak & Notifications Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. DailyCheckinStreakBar
  // =========================================================================
  describe('DailyCheckinStreakBar Component', () => {
    it('renders personal streak, couple streak, and 7-day mini calendar dots', async () => {
      renderWithProviders(
        <DailyCheckinStreakBar memberId="mem-00000000-0011" />
      );

      // Verify streak badge is displayed
      const personalBadge = await screen.findByTestId('personal-streak-badge');
      expect(personalBadge).toBeInTheDocument();
      expect(personalBadge.getAttribute('title')).toContain('streak');

      // Verify couple streak badge
      const coupleBadge = screen.getByTestId('couple-streak-badge');
      expect(coupleBadge).toBeInTheDocument();
      expect(coupleBadge.getAttribute('title')).toContain('streak');

      // Verify 7-day mini calendar dots
      const calendarDots = screen.getByTestId('streak-calendar-dots');
      expect(calendarDots).toBeInTheDocument();
      for (let i = 0; i < 7; i++) {
        expect(screen.getByTestId(`checkin-dot-${i}`)).toBeInTheDocument();
      }
    });

    it('shows "Checked in today!" if user has already checked in', async () => {
      // Mock streakSummary with checkedInToday = true
      vi.spyOn(financeService, 'getStreakSummary').mockResolvedValueOnce({
        currentStreak: 5,
        longestStreak: 12,
        checkedInToday: true,
        coupleStreak: 4,
        lastCheckinDate: getTodayDateString(),
      });

      renderWithProviders(
        <DailyCheckinStreakBar memberId="mem-00000000-0011" />
      );

      const status = await screen.findByTestId('checked-in-today-status');
      expect(status).toBeInTheDocument();
      expect(status.textContent).toContain('Checked in today!');
      expect(screen.queryByTestId('no-spend-checkin-btn')).not.toBeInTheDocument();
    });

    it('shows 1-tap "No Spend Today — Check In" button when not checked in and increments streak on click', async () => {
      const today = getTodayDateString();
      vi.spyOn(financeService, 'getStreakSummary').mockResolvedValueOnce({
        currentStreak: 3,
        longestStreak: 7,
        checkedInToday: false,
        coupleStreak: 2,
        lastCheckinDate: null,
      });

      const recordSpy = vi.spyOn(financeService, 'recordDailyCheckin').mockResolvedValueOnce({
        id: 'chk-new-test',
        household_id: 'hh-00000000-0001',
        member_id: 'mem-00000000-0011',
        checkin_date: today,
        type: 'no_spend',
      });

      const onCheckinSuccess = vi.fn();

      renderWithProviders(
        <DailyCheckinStreakBar
          memberId="mem-00000000-0011"
          onCheckinSuccess={onCheckinSuccess}
        />
      );

      const noSpendBtn = await screen.findByTestId('no-spend-checkin-btn');
      expect(noSpendBtn).toBeInTheDocument();
      expect(noSpendBtn.textContent).toContain('No Spend — Check In');

      // Click 1-tap button
      await act(async () => {
        fireEvent.click(noSpendBtn);
      });

      expect(recordSpy).toHaveBeenCalledWith('mem-00000000-0011', today, 'no_spend');
      expect(onCheckinSuccess).toHaveBeenCalled();

      // Should now display checked in today status
      await waitFor(() => {
        expect(screen.getByTestId('checked-in-today-status')).toBeInTheDocument();
      });
    });
  });

  // =========================================================================
  // 2. Notification Scheduler & NotificationCenterPopover
  // =========================================================================
  describe('Notification Engine & NotificationCenterPopover', () => {
    it('creates daily spend checkin reminder when user has not checked in today', () => {
      const reminderDay = checkDailyCheckinReminder(
        {
          currentStreak: 2,
          longestStreak: 5,
          checkedInToday: false,
          coupleStreak: 1,
        },
        14 // afternoon
      );
      expect(reminderDay).not.toBeNull();
      expect(reminderDay?.type).toBe('daily_checkin');
      expect(reminderDay?.actionLabel).toBe('Check In Now');

      // Evening reminder (hour >= 18)
      const reminderEvening = checkDailyCheckinReminder(
        {
          currentStreak: 2,
          longestStreak: 5,
          checkedInToday: false,
          coupleStreak: 1,
        },
        19
      );
      expect(reminderEvening?.title).toContain('Evening');

      // Checked in today -> no reminder
      const reminderNone = checkDailyCheckinReminder(
        {
          currentStreak: 3,
          longestStreak: 5,
          checkedInToday: true,
          coupleStreak: 2,
        },
        20
      );
      expect(reminderNone).toBeNull();
    });

    it('creates monthly balance update reminder on 1st and last days of month when snapshots are missing', () => {
      const currentMonth = getCurrentMonth();
      const firstDay = new Date(`${currentMonth}-01T12:00:00`);
      const midDay = new Date(`${currentMonth}-15T12:00:00`);
      const lastDay = new Date(`${currentMonth}-30T12:00:00`);

      const emptySnapshots: AccountSnapshot[] = [];
      const updatedSnapshots: AccountSnapshot[] = [
        {
          id: 'snap-1',
          household_id: 'hh-00000000-0001',
          account_id: 'acc-1',
          snapshot_date: `${currentMonth}-01`,
          balance: 1000,
        },
      ];

      // Missing on 1st -> reminder
      const r1 = checkBalanceUpdateReminder(emptySnapshots, firstDay);
      expect(r1).not.toBeNull();
      expect(r1?.type).toBe('balance_update');
      expect(r1?.actionLabel).toBe('Update Balances');

      // Missing on 15th -> no reminder (only 1st or end of month)
      const rMid = checkBalanceUpdateReminder(emptySnapshots, midDay);
      expect(rMid).toBeNull();

      // Missing on end of month -> reminder
      const rLast = checkBalanceUpdateReminder(emptySnapshots, lastDay);
      expect(rLast).not.toBeNull();

      // Already updated this month -> no reminder
      const rUpdated = checkBalanceUpdateReminder(updatedSnapshots, firstDay);
      expect(rUpdated).toBeNull();
    });

    it('creates credit card payment due alerts when unpaid statement is due within 5 days', () => {
      const today = '2026-10-25';
      const statements: CreditCardStatement[] = [
        {
          id: 'stmt-1',
          household_id: 'hh-00000000-0001',
          card_id: 'card-1',
          month: '2026-10',
          statement_amount: 1245.5,
          due_date: '2026-10-28', // 3 days away -> should alert
          is_paid: false,
          card: {
            id: 'card-1',
            household_id: 'hh-00000000-0001',
            owner_id: 'mem-00000000-0011',
            name: 'DBS Altitude',
            bank: 'DBS',
            billing_day: 1,
            due_day: 28,
            color: '#10B981',
            is_active: true,
          },
        },
        {
          id: 'stmt-2',
          household_id: 'hh-00000000-0001',
          card_id: 'card-2',
          month: '2026-10',
          statement_amount: 850,
          due_date: '2026-11-15', // 21 days away -> no alert
          is_paid: false,
          card: {
            id: 'card-2',
            household_id: 'hh-00000000-0001',
            owner_id: 'mem-00000000-0011',
            name: 'OCBC 365',
            bank: 'OCBC',
            billing_day: 1,
            due_day: 15,
            color: '#EC4899',
            is_active: true,
          },
        },
        {
          id: 'stmt-3',
          household_id: 'hh-00000000-0001',
          card_id: 'card-3',
          month: '2026-10',
          statement_amount: 500,
          due_date: '2026-10-26', // 1 day away but paid -> no alert
          is_paid: true,
          card: {
            id: 'card-3',
            household_id: 'hh-00000000-0001',
            owner_id: 'mem-00000000-0012',
            name: 'UOB One',
            bank: 'UOB',
            billing_day: 1,
            due_day: 26,
            color: '#3B82F6',
            is_active: true,
          },
        },
      ];

      const alerts = checkCreditCardDueReminders(statements, today);
      expect(alerts).toHaveLength(1);
      expect(alerts[0].title).toBe('Credit Card Payment Due');
      expect(alerts[0].message).toContain('DBS Altitude');
      expect(alerts[0].message).toContain('due in 3 days');
      expect(alerts[0].actionLabel).toBe('View CC Bill');
    });

    it('dispatches PWA notification when permitted', async () => {
      // Mock window Notification
      const showNotificationMock = vi.fn().mockResolvedValue(undefined);
      Object.defineProperty(window, 'Notification', {
        value: class MockNotification {
          static permission = 'granted';
          static requestPermission = vi.fn().mockResolvedValue('granted');
        },
        configurable: true,
        writable: true,
      });

      // Mock navigator.serviceWorker
      Object.defineProperty(navigator, 'serviceWorker', {
        value: {
          getRegistration: vi.fn().mockResolvedValue({
            showNotification: showNotificationMock,
          }),
        },
        configurable: true,
      });

      const dispatched = await dispatchPWANotification('Test Title', { body: 'Test body' });
      expect(dispatched).toBe(true);
      expect(showNotificationMock).toHaveBeenCalledWith('Test Title', expect.objectContaining({
        body: 'Test body',
      }));

      // Test permission request
      const perm = await requestNotificationPermission();
      expect(perm).toBe('granted');
    });

    it('renders notification bell with badge count in NotificationCenterPopover and handles quick actions', async () => {
      // Mock active reminders via computeActiveReminders
      const mockStreak: StreakSummary = {
        currentStreak: 2,
        longestStreak: 5,
        checkedInToday: false,
        coupleStreak: 1,
      };
      vi.spyOn(financeService, 'getStreakSummary').mockResolvedValue(mockStreak);
      vi.spyOn(financeService, 'getAllAccountSnapshots').mockResolvedValue([]);
      vi.spyOn(financeService, 'getCreditCardStatements').mockResolvedValue([
        {
          id: 'stmt-alert',
          household_id: 'hh-00000000-0001',
          card_id: 'card-1',
          month: '2026-10',
          statement_amount: 450,
          due_date: getTodayDateString(),
          is_paid: false,
          card: {
            id: 'card-1',
            household_id: 'hh-00000000-0001',
            owner_id: 'mem-00000000-0011',
            name: 'DBS Altitude',
            bank: 'DBS',
            billing_day: 1,
            due_day: 28,
            color: '#10B981',
            is_active: true,
          },
        },
      ]);

      const onNavigateTab = vi.fn();

      renderWithProviders(
        <NotificationCenterPopover onNavigateTab={onNavigateTab} />
      );

      // Bell button should display badge count
      const bellBtn = await screen.findByTestId('notification-bell-btn');
      expect(bellBtn).toBeInTheDocument();

      const badge = await screen.findByTestId('notification-badge-count');
      expect(Number(badge.textContent)).toBeGreaterThanOrEqual(1);

      // Open popover
      await act(async () => {
        fireEvent.click(bellBtn);
      });

      const popover = screen.getByTestId('notification-center-popover');
      expect(popover).toBeInTheDocument();
      expect(screen.getByText('Notifications & Reminders')).toBeInTheDocument();

      // Check In action button
      const checkinActionBtn = screen.getByTestId('reminder-action-check_in');
      expect(checkinActionBtn).toBeInTheDocument();
      expect(checkinActionBtn.textContent).toContain('Check In Now');

      const recordSpy = vi.spyOn(financeService, 'recordDailyCheckin').mockResolvedValueOnce({
        id: 'chk-quick-notif',
        household_id: 'hh-00000000-0001',
        member_id: 'mem-00000000-0011',
        checkin_date: getTodayDateString(),
        type: 'no_spend',
      });

      // Click "Check In Now"
      await act(async () => {
        fireEvent.click(checkinActionBtn);
      });

      expect(recordSpy).toHaveBeenCalled();

      // Check CC Action button
      const ccActionBtns = screen.getAllByTestId('reminder-action-view_cc');
      expect(ccActionBtns.length).toBeGreaterThanOrEqual(1);
      await act(async () => {
        fireEvent.click(ccActionBtns[0]);
      });
      expect(onNavigateTab).toHaveBeenCalledWith('expenses');
    });

    it('renders mobile full-screen notification overlay on mobile viewports, does NOT close when clicking inside, and allows closing via close button', async () => {
      vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(375);
      renderWithProviders(<NotificationCenterPopover />);

      const bellBtn = await screen.findByTestId('notification-bell-btn');
      await act(async () => {
        fireEvent.click(bellBtn);
      });

      const overlay = screen.getByTestId('notification-center-mobile-overlay');
      expect(overlay).toBeInTheDocument();

      // Clicking anywhere inside the overlay must NOT close it
      await act(async () => {
        fireEvent.mouseDown(overlay);
        fireEvent.click(overlay);
      });
      expect(screen.getByTestId('notification-center-mobile-overlay')).toBeInTheDocument();

      const closeBtn = screen.getByTestId('close-notification-overlay-btn');
      expect(closeBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(closeBtn);
      });

      expect(screen.queryByTestId('notification-center-mobile-overlay')).not.toBeInTheDocument();
    });

    it('persists dismissed reminder IDs per member in localStorage', () => {
      const memberId = 'mem-test-dismiss';
      expect(getDismissedReminderIds(memberId).size).toBe(0);

      dismissReminderId(memberId, 'rem-1');
      dismissReminderId(memberId, 'rem-2');

      const dismissed = getDismissedReminderIds(memberId);
      expect(dismissed.has('rem-1')).toBe(true);
      expect(dismissed.has('rem-2')).toBe(true);
      expect(dismissed.has('rem-3')).toBe(false);
    });

    it('prompts initial notification permission on first launch', async () => {
      const requestMock = vi.fn().mockResolvedValue('granted');
      Object.defineProperty(window, 'Notification', {
        value: {
          permission: 'default',
          requestPermission: requestMock,
        },
        configurable: true,
        writable: true,
      });

      const perm = await checkAndPromptInitialNotificationPermission();
      expect(perm).toBe('granted');
      expect(requestMock).toHaveBeenCalledTimes(1);

      // Second run does not prompt again
      requestMock.mockClear();
      const secondPerm = await checkAndPromptInitialNotificationPermission();
      expect(secondPerm).toBe('default');
      expect(requestMock).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 3. Expanded Notification Domain Checkers
  // =========================================================================
  describe('Expanded Notification Domain Checkers', () => {
    it('checkMissingCreditCardStatements detects cards past billing day with no statement', () => {
      const cards: CreditCard[] = [
        {
          id: 'card-1',
          household_id: 'hh-1',
          owner_id: 'mem-1',
          name: 'DBS Altitude',
          bank: 'DBS',
          billing_day: 10,
          due_day: 28,
          color: '#10B981',
          is_active: true,
        },
        {
          id: 'card-2',
          household_id: 'hh-1',
          owner_id: 'mem-1',
          name: 'OCBC 365',
          bank: 'OCBC',
          billing_day: 25,
          due_day: 15,
          color: '#EC4899',
          is_active: true,
        },
      ];

      const statements: CreditCardStatement[] = [
        {
          id: 'stmt-1',
          card_id: 'card-1',
          household_id: 'hh-1',
          month: '2026-10',
          statement_amount: 500,
          due_date: '2026-10-28',
          is_paid: false,
        },
      ];

      // On Oct 15: card-1 billing day (10) passed but has statement.
      // card-2 billing day (25) not yet passed.
      const r1 = checkMissingCreditCardStatements(cards, statements, new Date('2026-10-15T12:00:00'));
      expect(r1).toHaveLength(0);

      // On Oct 26: card-2 billing day (25) passed and has NO statement!
      const r2 = checkMissingCreditCardStatements(cards, statements, new Date('2026-10-26T12:00:00'));
      expect(r2).toHaveLength(1);
      expect(r2[0].type).toBe('credit_card_missing_stmt');
      expect(r2[0].message).toContain('OCBC 365');
    });

    it('checkPartnerSharedSpendReminders alerts for recent unsettled expenses paid by partner', () => {
      const members: HouseholdMember[] = [
        { id: 'mem-1', household_id: 'hh-1', display_name: 'Yi Jia', role: 'owner' },
        { id: 'mem-2', household_id: 'hh-1', display_name: 'Rachel', role: 'member' },
      ];

      const expenses: Expense[] = [
        {
          id: 'exp-1',
          household_id: 'hh-1',
          payer_id: 'mem-2', // Rachel paid
          date: '2026-10-27',
          item: 'Din Tai Fung',
          amount: 80,
          is_shared: true,
          split_ratio: 0.5,
          settled: false,
        },
        {
          id: 'exp-2',
          household_id: 'hh-1',
          payer_id: 'mem-1', // Yi Jia paid -> don't alert Yi Jia
          date: '2026-10-27',
          item: 'Groceries',
          amount: 50,
          is_shared: true,
          split_ratio: 0.5,
          settled: false,
        },
      ];

      const reminders = checkPartnerSharedSpendReminders(expenses, members, 'mem-1', '2026-10-28');
      expect(reminders).toHaveLength(1);
      expect(reminders[0].type).toBe('partner_shared_spend');
      expect(reminders[0].title).toContain('Rachel Logged Shared Spend');
      expect(reminders[0].message).toContain('Din Tai Fung');
      expect(reminders[0].message).toContain('SGD 40.00');
    });

    it('checkSettlementReminder triggers when net balance exceeds threshold or month-end', () => {
      const summary: SettlementSummary = {
        netBalance: 250,
        debtorId: 'mem-2',
        creditorId: 'mem-1',
        settlementText: 'Rachel owes Yi Jia S$250.00',
        member1OwesMember2: 0,
        member2OwesMember1: 250,
      };

      // Exceeds 200 threshold
      const rExceed = checkSettlementReminder(summary, 200, new Date('2026-10-15T12:00:00'));
      expect(rExceed).not.toBeNull();
      expect(rExceed?.type).toBe('settlement_due');
      expect(rExceed?.message).toContain('SGD 250.00');

      // Below threshold and mid-month -> null
      const summarySmall: SettlementSummary = {
        ...summary,
        netBalance: 50,
      };
      const rSmallMid = checkSettlementReminder(summarySmall, 200, new Date('2026-10-15T12:00:00'));
      expect(rSmallMid).toBeNull();

      // Below threshold but month-end (>= 27th) -> triggers reminder
      const rSmallEnd = checkSettlementReminder(summarySmall, 200, new Date('2026-10-28T12:00:00'));
      expect(rSmallEnd).not.toBeNull();
      expect(rSmallEnd?.type).toBe('settlement_due');
    });

    it('checkCoupleStreakRiskReminder alerts in evening when active member checked in but partner has not', () => {
      const members: HouseholdMember[] = [
        { id: 'mem-1', household_id: 'hh-1', display_name: 'Yi Jia', role: 'owner' },
        { id: 'mem-2', household_id: 'hh-1', display_name: 'Rachel', role: 'member' },
      ];

      const checkins: DailyCheckin[] = [
        {
          id: 'chk-1',
          household_id: 'hh-1',
          member_id: 'mem-1',
          checkin_date: '2026-10-28',
          type: 'no_spend',
        },
      ];

      // Afternoon (14:00) -> no reminder yet
      const rAfternoon = checkCoupleStreakRiskReminder(checkins, members, 'mem-1', 14, '2026-10-28');
      expect(rAfternoon).toBeNull();

      // Evening (19:00) -> triggers couple streak risk
      const rEvening = checkCoupleStreakRiskReminder(checkins, members, 'mem-1', 19, '2026-10-28');
      expect(rEvening).not.toBeNull();
      expect(rEvening?.type).toBe('couple_streak_risk');
      expect(rEvening?.title).toContain('Couple Streak At Risk!');
      expect(rEvening?.message).toContain('Rachel');
    });

    it('checkBudgetLimitReminders alerts for spendable categories nearing or exceeding cap', () => {
      const monthlyBudget: MonthlyBudgetDetail = {
        budget: {
          id: 'b-1',
          household_id: 'hh-1',
          owner_id: 'mem-1',
          month: '2026-10',
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
            id: 'c-1',
            monthly_budget_id: 'b-1',
            category_id: 'cat-groceries',
            percentage: 0.2,
            allocated_amount: 500,
            actualSpent: 420, // 84% -> nearing warning
            remaining: 80,
            category: {
              id: 'cat-groceries',
              household_id: 'hh-1',
              name: 'Groceries',
              color: '#10B981',
              icon: 'shopping-cart',
              is_system: false,
              group: 'spendable',
            },
          },
          {
            id: 'c-2',
            monthly_budget_id: 'b-1',
            category_id: 'cat-dining',
            percentage: 0.2,
            allocated_amount: 400,
            actualSpent: 450, // 112.5% -> exceeded alert
            remaining: -50,
            category: {
              id: 'cat-dining',
              household_id: 'hh-1',
              name: 'Dining Out',
              color: '#F59E0B',
              icon: 'utensils',
              is_system: false,
              group: 'spendable',
            },
          },
        ],
      };

      const alerts = checkBudgetLimitReminders(monthlyBudget, 80);
      expect(alerts).toHaveLength(2);
      expect(alerts.find((a) => a.title.includes('Exceeded'))).toBeDefined();
      expect(alerts.find((a) => a.title.includes('Nearing'))).toBeDefined();
    });

    it('checkRecurringBillsReminders alerts for annual policies due in current month', () => {
      const policies: RecurringPolicy[] = [
        {
          id: 'pol-1',
          household_id: 'hh-1',
          owner_id: 'mem-1',
          type: 'insurance',
          name: 'Manulife LifeReady Plus',
          amount: 2400,
          frequency: 'annually',
          payment_month: 10, // October
          monthly_amortized_amount: 200,
        },
        {
          id: 'pol-2',
          household_id: 'hh-1',
          owner_id: 'mem-1',
          type: 'insurance',
          name: 'IncomeShield Plan',
          amount: 600,
          frequency: 'annually',
          payment_month: 3, // March
          monthly_amortized_amount: 50,
        },
      ];

      const rOct = checkRecurringBillsReminders(policies, new Date('2026-10-15T12:00:00'));
      expect(rOct).toHaveLength(1);
      expect(rOct[0].type).toBe('recurring_bill_due');
      expect(rOct[0].message).toContain('Manulife');
    });

    it('checkGoalPacingReminders alerts when savings goals are behind target or achieved', () => {
      const goals: SavingsGoal[] = [
        {
          id: 'goal-1',
          household_id: 'hh-1',
          title: 'Japan Holiday',
          target_amount: 6000,
          saved_so_far: 2000,
          target_date: '2026-12-31',
          monthly_contribution: 500,
          emoji: '✈️',
          status: 'behind',
        },
        {
          id: 'goal-2',
          household_id: 'hh-1',
          title: 'Emergency Fund',
          target_amount: 10000,
          saved_so_far: 10000,
          target_date: '2027-01-01',
          monthly_contribution: 1000,
          emoji: '🛡️',
          status: 'achieved',
        },
      ];

      const r = checkGoalPacingReminders(goals);
      expect(r).toHaveLength(2);
      expect(r.some((g) => g.title.includes('Behind'))).toBe(true);
      expect(r.some((g) => g.title.includes('Achieved'))).toBe(true);
    });

    it('checkMonthlyBudgetReviewReminder triggers on days 1-5 when budget is unlocked', () => {
      const monthlyBudget: MonthlyBudgetDetail = {
        budget: {
          id: 'b-1',
          household_id: 'hh-1',
          owner_id: 'mem-1',
          month: '2026-11',
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
      const rDay3 = checkMonthlyBudgetReviewReminder(monthlyBudget, new Date('2026-11-03T12:00:00'));
      expect(rDay3).not.toBeNull();
      expect(rDay3?.type).toBe('monthly_budget_review');

      // Day 10 -> no reminder
      const rDay10 = checkMonthlyBudgetReviewReminder(monthlyBudget, new Date('2026-11-10T12:00:00'));
      expect(rDay10).toBeNull();
    });
  });

  // =========================================================================
  // 4. Notification Settings Modal
  // =========================================================================
  describe('NotificationSettingsModal Component', () => {
    it('renders master channels, category toggles, custom thresholds, and updates preferences', async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <NotificationSettingsModal isOpen={true} onClose={onClose} memberId="mem-00000000-0011" />
      );

      expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument();
      expect(screen.getByText('Push Notifications')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Sound Effects' })).toBeInTheDocument();

      // Custom thresholds inputs exist
      const ccLeadInput = screen.getByTestId('input-cc-lead-days');
      expect(ccLeadInput).toBeInTheDocument();
      expect(ccLeadInput).toHaveValue(5);

      const budgetWarningInput = screen.getByTestId('input-budget-warning-pct');
      expect(budgetWarningInput).toBeInTheDocument();
      expect(budgetWarningInput).toHaveValue(80);

      const updateSpy = vi.spyOn(financeService, 'updateNotificationPreferences');

      // Change CC lead days
      await act(async () => {
        fireEvent.change(ccLeadInput, { target: { value: '7' } });
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'mem-00000000-0011',
        expect.objectContaining({ cc_due_days_before: 7 })
      );

      // Reset to defaults
      const resetBtn = screen.getByTestId('reset-notification-defaults-btn');
      await act(async () => {
        fireEvent.click(resetBtn);
      });

      expect(updateSpy).toHaveBeenCalledWith(
        'mem-00000000-0011',
        expect.objectContaining({ cc_due_days_before: 5, budget_warning_pct: 80 })
      );

      // Click Done
      const doneBtn = screen.getByRole('button', { name: /done/i });
      await act(async () => {
        fireEvent.click(doneBtn);
      });
      expect(onClose).toHaveBeenCalled();
    });

    it('hides notification types and custom thresholds when push_enabled is toggled off', async () => {
      const onClose = vi.fn();
      renderWithProviders(
        <NotificationSettingsModal isOpen={true} onClose={onClose} memberId="mem-00000000-0011" />
      );

      expect(await screen.findByText('Notification Types')).toBeInTheDocument();
      expect(screen.getByText('Custom Thresholds')).toBeInTheDocument();

      const pushToggle = screen.getByTestId('toggle-push-enabled');
      await act(async () => {
        fireEvent.click(pushToggle);
      });

      expect(screen.queryByText('Notification Types')).not.toBeInTheDocument();
      expect(screen.queryByText('Custom Thresholds')).not.toBeInTheDocument();
      expect(screen.getByText(/Push notifications are turned off/i)).toBeInTheDocument();

      // Sound Effects section remains accessible in its own category
      expect(screen.getByRole('heading', { name: 'Sound Effects' })).toBeInTheDocument();
    });

    it('isSoundEffectsEnabled respects sound_enabled preference in localStorage', () => {
      localStorage.setItem(
        'bb_notif_prefs_mem-00000000-0011',
        JSON.stringify({ sound_enabled: false })
      );
      expect(isSoundEffectsEnabled()).toBe(false);

      localStorage.setItem(
        'bb_notif_prefs_mem-00000000-0011',
        JSON.stringify({ sound_enabled: true })
      );
      expect(isSoundEffectsEnabled()).toBe(true);
    });
  });
});


