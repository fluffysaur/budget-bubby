/**
 * Offline-First Mutation Queue and Cache Manager for Budget Bubby.
 *
 * Features:
 * - Persistent outbox queue in localStorage with in-memory fallback.
 * - Captures offline mutations (addExpense, updateExpense, deleteExpense, bulkAddExpenses, recordDailyCheckin).
 * - Applies optimistic local updates immediately to TanStack Query cache (and mock storage in mock mode).
 * - Tracks pending and failed synchronization counts and broadcasts `offlineSyncStatusChanged` custom event.
 * - Automatically replays/flushes pending mutations on startup, visibilitychange, and online events.
 * - Full deduplication protection against duplicate replay or conflicting mutations.
 */

import type {
    Expense,
    CreateExpenseInput,
    UpdateExpenseInput,
    DailyCheckin,
    CheckinType,
    InboxResolveStatus,
} from "../types/finance";
import { isSupabaseConfigured } from "./supabaseClient";
import { mockFinanceService } from "./mockFinanceService";
import { supabaseFinanceService } from "./supabaseFinanceService";
import type { FinanceService } from "./financeService";
import { PartialBulkAddError } from "./bulkAddError";
import { queryClient } from "../lib/queryClient";
import { getCurrentSingaporeTime, getTodayDateString } from "../lib/dateUtils";

export type MutationType =
    | "addExpense"
    | "updateExpense"
    | "deleteExpense"
    | "bulkAddExpenses"
    | "recordDailyCheckin"
    | "confirmInboxItem"
    | "resolveInboxItem";

export type MutationStatus = "pending" | "failed";

export const MAX_SYNC_RETRIES = 5;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface QueuedMutation<T = any> {
    id: string;
    type: MutationType;
    payload: T;
    timestamp: number;
    retryCount: number;
    lastError?: string;
    status?: MutationStatus;
}

export interface OfflineSyncStatusDetail {
    pendingCount: number;
    failedCount: number;
    isSyncing: boolean;
    lastSyncedCount?: number;
}

const OFFLINE_OUTBOX_STORAGE_KEY = "budget_bubby_offline_outbox_v1";
const SYNCED_MUTATION_IDS_KEY = "budget_bubby_synced_mutation_ids_v1";

// In-memory fallback for environments without localStorage or when storage throws
let memoryQueue: QueuedMutation[] = [];
let memorySyncedIds: Set<string> = new Set();
let isFlushing = false;
let isReplayingFlag = false;
let activeFlushPromise: Promise<{ processed: number; errors: number }> | null =
    null;
let networkOverride: boolean | null = null;

export function isDemoModeActive(): boolean {
    if (typeof window !== "undefined" && window.sessionStorage) {
        return (
            window.sessionStorage.getItem("budget_bubby_demo_pin") === "true" ||
            window.sessionStorage.getItem("budget_buddy_demo_pin") === "true"
        );
    }
    return false;
}

function isMockBackendActive(): boolean {
    return isDemoModeActive() || !isSupabaseConfigured();
}

export function isOnline(): boolean {
    if (networkOverride !== null) {
        return networkOverride;
    }
    if (
        typeof navigator !== "undefined" &&
        typeof navigator.onLine === "boolean"
    ) {
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

function generateClientUuid(): string {
    if (
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
    ) {
        return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

function loadOutbox(): QueuedMutation[] {
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            const data = window.localStorage.getItem(
                OFFLINE_OUTBOX_STORAGE_KEY,
            );
            if (data) {
                return JSON.parse(data);
            }
        } catch {
            // Fallback to memory
        }
    }
    return [...memoryQueue];
}

function saveOutbox(queue: QueuedMutation[]): void {
    memoryQueue = [...queue];
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            window.localStorage.setItem(
                OFFLINE_OUTBOX_STORAGE_KEY,
                JSON.stringify(queue),
            );
        } catch {
            // Ignore storage errors
        }
    }
}

