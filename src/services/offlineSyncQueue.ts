/**
 * Offline-First Mutation Queue and Cache Manager for Budget Bubby.
 * 
 * Features:
 * - Persistent outbox queue in localStorage with in-memory fallback.
 * - Captures offline mutations (addExpense, updateExpense, deleteExpense, bulkAddExpenses, recordDailyCheckin).
 * - Applies optimistic local updates immediately to mock storage so the UI updates with zero latency.
 * - Tracks pending synchronization count and broadcasts `offlineSyncStatusChanged` custom event.
 * - Automatically replays/flushes pending mutations when network connectivity returns.
 * - Full deduplication protection against duplicate replay or conflicting mutations.
 */

import type {
  Expense,
  CreateExpenseInput,
  UpdateExpenseInput,
  DailyCheckin,
  CheckinType,
} from '../types/finance';
import { isSupabaseConfigured } from './supabaseClient';
import { mockFinanceService } from './mockFinanceService';
import { supabaseFinanceService } from './supabaseFinanceService';

export type MutationType =
  | 'addExpense'
  | 'updateExpense'
  | 'deleteExpense'
  | 'bulkAddExpenses'
  | 'recordDailyCheckin';

export interface QueuedMutation<T = any> {
  id: string;
  type: MutationType;
  payload: T;
  timestamp: number;
  retryCount: number;
  lastError?: string;
}

export interface OfflineSyncStatusDetail {
  pendingCount: number;
  isSyncing: boolean;
  lastSyncedCount?: number;
}

const OFFLINE_OUTBOX_STORAGE_KEY = 'budget_bubby_offline_outbox_v1';
const SYNCED_MUTATION_IDS_KEY = 'budget_bubby_synced_mutation_ids_v1';

// In-memory fallback for environments without localStorage or when storage throws
let memoryQueue: QueuedMutation[] = [];
let memorySyncedIds: Set<string> = new Set();
let isFlushing = false;
let isReplayingFlag = false;
let networkOverride: boolean | null = null;

export function isDemoModeActive(): boolean {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return (
      window.sessionStorage.getItem('budget_bubby_demo_pin') === 'true' ||
      window.sessionStorage.getItem('budget_buddy_demo_pin') === 'true'
    );
  }
  return false;
}

export function isOnline(): boolean {
  if (networkOverride !== null) {
    return networkOverride;
  }
  if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
    return navigator.onLine;
  }
  return true;
}

export function setNetworkOverride(online: boolean | null): void {
  networkOverride = online;
}

export function isReplaying(): boolean {
  return isReplayingFlag;
}

function loadOutbox(): QueuedMutation[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(OFFLINE_OUTBOX_STORAGE_KEY);
      if (data) {
        return JSON.parse(data);
      }
    } catch {
      // Fallback to memory
    }
  }
  return memoryQueue;
}

function saveOutbox(queue: QueuedMutation[]): void {
  memoryQueue = [...queue];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(OFFLINE_OUTBOX_STORAGE_KEY, JSON.stringify(queue));
    } catch {
      // Ignore storage errors
    }
  }
}

function loadSyncedIds(): Set<string> {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const data = window.localStorage.getItem(SYNCED_MUTATION_IDS_KEY);
      if (data) {
        return new Set(JSON.parse(data));
      }
    } catch {
      // Fallback
    }
  }
  return memorySyncedIds;
}

function saveSyncedIds(ids: Set<string>): void {
  memorySyncedIds = new Set(ids);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      // Keep only the most recent 500 ids to prevent unbounded growth
      const array = Array.from(ids).slice(-500);
      window.localStorage.setItem(SYNCED_MUTATION_IDS_KEY, JSON.stringify(array));
    } catch {
      // Ignore
    }
  }
}

export function getPendingSyncCount(): number {
  return loadOutbox().length;
}

export function getPendingMutations(): QueuedMutation[] {
  return loadOutbox();
}

export function clearPendingMutations(): void {
  memoryQueue = [];
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(OFFLINE_OUTBOX_STORAGE_KEY);
    } catch {}
  }
  notifySyncStatusChanged(false, 0);
}

export function notifySyncStatusChanged(isSyncing = false, lastSyncedCount?: number): void {
  const pendingCount = getPendingSyncCount();
  if (typeof window !== 'undefined') {
    const event = new CustomEvent<OfflineSyncStatusDetail>('offlineSyncStatusChanged', {
      detail: { pendingCount, isSyncing, lastSyncedCount },
    });
    window.dispatchEvent(event);
  }
}

export function enqueueMutation<T = any>(type: MutationType, payload: T): QueuedMutation<T> {
  const queue = loadOutbox();

  // Deduplication / optimization: If deleteExpense arrives for an addExpense that was queued offline
  if (type === 'deleteExpense') {
    const targetId = (payload as any)?.id;
    const addIdx = queue.findIndex(
      (m) =>
        m.type === 'addExpense' &&
        (m.payload?.optimisticId === targetId || m.payload?.id === targetId)
    );
    if (addIdx >= 0) {
      // The expense was created offline and deleted before syncing; simply drop both
      queue.splice(addIdx, 1);
      saveOutbox(queue);
      notifySyncStatusChanged(false);
      return {
        id: `cancelled-${Date.now()}`,
        type,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
      };
    }
  }

  const mutation: QueuedMutation<T> = {
    id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  };

  queue.push(mutation);
  saveOutbox(queue);
  notifySyncStatusChanged(false);
  return mutation;
}

function getBackendService() {
  if (isDemoModeActive()) {
    return mockFinanceService;
  }
  return isSupabaseConfigured() ? supabaseFinanceService : mockFinanceService;
}

