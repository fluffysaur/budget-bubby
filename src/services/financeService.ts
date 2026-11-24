/**
 * Dual-Mode Finance Service Dispatcher for Budget Bubby.
 * Seamlessly switches between Supabase PostgreSQL and In-Memory / LocalStorage Mock.
 */

import type {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
    AccountSnapshot,
    BaseBudgetProfile,
    BaseProfileAllocation,
    BulkBalanceUpdateItem,
    Category,
    CreateCategoryInput,
    UpdateCategoryInput,
    CreateExpenseInput,
    UpdateExpenseInput,
    CreateGoalInput,
    CreateRecurringItemInput,
    Expense,
    ExpenseFilter,
    Household,
    HouseholdOverview,
    HouseholdSettingsInput,
    MonthlyBudget,
    MonthlyBudgetDetail,
    MonthlyBudgetHistoryRow,
    Perspective,
    RecurringItem,
    SavingsGoal,
    CreditCard,
    CreateCreditCardInput,
    CreditCardStatement,
    UpsertCreditCardStatementInput,
    DailyCheckin,
    CheckinType,
    NotificationPreferences,
    UpdateNotificationPreferencesInput,
    NotificationLogEntry,
    NotificationLogRef,
    PushSubscriptionInput,
    BonusEvent,
    SettleUpRecordInput,
    SettleUpsResult,
    BonusEventsResult,
    BonusSplitShare,
    SaveBonusEventInput,
} from "../types/finance";
import { isSupabaseConfigured } from "./supabaseClient";
import { supabaseFinanceService } from "./supabaseFinanceService";
import {
    offlineSyncQueue,
    registerBackendResolver,
} from "./offlineSyncQueue";
import { queryClient } from "../lib/queryClient";
import type { InboxService } from "./inbox/inboxService";
import { emitInboxEvent, type InboxEventMap } from "../lib/inbox/inboxEvents";
import { isDayLogged } from "../lib/logging/dayLogged";