function loadSyncedIds(): Set<string> {
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            const data = window.localStorage.getItem(SYNCED_MUTATION_IDS_KEY);
            if (data) {
                return new Set(JSON.parse(data));
            }
        } catch {
            // Fallback
        }
    }
    return new Set(memorySyncedIds);
}

function saveSyncedIds(ids: Set<string>): void {
    memorySyncedIds = new Set(ids);
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            // Keep only the most recent 500 ids to prevent unbounded growth
            const array = Array.from(ids).slice(-500);
            window.localStorage.setItem(
                SYNCED_MUTATION_IDS_KEY,
                JSON.stringify(array),
            );
        } catch {
            // Ignore
        }
    }
}

export function getPendingSyncCount(): number {
    return loadOutbox().filter((m) => m.status !== "failed").length;
}

export function getFailedSyncCount(): number {
    return loadOutbox().filter((m) => m.status === "failed").length;
}

export function getPendingMutations(): QueuedMutation[] {
    return loadOutbox();
}

export function getFailedMutations(): QueuedMutation[] {
    return loadOutbox().filter((m) => m.status === "failed");
}

export function clearPendingMutations(): void {
    memoryQueue = [];
    if (typeof window !== "undefined" && window.localStorage) {
        try {
            window.localStorage.removeItem(OFFLINE_OUTBOX_STORAGE_KEY);
        } catch {
            // ignore
        }
    }
    notifySyncStatusChanged(false, 0);
}

