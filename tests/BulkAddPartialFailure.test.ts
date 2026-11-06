import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  offlineSyncQueue,
  clearPendingMutations,
  getPendingMutations,
  flushOutbox,
  setNetworkOverride,
} from '../src/services/offlineSyncQueue';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { supabaseFinanceService } from '../src/services/supabaseFinanceService';
import { PartialBulkAddError } from '../src/services/bulkAddError';
import type { CreateExpenseInput, Expense } from '../src/types/finance';

const item = (n: number): CreateExpenseInput => ({
  household_id: 'hh-1',
  payer_id: 'mem-1',
  date: '2026-11-04',
  item: `Item ${n}`,
  amount: n,
  is_shared: false,
});

const saved = (n: number): Expense =>
  ({ id: `srv-${n}`, item: `Item ${n}`, amount: n }) as Expense;

describe('bulkAddExpenses partial failure', () => {
  beforeEach(() => {
    localStorage.clear();
    clearPendingMutations();
    setNetworkOverride(null);
    vi.restoreAllMocks();
  });

  it('queues only the unsaved rows when the backend fails part-way', async () => {
    const spy = vi
      .spyOn(mockFinanceService, 'bulkAddExpenses')
      .mockRejectedValueOnce(
        new PartialBulkAddError([saved(1)], new Error('network lost')),
      );

    const result = await offlineSyncQueue.bulkAddExpenses([item(1), item(2), item(3)]);

    // The saved row plus optimistic copies of the other two
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('srv-1');
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls[1][0].map((e) => e.item)).toEqual(['Item 2', 'Item 3']);

    const [mutation] = getPendingMutations();
    expect(mutation.type).toBe('bulkAddExpenses');
    expect(mutation.payload.expenses.map((e: CreateExpenseInput) => e.item)).toEqual([
      'Item 2',
      'Item 3',
    ]);
  });

  it('still queues the whole batch when nothing was saved', async () => {
    vi.spyOn(mockFinanceService, 'bulkAddExpenses').mockRejectedValueOnce(
      new Error('offline'),
    );

    const result = await offlineSyncQueue.bulkAddExpenses([item(1), item(2)]);

    expect(result).toHaveLength(2);
    expect(getPendingMutations()[0].payload.expenses).toHaveLength(2);
  });

  it('trims a queued batch on replay so retries do not duplicate saved rows', async () => {
    setNetworkOverride(false);
    await offlineSyncQueue.bulkAddExpenses([item(1), item(2), item(3)]);
    setNetworkOverride(true);

    const failing = {
      bulkAddExpenses: vi
        .fn()
        .mockRejectedValue(new PartialBulkAddError([saved(1)], new Error('flaky'))),
    };
    const first = await flushOutbox(failing);
    expect(first.errors).toBe(1);
    expect(getPendingMutations()[0].payload.expenses.map((e: CreateExpenseInput) => e.item)).toEqual([
      'Item 2',
      'Item 3',
    ]);

    const working = { bulkAddExpenses: vi.fn().mockResolvedValue([]) };
    const second = await flushOutbox(working);
    expect(second.processed).toBe(1);
    expect(working.bulkAddExpenses.mock.calls[0][0].map((e: CreateExpenseInput) => e.item)).toEqual([
      'Item 2',
      'Item 3',
    ]);
  });

  it('supabase bulkAddExpenses reports rows saved before a failure', async () => {
    vi.spyOn(supabaseFinanceService, 'addExpense')
      .mockResolvedValueOnce(saved(1))
      .mockResolvedValueOnce(saved(2))
      .mockRejectedValueOnce(new Error('insert failed'));

    const err = await supabaseFinanceService
      .bulkAddExpenses([item(1), item(2), item(3)])
      .catch((e) => e);

    expect(err).toBeInstanceOf(PartialBulkAddError);
    expect(err.created.map((e: Expense) => e.id)).toEqual(['srv-1', 'srv-2']);
  });

  it('supabase bulkAddExpenses rethrows the original error when nothing was saved', async () => {
    const boom = new Error('first row failed');
    vi.spyOn(supabaseFinanceService, 'addExpense').mockRejectedValueOnce(boom);

    await expect(supabaseFinanceService.bulkAddExpenses([item(1), item(2)])).rejects.toBe(boom);
  });
});
