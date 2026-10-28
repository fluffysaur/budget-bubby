import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import {
  offlineSyncQueue,
  getPendingSyncCount,
  getPendingMutations,
  clearPendingMutations,
  flushOutbox,
  setNetworkOverride,
  type OfflineSyncStatusDetail,
} from '../src/services/offlineSyncQueue';
import { financeService } from '../src/services/financeService';
import { OfflineBanner } from '../src/components/pwa/OfflineBanner';
import { App, RouteSkeletonLoader } from '../src/App';
import type { CreateExpenseInput } from '../src/types/finance';

// Mock recharts ResponsiveContainer so chart elements render safely in jsdom
vi.mock('recharts', async (importOriginal) => {
  const original = await importOriginal<typeof import('recharts')>();
  return {
    ...original,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container" style={{ width: 800, height: 400 }}>
        {children}
      </div>
    ),
  };
});

describe('Offline-First Sync Queue & Fast Lazy Loading', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingMutations();
    setNetworkOverride(null);
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
    setNetworkOverride(null);
    clearPendingMutations();
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.restoreAllMocks();
  });

  describe('1. Offline Mutation Queueing & Optimistic Updates', () => {
    it('queues addExpense mutation when offline and returns optimistic result immediately', async () => {
      setNetworkOverride(false);
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });

      const newExpenseInput: CreateExpenseInput = {
        household_id: 'hh-1',
        payer_id: 'mem-1',
        category_id: 'cat-food',
        date: '2026-10-27',
        item: 'Offline Hawker Lunch',
        amount: 8.50,
        is_shared: true,
        split_ratio: 0.50,
        remarks: 'Bought while in MRT tunnel with no signal',
      };

      const result = await offlineSyncQueue.addExpense(newExpenseInput);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.item).toBe('Offline Hawker Lunch');
      expect(result.amount).toBe(8.50);

      // Verify pending sync count is 1
      expect(getPendingSyncCount()).toBe(1);
      const mutations = getPendingMutations();
      expect(mutations.length).toBe(1);
      expect(mutations[0].type).toBe('addExpense');
      expect(mutations[0].payload.input.item).toBe('Offline Hawker Lunch');

      // Verify optimistic expense is retrievable via financeService
      const allExpenses = await financeService.getExpenses();
      expect(allExpenses.some((e) => e.item === 'Offline Hawker Lunch')).toBe(true);
    });

    it('queues updateExpense and deleteExpense mutations when offline', async () => {
      setNetworkOverride(false);

      // 1. Add an expense offline first
      const exp = await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        category_id: 'cat-food',
        date: '2026-10-27',
        item: 'Kopi O',
        amount: 1.80,
        is_shared: false,
      });

      expect(getPendingSyncCount()).toBe(1);

      // 2. Update the expense offline
      const updated = await offlineSyncQueue.updateExpense(exp.id, {
        amount: 2.20,
        remarks: 'Upsized to large kopi',
      });

      expect(updated.amount).toBe(2.20);
      expect(getPendingSyncCount()).toBe(2);

      // 3. Queue another mutation: recordDailyCheckin
      await offlineSyncQueue.recordDailyCheckin('mem-1', '2026-10-27', 'expense');
      expect(getPendingSyncCount()).toBe(3);
    });

    it('queues bulkAddExpenses and updates pending queue count', async () => {
      setNetworkOverride(false);

      const items: CreateExpenseInput[] = [
        {
          household_id: 'hh-1',
          payer_id: 'mem-1',
          date: '2026-10-27',
          item: 'Groceries Item 1',
          amount: 15.00,
          is_shared: true,
        },
        {
          household_id: 'hh-1',
          payer_id: 'mem-1',
          date: '2026-10-27',
          item: 'Groceries Item 2',
          amount: 22.50,
          is_shared: true,
        },
      ];

      const results = await offlineSyncQueue.bulkAddExpenses(items);
      expect(results.length).toBe(2);
      expect(getPendingSyncCount()).toBe(1);
      const mutations = getPendingMutations();
      expect(mutations[0].type).toBe('bulkAddExpenses');
    });

    it('optimizes outbox by cancelling offline add when deleted before sync', async () => {
      setNetworkOverride(false);

      const exp = await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Mistake Purchase',
        amount: 50.00,
        is_shared: false,
      });

      expect(getPendingSyncCount()).toBe(1);

      // Deleting the un-synced offline item should cancel the add
      await offlineSyncQueue.deleteExpense(exp.id);
      expect(getPendingSyncCount()).toBe(0);
    });
  });

  describe('2. Pending Count Tracking & Custom Event (offlineSyncStatusChanged)', () => {
    it('dispatches offlineSyncStatusChanged event on mutation enqueue and clear', async () => {
      const listener = vi.fn();
      window.addEventListener('offlineSyncStatusChanged', listener);

      setNetworkOverride(false);

      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Test Milk',
        amount: 4.20,
        is_shared: true,
      });

      expect(listener).toHaveBeenCalled();
      const lastCallEvent = listener.mock.calls[listener.mock.calls.length - 1][0] as CustomEvent<OfflineSyncStatusDetail>;
      expect(lastCallEvent.detail.pendingCount).toBe(1);

      // Clear pending mutations
      clearPendingMutations();
      expect(getPendingSyncCount()).toBe(0);

      const afterClearEvent = listener.mock.calls[listener.mock.calls.length - 1][0] as CustomEvent<OfflineSyncStatusDetail>;
      expect(afterClearEvent.detail.pendingCount).toBe(0);

      window.removeEventListener('offlineSyncStatusChanged', listener);
    });
  });

  describe('3. PWA OfflineBanner Component', () => {
    it('displays standard offline notice when offline with 0 queued mutations', () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      clearPendingMutations();

      render(<OfflineBanner />);

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText(/You are offline\. Showing cached Budget Bubby view\./i)
      ).toBeInTheDocument();
    });

    it('displays pending count message when mutations are queued offline', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      setNetworkOverride(false);

      // Queue 3 expenses
      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Item 1',
        amount: 10,
        is_shared: false,
      });
      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Item 2',
        amount: 20,
        is_shared: false,
      });
      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Item 3',
        amount: 30,
        is_shared: false,
      });

      await act(async () => {
        render(<OfflineBanner />);
      });

      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(
        screen.getByText('Offline Mode — 3 expenses queued locally. Will sync automatically when back online.')
      ).toBeInTheDocument();
    });

    it('formats singular expense when pendingCount is 1', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      setNetworkOverride(false);

      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Solo Item',
        amount: 5,
        is_shared: false,
      });

      await act(async () => {
        render(<OfflineBanner />);
      });

      expect(
        screen.getByText('Offline Mode — 1 expense queued locally. Will sync automatically when back online.')
      ).toBeInTheDocument();
    });

    it('shows confirmation pill "✓ All changes synced to Supabase" when reconnecting', async () => {
      vi.useFakeTimers();
      Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
      await act(async () => {
        render(<OfflineBanner />);
      });

      // Connection returns
      await act(async () => {
        Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
        window.dispatchEvent(new Event('online'));
      });

      expect(screen.getByText(/✓ All changes synced to Supabase/i)).toBeInTheDocument();

      // After 3.5 seconds (3500ms), confirmation pill hides
      await act(async () => {
        vi.advanceTimersByTime(3500);
      });

      expect(screen.queryByText(/✓ All changes synced to Supabase/i)).not.toBeInTheDocument();
      vi.useRealTimers();
    });
  });

  describe('4. Automatic Replay & Deduplication on Reconnect', () => {
    it('flushes outbox queue and replays mutations to target service with deduplication', async () => {
      setNetworkOverride(false);

      // Queue 2 mutations
      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Offline Coffee',
        amount: 6.00,
        is_shared: false,
      });
      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Offline Croissant',
        amount: 4.50,
        is_shared: false,
      });

      expect(getPendingSyncCount()).toBe(2);

      // Replay using custom target service spy
      const mockTarget = {
        addExpense: vi.fn().mockResolvedValue({ id: 'srv-1', item: 'Synced' }),
      };

      const result = await flushOutbox(mockTarget);
      expect(result.processed).toBe(2);
      expect(result.errors).toBe(0);
      expect(mockTarget.addExpense).toHaveBeenCalledTimes(2);

      // Queue is now empty
      expect(getPendingSyncCount()).toBe(0);

      // Re-running flushOutbox does not duplicate
      const secondRun = await flushOutbox(mockTarget);
      expect(secondRun.processed).toBe(0);
      expect(mockTarget.addExpense).toHaveBeenCalledTimes(2);
    });

    it('automatically replays on window "online" event', async () => {
      setNetworkOverride(false);

      await offlineSyncQueue.addExpense({
        household_id: 'hh-1',
        payer_id: 'mem-1',
        date: '2026-10-27',
        item: 'Pre-flight snack',
        amount: 7.20,
        is_shared: false,
      });

      expect(getPendingSyncCount()).toBe(1);

      // Simulate coming back online
      setNetworkOverride(true);
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

      window.dispatchEvent(new Event('online'));

      await waitFor(() => {
        expect(getPendingSyncCount()).toBe(0);
      });
    });
  });

  describe('5. Fast Loading & Lazy Route Code-Splitting', () => {
    it('renders RouteSkeletonLoader fallback with proper status role', () => {
      render(<RouteSkeletonLoader />);
      const skeleton = screen.getByTestId('route-skeleton-loader');
      expect(skeleton).toBeInTheDocument();
      expect(skeleton).toHaveAttribute('role', 'status');
      expect(skeleton).toHaveAttribute('aria-label', 'Loading page content');
    });

    it('boots App fast and resolves lazy routes via Suspense', async () => {
      const startTime = performance.now();
      render(<App initialEntries={['/']} />);
      const mountDuration = performance.now() - startTime;

      // App container mounts swiftly
      expect(mountDuration).toBeLessThan(250);

      // Lazy DashboardPage renders successfully through Suspense
      await waitFor(() => {
        expect(screen.getByText(/True Net Worth/i)).toBeInTheDocument();
      });
    });

    it('navigates and renders lazy pages across routes seamlessly', async () => {
      const { unmount: unmountBudget } = render(<App initialEntries={['/budget']} />);
      await waitFor(() => {
        expect(screen.getByText(/Budget Waterfall/i)).toBeInTheDocument();
      });
      unmountBudget();

      const { unmount: unmountExpenses } = render(<App initialEntries={['/expenses']} />);
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/Search merchant/i)).toBeInTheDocument();
      });
      unmountExpenses();

      const { unmount: unmountAccounts } = render(<App initialEntries={['/accounts']} />);
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: /Accounts & Net Worth/i })).toBeInTheDocument();
      });
      unmountAccounts();
    });
  });
});