export function notifySyncStatusChanged(
    isSyncing = false,
    lastSyncedCount?: number,
): void {
    const outbox = loadOutbox();
    const pendingCount = outbox.filter((m) => m.status !== "failed").length;
    const failedCount = outbox.filter((m) => m.status === "failed").length;
    if (typeof window !== "undefined") {
        const event = new CustomEvent<OfflineSyncStatusDetail>(
            "offlineSyncStatusChanged",
            {
                detail: {
                    pendingCount,
                    failedCount,
                    isSyncing,
                    lastSyncedCount,
                },
            },
        );
        window.dispatchEvent(event);
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function enqueueMutation<T = any>(
    type: MutationType,
    payload: T,
): QueuedMutation<T> {
    const queue = loadOutbox();

    // Deduplication / optimization when deleteExpense arrives
    if (type === "deleteExpense") {
        const targetId =
            typeof payload === "object" && payload !== null && "id" in payload
                ? (payload as { id?: string }).id
                : undefined;

        if (targetId) {
            // Drop any queued updateExpense entries for this expense id
            for (let i = queue.length - 1; i >= 0; i--) {
                const m = queue[i];
                if (
                    m.type === "updateExpense" &&
                    (m.payload as { id?: string })?.id === targetId
                ) {
                    queue.splice(i, 1);
                }
            }

            // Cancel ONLY when the matched mutation is an addExpense for this id
            const addIdx = queue.findIndex((m) => {
                if (m.type !== "addExpense") return false;
                const p = m.payload as {
                    optimisticId?: string;
                    id?: string;
                    input?: { id?: string };
                } | null;
                return (
                    p?.optimisticId === targetId ||
                    p?.id === targetId ||
                    p?.input?.id === targetId
                );
            });

            if (addIdx >= 0) {
                // Created offline and deleted before syncing: drop the add (and its updates) without queuing a delete
                queue.splice(addIdx, 1);
                saveOutbox(queue);
                notifySyncStatusChanged(false);
                return {
                    id: `cancelled-${Date.now()}`,
                    type,
                    payload,
                    timestamp: Date.now(),
                    retryCount: 0,
                    status: "pending",
                };
            }

            const existingDelete = queue.find(
                (m) =>
                    m.type === "deleteExpense" &&
                    (m.payload as { id?: string })?.id === targetId,
            );
            if (existingDelete) {
                saveOutbox(queue);
                notifySyncStatusChanged(false);
                return existingDelete as QueuedMutation<T>;
            }
        }
    }

    const mutation: QueuedMutation<T> = {
        id: `mut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        type,
        payload,
        timestamp: Date.now(),
        retryCount: 0,
        status: "pending",
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

/** Fetch failures, as opposed to the server rejecting the request. */
export function isNetworkError(err: unknown): boolean {
    if (err instanceof TypeError) return true;
    const message = err instanceof Error ? err.message : String(err);
    return /failed to fetch|network|load failed|offline|timeout|timed out|abort|connection/i.test(
        message,
    );
}

/** Duplicate key errors on replay (Postgres 23505) indicate the row was already inserted. */
export function isDuplicateKeyError(err: unknown): boolean {
    if (!err || typeof err !== "object") return false;
    const code = (err as { code?: string }).code;
    const message = (err as { message?: string }).message || "";
    return code === "23505" || /duplicate key/i.test(message);
}

// ---------------------------------------------------------------------------
// Optimistic TanStack Query Cache Helpers
// ---------------------------------------------------------------------------

function buildOptimisticExpense(
    input: CreateExpenseInput & { id: string },
): Expense {
    return {
        id: input.id,
        household_id: input.household_id || "hh-offline",
        payer_id: input.payer_id,
        category_id: input.category_id || null,
        date: input.date,
        time: input.time || getCurrentSingaporeTime(),
        item: input.item,
        amount: Math.round(input.amount * 100) / 100,
        remarks: input.remarks || null,
        is_shared: input.is_shared,
        split_ratio: input.split_ratio ?? 0.5,
        settled: false,
        tags: input.tags || [],
        goal_id: input.goal_id || null,
        original_amount:
            input.original_amount !== undefined ? input.original_amount : null,
        original_currency: input.original_currency || "SGD",
        exchange_rate:
            input.exchange_rate !== undefined ? input.exchange_rate : null,
        created_at: new Date().toISOString(),
    };
}

function patchExpenseCacheOnAdd(added: Expense[]): void {
    const mergeNew = (old: Expense[] | undefined) => {
        if (!old) return old;
        const existingIds = new Set(old.map((e) => e.id));
        const fresh = added.filter((e) => !existingIds.has(e.id));
        return fresh.length > 0 ? [...fresh, ...old] : old;
    };
    try {
        queryClient.setQueriesData<Expense[]>(
            { queryKey: ["finance", "expenses"] },
            mergeNew,
        );
        queryClient.setQueriesData<Expense[]>(
            { queryKey: ["finance", "all-expenses"] },
            mergeNew,
        );
    } catch {
        // Ignore if queryClient is unavailable
    }
}

function patchExpenseCacheOnUpdate(
    id: string,
    updates: UpdateExpenseInput,
): Expense | undefined {
    let matched: Expense | undefined;
    const applyUpdate = (old: Expense[] | undefined) => {
        if (!old) return old;
        return old.map((e) => {
            if (e.id === id) {
                const updated: Expense = { ...e, ...updates };
                matched = updated;
                return updated;
            }
            return e;
        });
    };
    try {
        queryClient.setQueriesData<Expense[]>(
            { queryKey: ["finance", "expenses"] },
            applyUpdate,
        );
        queryClient.setQueriesData<Expense[]>(
            { queryKey: ["finance", "all-expenses"] },
            applyUpdate,
        );
    } catch {
        // Ignore
    }
    return matched;
}

function patchExpenseCacheOnDelete(id: string): void {
    const removeById = (old: Expense[] | undefined) =>
        old ? old.filter((e) => e.id !== id) : old;
    try {
        queryClient.setQueriesData<Expense[]>(
            { queryKey: ["finance", "expenses"] },
            removeById,
        );
        queryClient.setQueriesData<Expense[]>(
            { queryKey: ["finance", "all-expenses"] },
            removeById,
        );
    } catch {
        // Ignore
    }
}

function findOptimisticAddInOutbox(id: string): Expense | undefined {
    const queue = loadOutbox();
    for (const m of queue) {
        if (m.type === "addExpense") {
            const p = m.payload as {
                optimisticId?: string;
                input?: CreateExpenseInput;
            } | null;
            const input = p?.input || (m.payload as CreateExpenseInput);
            const candidateId = p?.optimisticId || input?.id;
            if (candidateId === id && input) {
                return buildOptimisticExpense({ ...input, id });
            }
        }
    }
    return undefined;
}

// ---------------------------------------------------------------------------
// Mutation Handlers (Offline-First with Optimistic Updates)
// ---------------------------------------------------------------------------

export async function addExpense(input: CreateExpenseInput): Promise<Expense> {
    const id = input.id || generateClientUuid();
    const inputWithId: CreateExpenseInput = { ...input, id };

    if (isOnline()) {
        try {
            const backend = getBackendService();
            return await backend.addExpense(inputWithId);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn("Network error on addExpense, queueing offline:", err);
        }
    }

    // Offline / Network failure:
    const optimistic = isMockBackendActive()
        ? await mockFinanceService.addExpense(inputWithId)
        : buildOptimisticExpense({ ...inputWithId, id });
    patchExpenseCacheOnAdd([optimistic]);
    enqueueMutation("addExpense", {
        input: inputWithId,
        optimisticId: optimistic.id,
    });
    return optimistic;
}

export async function updateExpense(
    id: string,
    updates: UpdateExpenseInput,
): Promise<Expense> {
    if (isOnline()) {
        try {
            const backend = getBackendService();
            return await backend.updateExpense(id, updates);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn(
                "Network error on updateExpense, queueing offline:",
                err,
            );
        }
    }

    let optimistic: Expense | undefined;
    if (isMockBackendActive()) {
        try {
            optimistic = await mockFinanceService.updateExpense(id, updates);
        } catch {
            // Row may be a server-side row or only in TanStack Query cache
        }
    }

    const cachedUpdated = patchExpenseCacheOnUpdate(id, updates);
    if (!optimistic) {
        const queuedAdd = findOptimisticAddInOutbox(id);
        const base: Expense = cachedUpdated ??
            queuedAdd ?? {
                id,
                household_id: "hh-offline",
                payer_id: updates.payer_id || "",
                category_id: updates.category_id ?? null,
                date: updates.date || getTodayDateString(),
                item: updates.item || "",
                amount: updates.amount ?? 0,
                remarks: updates.remarks ?? null,
                is_shared: updates.is_shared ?? false,
                split_ratio: updates.split_ratio ?? 0.5,
                settled: updates.settled ?? false,
                tags: updates.tags || [],
                goal_id: updates.goal_id ?? null,
            };
        optimistic = { ...base, ...updates };
    }

    enqueueMutation("updateExpense", { id, updates });
    return optimistic;
}

export async function deleteExpense(id: string): Promise<void> {
    if (isOnline()) {
        try {
            const backend = getBackendService();
            return await backend.deleteExpense(id);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn(
                "Network error on deleteExpense, queueing offline:",
                err,
            );
        }
    }

    if (isMockBackendActive()) {
        await mockFinanceService.deleteExpense(id);
    }
    patchExpenseCacheOnDelete(id);
    enqueueMutation("deleteExpense", { id });
}

export async function bulkAddExpenses(
    expenses: CreateExpenseInput[],
): Promise<Expense[]> {
    const expensesWithIds = expenses.map((e) =>
        e.id ? e : { ...e, id: generateClientUuid() },
    );
    // Rows the backend already saved before a mid-batch failure
    let alreadySaved: Expense[] = [];

    if (isOnline()) {
        try {
            const backend = getBackendService();
            return await backend.bulkAddExpenses(expensesWithIds);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn(
                "Network error on bulkAddExpenses, queueing offline:",
                err,
            );
            if (err instanceof PartialBulkAddError) {
                alreadySaved = err.created;
            }
        }
    }

    // Queue only the rows that were not saved, so replay cannot duplicate them
    const remaining = expensesWithIds.slice(alreadySaved.length);
    const optimistics = isMockBackendActive()
        ? await mockFinanceService.bulkAddExpenses(remaining)
        : remaining.map((e) =>
              buildOptimisticExpense(e as CreateExpenseInput & { id: string }),
          );
    patchExpenseCacheOnAdd(optimistics);
    enqueueMutation("bulkAddExpenses", {
        expenses: remaining,
        optimisticIds: optimistics.map((o) => o.id),
    });
    return [...alreadySaved, ...optimistics];
}

export async function recordDailyCheckin(
    memberId: string,
    date: string,
    type: CheckinType,
): Promise<DailyCheckin> {
    if (isOnline()) {
        try {
            const backend = getBackendService();
            return await backend.recordDailyCheckin(memberId, date, type);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn(
                "Network error on recordDailyCheckin, queueing offline:",
                err,
            );
        }
    }

    const optimistic: DailyCheckin = isMockBackendActive()
        ? await mockFinanceService.recordDailyCheckin(memberId, date, type)
        : {
              id: `chk-${Date.now()}`,
              household_id: "hh-offline",
              member_id: memberId,
              checkin_date: date,
              type,
              created_at: new Date().toISOString(),
          };
    enqueueMutation("recordDailyCheckin", { memberId, date, type });
    return optimistic;
}

/** Expense id returned while an inbox confirm waits in the outbox. */
export const QUEUED_INBOX_EXPENSE_PREFIX = "queued-inbox-";

/**
 * Inbox confirm. Queued only when offline or the request never reached the
 * server; replay is safe because the RPC returns the existing expense id
 * for an already-confirmed item.
 */
export async function confirmInboxItem(
    itemId: string,
    expense: CreateExpenseInput,
): Promise<string> {
    if (isOnline()) {
        try {
            return await getBackendService().confirmInboxItem(itemId, expense);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn(
                "Network error on confirmInboxItem, queueing offline:",
                err,
            );
        }
    }
    enqueueMutation("confirmInboxItem", { itemId, expense });
    return `${QUEUED_INBOX_EXPENSE_PREFIX}${itemId}`;
}

export async function resolveInboxItem(
    itemId: string,
    status: InboxResolveStatus,
): Promise<void> {
    if (isOnline()) {
        try {
            return await getBackendService().resolveInboxItem(itemId, status);
        } catch (err) {
            if (!isNetworkError(err)) throw err;
            console.warn(
                "Network error on resolveInboxItem, queueing offline:",
                err,
            );
        }
    }
    enqueueMutation("resolveInboxItem", { itemId, status });
}

// ---------------------------------------------------------------------------
// Replay & Flush Engine
// ---------------------------------------------------------------------------

export async function flushOutbox(
    customTargetService?: Partial<FinanceService>,
): Promise<{ processed: number; errors: number }> {
    if (isFlushing) {
        if (activeFlushPromise && !customTargetService) {
            return activeFlushPromise;
        }
        return { processed: 0, errors: 0 };
    }

    const initialQueue = loadOutbox();
    const actionableQueue = initialQueue.filter((m) => m.status !== "failed");
    if (actionableQueue.length === 0) {
        notifySyncStatusChanged(false, 0);
        return { processed: 0, errors: 0 };
    }

    isFlushing = true;
    isReplayingFlag = true;
    notifySyncStatusChanged(true);

    const runFlush = async (): Promise<{
        processed: number;
        errors: number;
    }> => {
        let processed = 0;
        let errors = 0;
        const processedIds = new Set<string>();
        const updatedMutations = new Map<string, QueuedMutation>();
        const resolvedIdMap = new Map<string, string>();
        const syncedIds = loadSyncedIds();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const target = (customTargetService || getBackendService()) as any;
        const isMockBackend = target === mockFinanceService;

        for (const mutation of actionableQueue) {
            // Deduplication check
            if (syncedIds.has(mutation.id)) {
                processedIds.add(mutation.id);
                continue;
            }

            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const payload = mutation.payload as any;

                switch (mutation.type) {
                    case "addExpense": {
                        const input = payload?.input || payload;
                        if (customTargetService || !isMockBackend) {
                            try {
                                const created = await target.addExpense(input);
                                const optId =
                                    payload?.optimisticId || input?.id;
                                if (
                                    optId &&
                                    created?.id &&
                                    created.id !== optId
                                ) {
                                    resolvedIdMap.set(optId, created.id);
                                }
                            } catch (err) {
                                if (!isDuplicateKeyError(err)) throw err;
                            }
                        }
                        break;
                    }
                    case "updateExpense": {
                        const rawId = payload.id;
                        const resolvedId = resolvedIdMap.get(rawId) || rawId;
                        const { updates } = payload;
                        if (customTargetService || !isMockBackend) {
                            await target.updateExpense(resolvedId, updates);
                        }
                        break;
                    }
                    case "deleteExpense": {
                        const rawId = payload.id;
                        const resolvedId = resolvedIdMap.get(rawId) || rawId;
                        if (customTargetService || !isMockBackend) {
                            await target.deleteExpense(resolvedId);
                        }
                        break;
                    }
                    case "bulkAddExpenses": {
                        const items = payload?.expenses || payload;
                        if (customTargetService || !isMockBackend) {
                            try {
                                await target.bulkAddExpenses(items);
                            } catch (err) {
                                if (!isDuplicateKeyError(err)) throw err;
                            }
                        }
                        break;
                    }
                    case "recordDailyCheckin": {
                        const { memberId, date, type } = payload;
                        if (customTargetService || !isMockBackend) {
                            await target.recordDailyCheckin(
                                memberId,
                                date,
                                type,
                            );
                        }
                        break;
                    }
                    case "confirmInboxItem": {
                        const { itemId, expense } = payload;
                        await target.confirmInboxItem(itemId, expense);
                        break;
                    }
                    case "resolveInboxItem": {
                        const { itemId, status } = payload;
                        await target.resolveInboxItem(itemId, status);
                        break;
                    }
                }

                syncedIds.add(mutation.id);
                processedIds.add(mutation.id);
                processed++;
            } catch (err) {
                console.error(`Failed to replay mutation ${mutation.id}:`, err);
                errors++;
                let updatedPayload = mutation.payload;
                if (
                    err instanceof PartialBulkAddError &&
                    mutation.type === "bulkAddExpenses"
                ) {
                    // Keep only the rows that were not saved, so the retry cannot duplicate them
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const payload = mutation.payload as any;
                    const items: CreateExpenseInput[] =
                        payload?.expenses || payload;
                    updatedPayload = {
                        ...(Array.isArray(payload) ? {} : payload),
                        expenses: items.slice(err.created.length),
                    };
                }
                const nextRetryCount = (mutation.retryCount || 0) + 1;
                const nextStatus: MutationStatus =
                    nextRetryCount >= MAX_SYNC_RETRIES ? "failed" : "pending";
                updatedMutations.set(mutation.id, {
                    ...mutation,
                    payload: updatedPayload,
                    retryCount: nextRetryCount,
                    lastError: err instanceof Error ? err.message : String(err),
                    status: nextStatus,
                });
            }
        }

        saveSyncedIds(syncedIds);

        // Re-read current outbox to preserve any mutations enqueued while flush was in flight
        const currentOutbox = loadOutbox();
        const mergedOutbox: QueuedMutation[] = [];
        for (const item of currentOutbox) {
            if (processedIds.has(item.id) || syncedIds.has(item.id)) {
                continue;
            }
            const updated = updatedMutations.get(item.id);
            if (updated) {
                mergedOutbox.push(updated);
            } else {
                // Rewrite optimisticId if resolved during this flush
                if (
                    (item.type === "updateExpense" ||
                        item.type === "deleteExpense") &&
                    item.payload?.id &&
                    resolvedIdMap.has(item.payload.id)
                ) {
                    mergedOutbox.push({
                        ...item,
                        payload: {
                            ...item.payload,
                            id: resolvedIdMap.get(item.payload.id),
                        },
                    });
                } else {
                    mergedOutbox.push(item);
                }
            }
        }
        saveOutbox(mergedOutbox);

        isFlushing = false;
        isReplayingFlag = false;
        activeFlushPromise = null;

        if (processed > 0) {
            try {
                await queryClient.invalidateQueries({ queryKey: ["finance"] });
            } catch {
                // Ignore if queryClient is unavailable
            }
        }

        notifySyncStatusChanged(false, processed);

        return { processed, errors };
    };

    activeFlushPromise = runFlush();
    return activeFlushPromise;
}

/**
 * Resets a failed mutation back to pending (retryCount = 0) and triggers a flush.
 */
export async function retryFailedMutation(
    mutationId: string,
    customTargetService?: Partial<FinanceService>,
): Promise<{ processed: number; errors: number }> {
    const queue = loadOutbox();
    let changed = false;
    const updated = queue.map((m) => {
        if (m.id === mutationId) {
            changed = true;
            return {
                ...m,
                retryCount: 0,
                lastError: undefined,
                status: "pending" as const,
            };
        }
        return m;
    });

    if (changed) {
        saveOutbox(updated);
        notifySyncStatusChanged(false);
    }

    if (isOnline() || customTargetService) {
        return await flushOutbox(customTargetService);
    }
    return { processed: 0, errors: 0 };
}

/**
 * Discards a failed mutation from the outbox and invalidates ["finance"] queries.
 */
export async function discardFailedMutation(mutationId: string): Promise<void> {
    const queue = loadOutbox();
    const remaining = queue.filter((m) => m.id !== mutationId);
    saveOutbox(remaining);
    notifySyncStatusChanged(false);
    try {
        await queryClient.invalidateQueries({ queryKey: ["finance"] });
    } catch {
        // Ignore
    }
}

/**
 * Triggers an automatic flush if currently online and there are pending mutations.
 */
export function flushIfOnline(): Promise<{
    processed: number;
    errors: number;
}> {
    if (isOnline() && getPendingSyncCount() > 0) {
        return flushOutbox().catch((err) => {
            console.error("Auto-flush failed:", err);
            return { processed: 0, errors: 0 };
        });
    }
    return Promise.resolve({ processed: 0, errors: 0 });
}

// Automatically flush on startup, when browser reconnects, and when page becomes visible
if (typeof window !== "undefined") {
    window.addEventListener("online", () => {
        flushOutbox().catch((err) => {
            console.error("Auto-flush on online event failed:", err);
        });
    });

    if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible" && isOnline()) {
                flushIfOnline();
            }
        });
    }

    flushIfOnline();
}

export const offlineSyncQueue = {
    getPendingSyncCount,
    getFailedSyncCount,
    getPendingMutations,
    getFailedMutations,
    clearPendingMutations,
    enqueueMutation,
    flushOutbox,
    flushIfOnline,
    retryFailedMutation,
    discardFailedMutation,
    isOnline,
    setNetworkOverride,
    isReplaying,
    isNetworkError,
    isDuplicateKeyError,
    addExpense,
    updateExpense,
    deleteExpense,
    bulkAddExpenses,
    recordDailyCheckin,
    confirmInboxItem,
    resolveInboxItem,
};

export default offlineSyncQueue;
