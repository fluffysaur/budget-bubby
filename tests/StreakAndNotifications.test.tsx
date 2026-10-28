/**
 * Daily Check-in Streak & Notifications Engine
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { DailyCheckinStreakBar } from '../src/components/dashboard/DailyCheckinStreakBar';
import { NotificationCenterPopover } from '../src/components/layout/NotificationCenterPopover';
import { HouseholdProvider } from '../src/context/HouseholdContext';
import { AuthProvider } from '../src/context/AuthContext';
import { financeService } from '../src/services/financeService';
import {
  checkDailyCheckinReminder,
  checkBalanceUpdateReminder,
  checkCreditCardDueReminders,
  requestNotificationPermission,
  dispatchPWANotification,
} from '../src/lib/notificationScheduler';
import { getTodayDateString, getCurrentMonth } from '../src/lib/dateUtils';
import type { StreakSummary, AccountSnapshot, CreditCardStatement } from '../src/types/finance';

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
      const ccActionBtn = screen.queryByTestId('reminder-action-view_cc');
      if (ccActionBtn) {
        await act(async () => {
          fireEvent.click(ccActionBtn);
        });
        expect(onNavigateTab).toHaveBeenCalledWith('expenses');
      }
    });
  });
});