export interface FinanceService extends InboxService {
    getHouseholdOverview(): Promise<HouseholdOverview>;
    updateHouseholdSettings(
        settings: HouseholdSettingsInput,
    ): Promise<Household>;
    hatchMemberBubby(memberId: string): Promise<string>;
    getAccounts(perspective: Perspective): Promise<Account[]>;
    createAccount(input: CreateAccountInput): Promise<Account>;
    updateAccount(id: string, updates: UpdateAccountInput): Promise<Account>;
    deleteAccount(id: string): Promise<void>;
    updateAccountBalance(
        accountId: string,
        newBalance: number,
        notes?: string,
        date?: string,
    ): Promise<Account>;
    bulkUpdateAccountBalances(
        updates: BulkBalanceUpdateItem[],
        snapshotDate: string,
    ): Promise<Account[]>;
    getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]>;
    getAllAccountSnapshots(
        perspective?: Perspective,
    ): Promise<AccountSnapshot[]>;
    getBaseProfiles(): Promise<BaseBudgetProfile[]>;
    getBaseAllocations(profileId?: string): Promise<BaseProfileAllocation[]>;
    getCategories(): Promise<Category[]>;
    addCategory(input: CreateCategoryInput): Promise<Category>;
    updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category>;
    deleteCategory(id: string): Promise<void>;
    seedDefaultCategories(): Promise<Category[]>;
    updateBaseProfile(
        profile: BaseBudgetProfile,
        allocations: BaseProfileAllocation[],
    ): Promise<void>;
    getMonthlyBudget(
        month: string,
        memberId?: string,
    ): Promise<MonthlyBudgetDetail>;
    /** Stored budgets for these months, all members. Read-only: never creates rows. */
    getMonthlyBudgetHistory(
        months: string[],
    ): Promise<MonthlyBudgetHistoryRow[]>;
    updateMonthlyBudget(
        budget: Partial<MonthlyBudget> & { id?: string },
    ): Promise<void>;
    getExpenses(filter?: ExpenseFilter): Promise<Expense[]>;
    addExpense(expense: CreateExpenseInput): Promise<Expense>;
    updateExpense(id: string, updates: UpdateExpenseInput): Promise<Expense>;
    bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]>;
    deleteExpense(id: string): Promise<void>;
    settleSharedExpenses(
        member1Id: string,
        member2Id: string,
        expenseIds?: string[],
        record?: SettleUpRecordInput,
    ): Promise<void>;
    getSettleUps(): Promise<SettleUpsResult>;
    getGoals(): Promise<SavingsGoal[]>;
    getGoal(id: string): Promise<SavingsGoal | null>;
    addGoal(goal: CreateGoalInput): Promise<SavingsGoal>;
    updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal>;
    getRecurringItems(): Promise<RecurringItem[]>;
    addRecurringItem(
        recurringItem: CreateRecurringItemInput,
    ): Promise<RecurringItem>;
    updateRecurringItem(
        id: string,
        updates: Partial<RecurringItem>,
    ): Promise<RecurringItem>;
    deleteRecurringItem(id: string): Promise<void>;
    // Credit Cards
    getCreditCards(): Promise<CreditCard[]>;
    addCreditCard(input: CreateCreditCardInput): Promise<CreditCard>;
    updateCreditCard(
        id: string,
        updates: Partial<CreditCard>,
    ): Promise<CreditCard>;
    deleteCreditCard(id: string): Promise<void>;
    getCreditCardStatements(month?: string): Promise<CreditCardStatement[]>;
    upsertCreditCardStatement(
        input: UpsertCreditCardStatementInput,
    ): Promise<CreditCardStatement>;
    // Daily Check-ins
    getDailyCheckins(memberId?: string): Promise<DailyCheckin[]>;
    recordDailyCheckin(
        memberId: string,
        date: string,
        type: CheckinType,
    ): Promise<DailyCheckin>;
    // Notification Preferences
    getNotificationPreferences(
        memberId: string,
    ): Promise<NotificationPreferences>;
    updateNotificationPreferences(
        memberId: string,
        updates: UpdateNotificationPreferencesInput,
    ): Promise<NotificationPreferences>;
    // Notification Log
    getNotificationLog(memberId: string): Promise<NotificationLogEntry[]>;
    /** Returns true only for the first caller to claim this reminder key. */
    claimNotificationSend(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<boolean>;
    markNotificationsRead(
        memberId: string,
        refs: NotificationLogRef[],
    ): Promise<void>;
    dismissNotification(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<void>;
    // Push Subscriptions (one per device)
    savePushSubscription(
        memberId: string,
        subscription: PushSubscriptionInput,
    ): Promise<void>;
    deletePushSubscription(endpoint: string): Promise<void>;
    // Bonus Log
    /** `available: false` when the bonus tables are missing (migration not applied). */
    getBonusEvents(): Promise<BonusEventsResult>;
    saveBonusEvent(input: SaveBonusEventInput): Promise<BonusEvent>;
    deleteBonusEvent(id: string): Promise<void>;
    /** The member's saved split, or the seeded default when none or unavailable. */
    getBonusSplitDefault(memberId: string): Promise<BonusSplitShare[]>;
    saveBonusSplitDefault(
        memberId: string,
        split: BonusSplitShare[],
    ): Promise<void>;
}

export function isDemoModeActive(): boolean {
    if (typeof window !== "undefined" && window.sessionStorage) {
        return (
            window.sessionStorage.getItem("budget_bubby_demo_pin") === "true" ||
            window.sessionStorage.getItem("budget_buddy_demo_pin") === "true"
        );
    }
    return false;
}

export function isMockModeActive(): boolean {
    return !isSupabaseConfigured() || isDemoModeActive();
}

let mockFinanceServicePromise: Promise<FinanceService> | null = null;

function loadMockFinanceService(): Promise<FinanceService> {
    if (!mockFinanceServicePromise) {
        mockFinanceServicePromise = import("./mockFinanceService").then(
            (mod) => mod.mockFinanceService,
        );
    }
    return mockFinanceServicePromise;
}

export async function getActiveService(): Promise<FinanceService> {
    return isMockModeActive()
        ? loadMockFinanceService()
        : supabaseFinanceService;
}

registerBackendResolver(getActiveService);

/** True when the cached daily check-ins already have this member and date. */
function isCheckinCached(memberId: string, date: string): boolean {
    try {
        return queryClient
            .getQueriesData<DailyCheckin[]>({
                queryKey: ["finance", "daily-checkins"],
            })
            .some(
                ([, data]) =>
                    Array.isArray(data) && isDayLogged(data, memberId, date),
            );
    } catch {
        return false;
    }
}

/** Runs `save`, then emits day:logged for each (member, date) it logged. */
async function withDayLogged<T>(
    entries: { memberId: string; date: string }[],
    source: InboxEventMap["day:logged"]["source"],
    save: () => Promise<T>,
): Promise<T> {
    const seen = new Set<string>();
    const unique = entries.filter((e) => {
        const key = `${e.memberId}|${e.date}`;
        if (!e.memberId || !e.date || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
    const first = unique.map((e) => !isCheckinCached(e.memberId, e.date));
    const res = await save();
    unique.forEach((e, i) =>
        emitInboxEvent("day:logged", { ...e, source, firstForDate: first[i] }),
    );
    return res;
}

function invalidateInboxCache() {
    try {
        queryClient.invalidateQueries({ queryKey: ["finance", "inbox"] });
    } catch {
        // In restricted test environments without QueryClient mounted, fail silently
    }
}

function invalidateFinanceCache() {
    if (!offlineSyncQueue.isOnline()) {
        return;
    }
    try {
        queryClient.invalidateQueries({ queryKey: ["finance"] });
    } catch {
        // In restricted test environments without QueryClient mounted, fail silently
    }
}

export const financeService: FinanceService = {
    getHouseholdOverview: async () =>
        (await getActiveService()).getHouseholdOverview(),
    updateHouseholdSettings: async (settings) => {
        const res = await (
            await getActiveService()
        ).updateHouseholdSettings(settings);
        invalidateFinanceCache();
        return res;
    },
    hatchMemberBubby: async (memberId) => {
        const ts = await (await getActiveService()).hatchMemberBubby(memberId);
        invalidateFinanceCache();
        return ts;
    },
    getAccounts: async (perspective) =>
        (await getActiveService()).getAccounts(perspective),
    createAccount: async (input) => {
        const res = await (await getActiveService()).createAccount(input);
        invalidateFinanceCache();
        return res;
    },
    updateAccount: async (id, updates) => {
        const res = await (await getActiveService()).updateAccount(id, updates);
        invalidateFinanceCache();
        return res;
    },
    deleteAccount: async (id) => {
        await (await getActiveService()).deleteAccount(id);
        invalidateFinanceCache();
    },
    updateAccountBalance: async (accountId, newBalance, notes, date) => {
        const res = await (await getActiveService()).updateAccountBalance(
            accountId,
            newBalance,
            notes,
            date,
        );
        invalidateFinanceCache();
        return res;
    },
    bulkUpdateAccountBalances: async (updates, snapshotDate) => {
        const res = await (await getActiveService()).bulkUpdateAccountBalances(
            updates,
            snapshotDate,
        );
        invalidateFinanceCache();
        return res;
    },
    getAccountSnapshots: async (accountId) =>
        (await getActiveService()).getAccountSnapshots(accountId),
    getAllAccountSnapshots: async (perspective) =>
        (await getActiveService()).getAllAccountSnapshots(perspective),
    getBaseProfiles: async () => (await getActiveService()).getBaseProfiles(),
    getBaseAllocations: async (profileId) =>
        (await getActiveService()).getBaseAllocations(profileId),
    getCategories: async () => (await getActiveService()).getCategories(),
    addCategory: async (input) => {
        const res = await (await getActiveService()).addCategory(input);
        invalidateFinanceCache();
        return res;
    },
    updateCategory: async (id, updates) => {
        const res = await (
            await getActiveService()
        ).updateCategory(id, updates);
        invalidateFinanceCache();
        return res;
    },
    deleteCategory: async (id) => {
        await (await getActiveService()).deleteCategory(id);
        invalidateFinanceCache();
    },
    seedDefaultCategories: async () => {
        const res = await (await getActiveService()).seedDefaultCategories();
        invalidateFinanceCache();
        return res;
    },
    updateBaseProfile: async (profile, allocations) => {
        await (await getActiveService()).updateBaseProfile(
            profile,
            allocations,
        );
        invalidateFinanceCache();
    },
    getMonthlyBudget: async (month, memberId) =>
        (await getActiveService()).getMonthlyBudget(month, memberId),
    getMonthlyBudgetHistory: async (months) =>
        (await getActiveService()).getMonthlyBudgetHistory(months),
    updateMonthlyBudget: async (budget) => {
        await (await getActiveService()).updateMonthlyBudget(budget);
        invalidateFinanceCache();
    },
    getExpenses: async (filter) =>
        (await getActiveService()).getExpenses(filter),
    addExpense: async (expense) => {
        const beforePending = offlineSyncQueue.getPendingSyncCount();
        const res = await withDayLogged(
            [{ memberId: expense.payer_id, date: expense.date }],
            "expense",
            async () =>
                offlineSyncQueue.isReplaying()
                    ? (await getActiveService()).addExpense(expense)
                    : offlineSyncQueue.addExpense(expense),
        );
        const queuedOffline =
            offlineSyncQueue.getPendingSyncCount() > beforePending;
        if (!queuedOffline) {
            invalidateFinanceCache();
        }
        return res;
    },
    updateExpense: async (id, updates) => {
        const beforePending = offlineSyncQueue.getPendingSyncCount();
        let res: Expense;
        if (offlineSyncQueue.isReplaying()) {
            res = await (await getActiveService()).updateExpense(id, updates);
        } else {
            res = await offlineSyncQueue.updateExpense(id, updates);
        }
        const queuedOffline =
            offlineSyncQueue.getPendingSyncCount() > beforePending;
        if (!queuedOffline) {
            invalidateFinanceCache();
        }
        return res;
    },
    bulkAddExpenses: async (expenses) => {
        const beforePending = offlineSyncQueue.getPendingSyncCount();
        const res = await withDayLogged(
            expenses.map((e) => ({ memberId: e.payer_id, date: e.date })),
            "expense",
            async () =>
                offlineSyncQueue.isReplaying()
                    ? (await getActiveService()).bulkAddExpenses(expenses)
                    : offlineSyncQueue.bulkAddExpenses(expenses),
        );
        const queuedOffline =
            offlineSyncQueue.getPendingSyncCount() > beforePending;
        if (!queuedOffline) {
            invalidateFinanceCache();
        }
        return res;
    },
    deleteExpense: async (id) => {
        const beforePending = offlineSyncQueue.getPendingSyncCount();
        if (offlineSyncQueue.isReplaying()) {
            await (await getActiveService()).deleteExpense(id);
        } else {
            await offlineSyncQueue.deleteExpense(id);
        }
        const queuedOffline =
            offlineSyncQueue.getPendingSyncCount() > beforePending;
        if (!queuedOffline) {
            invalidateFinanceCache();
        }
    },
    settleSharedExpenses: async (m1, m2, expenseIds, record) => {
        await (await getActiveService()).settleSharedExpenses(
            m1,
            m2,
            expenseIds,
            record,
        );
        invalidateFinanceCache();
    },
    getSettleUps: async () => (await getActiveService()).getSettleUps(),
    getGoals: async () => (await getActiveService()).getGoals(),
    getGoal: async (id) => (await getActiveService()).getGoal(id),
    addGoal: async (goal) => {
        const res = await (await getActiveService()).addGoal(goal);
        invalidateFinanceCache();
        return res;
    },
    updateGoal: async (id, updates) => {
        const res = await (await getActiveService()).updateGoal(id, updates);
        invalidateFinanceCache();
        return res;
    },
    getRecurringItems: async () =>
        (await getActiveService()).getRecurringItems(),
    addRecurringItem: async (recurringItem) => {
        const res = await (
            await getActiveService()
        ).addRecurringItem(recurringItem);
        invalidateFinanceCache();
        return res;
    },
    updateRecurringItem: async (id, updates) => {
        const res = await (
            await getActiveService()
        ).updateRecurringItem(id, updates);
        invalidateFinanceCache();
        return res;
    },
    deleteRecurringItem: async (id) => {
        await (await getActiveService()).deleteRecurringItem(id);
        invalidateFinanceCache();
    },
    // Credit Cards
    getCreditCards: async () => (await getActiveService()).getCreditCards(),
    addCreditCard: async (input) => {
        const res = await (await getActiveService()).addCreditCard(input);
        invalidateFinanceCache();
        return res;
    },
    updateCreditCard: async (id, updates) => {
        const res = await (
            await getActiveService()
        ).updateCreditCard(id, updates);
        invalidateFinanceCache();
        return res;
    },
    deleteCreditCard: async (id) => {
        await (await getActiveService()).deleteCreditCard(id);
        invalidateFinanceCache();
    },
    getCreditCardStatements: async (month) =>
        (await getActiveService()).getCreditCardStatements(month),
    upsertCreditCardStatement: async (input) => {
        const res = await (
            await getActiveService()
        ).upsertCreditCardStatement(input);
        invalidateFinanceCache();
        return res;
    },
    // Daily Check-ins
    getDailyCheckins: async (memberId) =>
        (await getActiveService()).getDailyCheckins(memberId),
    recordDailyCheckin: async (memberId, date, type) => {
        const res = await withDayLogged(
            [{ memberId, date }],
            type === "no_spend" ? "no_spend" : "expense",
            async () =>
                offlineSyncQueue.isReplaying()
                    ? (await getActiveService()).recordDailyCheckin(
                          memberId,
                          date,
                          type,
                      )
                    : offlineSyncQueue.recordDailyCheckin(memberId, date, type),
        );
        invalidateFinanceCache();
        return res;
    },
    // Notification Preferences
    getNotificationPreferences: async (memberId) =>
        (await getActiveService()).getNotificationPreferences(memberId),
    updateNotificationPreferences: async (memberId, updates) => {
        const res = await (
            await getActiveService()
        ).updateNotificationPreferences(memberId, updates);
        invalidateFinanceCache();
        return res;
    },
    // Notification Log
    getNotificationLog: async (memberId) =>
        (await getActiveService()).getNotificationLog(memberId),
    claimNotificationSend: async (memberId, ref) =>
        (await getActiveService()).claimNotificationSend(memberId, ref),
    markNotificationsRead: async (memberId, refs) =>
        (await getActiveService()).markNotificationsRead(memberId, refs),
    dismissNotification: async (memberId, ref) =>
        (await getActiveService()).dismissNotification(memberId, ref),
    // Push Subscriptions
    savePushSubscription: async (memberId, subscription) =>
        (await getActiveService()).savePushSubscription(memberId, subscription),
    deletePushSubscription: async (endpoint) =>
        (await getActiveService()).deletePushSubscription(endpoint),
    // Capture Inbox
    getInboxItems: async (status) =>
        (await getActiveService()).getInboxItems(status),
    getInboxSummary: async (memberId) =>
        (await getActiveService()).getInboxSummary(memberId),
    confirmInboxItem: async (itemId, expense) => {
        // The RPC checks in the payer on the purchase date
        const res = await withDayLogged(
            [{ memberId: expense.payer_id, date: expense.date }],
            "inbox",
            async () =>
                offlineSyncQueue.isReplaying()
                    ? (await getActiveService()).confirmInboxItem(
                          itemId,
                          expense,
                      )
                    : offlineSyncQueue.confirmInboxItem(itemId, expense),
        );
        invalidateFinanceCache();
        return res;
    },
    resolveInboxItem: async (itemId, status) => {
        if (offlineSyncQueue.isReplaying()) {
            await (await getActiveService()).resolveInboxItem(itemId, status);
        } else {
            await offlineSyncQueue.resolveInboxItem(itemId, status);
        }
        invalidateInboxCache();
    },
    getMerchantRules: async () =>
        (await getActiveService()).getMerchantRules(),
    upsertMerchantRule: async (rule) => {
        const res = await (await getActiveService()).upsertMerchantRule(rule);
        invalidateInboxCache();
        return res;
    },
    deleteMerchantRule: async (id) => {
        await (await getActiveService()).deleteMerchantRule(id);
        invalidateInboxCache();
    },
    listCaptureTokens: async (memberId) =>
        (await getActiveService()).listCaptureTokens(memberId),
    createCaptureToken: async (label, memberId) => {
        const res = await (await getActiveService()).createCaptureToken(
            label,
            memberId,
        );
        invalidateInboxCache();
        return res;
    },
    revokeCaptureToken: async (id) => {
        await (await getActiveService()).revokeCaptureToken(id);
        invalidateInboxCache();
    },
    // Bonus Log (online only: an atomic RPC plus goal changes is not safe to replay blind)
    getBonusEvents: async () => (await getActiveService()).getBonusEvents(),
    saveBonusEvent: async (input) => {
        const res = await (await getActiveService()).saveBonusEvent(input);
        invalidateFinanceCache();
        return res;
    },
    deleteBonusEvent: async (id) => {
        await (await getActiveService()).deleteBonusEvent(id);
        invalidateFinanceCache();
    },
    getBonusSplitDefault: async (memberId) =>
        (await getActiveService()).getBonusSplitDefault(memberId),
    saveBonusSplitDefault: async (memberId, split) => {
        await (await getActiveService()).saveBonusSplitDefault(memberId, split);
        invalidateFinanceCache();
    },
};

export default financeService;