// ---------------------------------------------------------------------------
// Mutation Handlers (Offline-First with Optimistic Local Updates)
// ---------------------------------------------------------------------------

export async function addExpense(input: CreateExpenseInput): Promise<Expense> {
  if (isOnline()) {
    try {
      const backend = getBackendService();
      return await backend.addExpense(input);
    } catch (err) {
      console.warn('Network error on addExpense, queueing offline:', err);
    }
  }

  // Offline / Network failure:
  // Optimistically update local dataset
  const optimistic = await mockFinanceService.addExpense(input);
  enqueueMutation('addExpense', { input, optimisticId: optimistic.id });
  return optimistic;
}

export async function updateExpense(id: string, updates: UpdateExpenseInput): Promise<Expense> {
  if (isOnline()) {
    try {
      const backend = getBackendService();
      return await backend.updateExpense(id, updates);
    } catch (err) {
      console.warn('Network error on updateExpense, queueing offline:', err);
    }
  }

  const optimistic = await mockFinanceService.updateExpense(id, updates);
  enqueueMutation('updateExpense', { id, updates });
  return optimistic;
}

export async function deleteExpense(id: string): Promise<void> {
  if (isOnline()) {
    try {
      const backend = getBackendService();
      return await backend.deleteExpense(id);
    } catch (err) {
      console.warn('Network error on deleteExpense, queueing offline:', err);
    }
  }

  await mockFinanceService.deleteExpense(id);
  enqueueMutation('deleteExpense', { id });
}

export async function bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]> {
  if (isOnline()) {
    try {
      const backend = getBackendService();
      return await backend.bulkAddExpenses(expenses);
    } catch (err) {
      console.warn('Network error on bulkAddExpenses, queueing offline:', err);
    }
  }

  const optimistics = await mockFinanceService.bulkAddExpenses(expenses);
  enqueueMutation('bulkAddExpenses', {
    expenses,
    optimisticIds: optimistics.map((o) => o.id),
  });
  return optimistics;
}

export async function recordDailyCheckin(
  memberId: string,
  date: string,
  type: CheckinType
): Promise<DailyCheckin> {
  if (isOnline()) {
    try {
      const backend = getBackendService();
      return await backend.recordDailyCheckin(memberId, date, type);
    } catch (err) {
      console.warn('Network error on recordDailyCheckin, queueing offline:', err);
    }
  }

  const optimistic = await mockFinanceService.recordDailyCheckin(memberId, date, type);
  enqueueMutation('recordDailyCheckin', { memberId, date, type });
  return optimistic;
}

// ---------------------------------------------------------------------------
// Replay & Flush Engine
// ---------------------------------------------------------------------------

export async function flushOutbox(
  customTargetService?: any
): Promise<{ processed: number; errors: number }> {
  if (isFlushing) {
    return { processed: 0, errors: 0 };
  }

  const queue = loadOutbox();
  if (queue.length === 0) {
    notifySyncStatusChanged(false, 0);
    return { processed: 0, errors: 0 };
  }

  isFlushing = true;
  isReplayingFlag = true;
  notifySyncStatusChanged(true);

  let processed = 0;
  let errors = 0;
  const remainingQueue: QueuedMutation[] = [];
  const syncedIds = loadSyncedIds();

  const target = customTargetService || getBackendService();

  for (const mutation of queue) {
    // Deduplication check
    if (syncedIds.has(mutation.id)) {
      continue;
    }

    try {
      // If target is mockFinanceService and it was already applied optimistically,
      // deduplicate so we don't duplicate expenses in mock dataset
      const isMockBackend = target === mockFinanceService;

      switch (mutation.type) {
        case 'addExpense': {
          const input = mutation.payload?.input || mutation.payload;
          if (customTargetService || !isMockBackend) {
            await target.addExpense(input);
          }
          break;
        }
        case 'updateExpense': {
          const { id, updates } = mutation.payload;
          if (customTargetService || !isMockBackend) {
            await target.updateExpense(id, updates);
          }
          break;
        }
        case 'deleteExpense': {
          const { id } = mutation.payload;
          if (customTargetService || !isMockBackend) {
            await target.deleteExpense(id);
          }
          break;
        }
        case 'bulkAddExpenses': {
          const items = mutation.payload?.expenses || mutation.payload;
          if (customTargetService || !isMockBackend) {
            await target.bulkAddExpenses(items);
          }
          break;
        }
        case 'recordDailyCheckin': {
          const { memberId, date, type } = mutation.payload;
          if (customTargetService || !isMockBackend) {
            await target.recordDailyCheckin(memberId, date, type);
          }
          break;
        }
      }

      syncedIds.add(mutation.id);
      processed++;
    } catch (err) {
      console.error(`Failed to replay mutation ${mutation.id}:`, err);
      errors++;
      mutation.retryCount = (mutation.retryCount || 0) + 1;
      mutation.lastError = err instanceof Error ? err.message : String(err);
      remainingQueue.push(mutation);
    }
  }

  saveSyncedIds(syncedIds);
  saveOutbox(remainingQueue);

  isFlushing = false;
  isReplayingFlag = false;

  notifySyncStatusChanged(false, processed);

  return { processed, errors };
}

// Automatically flush when browser reconnects
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    flushOutbox().catch((err) => {
      console.error('Auto-flush on online event failed:', err);
    });
  });
}

export const offlineSyncQueue = {
  getPendingSyncCount,
  getPendingMutations,
  clearPendingMutations,
  enqueueMutation,
  flushOutbox,
  isOnline,
  setNetworkOverride,
  isReplaying,
  addExpense,
  updateExpense,
  deleteExpense,
  bulkAddExpenses,
  recordDailyCheckin,
};

export default offlineSyncQueue;
