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
  HouseholdOverview,
  MonthlyBudget,
  MonthlyBudgetDetail,
  Perspective,
  RecurringItem,
  SavingsGoal,
  CreditCard,
  CreateCreditCardInput,
  CreditCardStatement,
  UpsertCreditCardStatementInput,
  DailyCheckin,
  CheckinType,
  StreakSummary,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
  NotificationLogEntry,
  NotificationLogRef,
  PushSubscriptionInput,
  BonusEvent,
  BonusEventsResult,
  BonusSplitShare,
  SaveBonusEventInput,
} from '../types/finance';
import { isSupabaseConfigured } from './supabaseClient';
import { mockFinanceService } from './mockFinanceService';
import { supabaseFinanceService } from './supabaseFinanceService';
import { offlineSyncQueue } from './offlineSyncQueue';
import { queryClient } from '../lib/queryClient';

export interface FinanceService {
  getHouseholdOverview(): Promise<HouseholdOverview>;
  getAccounts(perspective: Perspective): Promise<Account[]>;
  createAccount(input: CreateAccountInput): Promise<Account>;
  updateAccount(id: string, updates: UpdateAccountInput): Promise<Account>;
  deleteAccount(id: string): Promise<void>;
  updateAccountBalance(
    accountId: string,
    newBalance: number,
    notes?: string,
    date?: string
  ): Promise<Account>;
  bulkUpdateAccountBalances(
    updates: BulkBalanceUpdateItem[],
    snapshotDate: string
  ): Promise<Account[]>;
  getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]>;
  getAllAccountSnapshots(perspective?: Perspective): Promise<AccountSnapshot[]>;
  getBaseProfiles(): Promise<BaseBudgetProfile[]>;
  getBaseAllocations(profileId?: string): Promise<BaseProfileAllocation[]>;
  getCategories(): Promise<Category[]>;
  addCategory(input: CreateCategoryInput): Promise<Category>;
  updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category>;
  deleteCategory(id: string): Promise<void>;
  seedDefaultCategories(): Promise<Category[]>;
  updateBaseProfile(
    profile: BaseBudgetProfile,
    allocations: BaseProfileAllocation[]
  ): Promise<void>;
  getMonthlyBudget(month: string, memberId?: string): Promise<MonthlyBudgetDetail>;
  updateMonthlyBudget(budget: Partial<MonthlyBudget> & { id?: string }): Promise<void>;
  getExpenses(filter?: ExpenseFilter): Promise<Expense[]>;
  addExpense(expense: CreateExpenseInput): Promise<Expense>;
  updateExpense(id: string, updates: UpdateExpenseInput): Promise<Expense>;
  bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]>;
  deleteExpense(id: string): Promise<void>;
  settleSharedExpenses(member1Id: string, member2Id: string): Promise<void>;
  getGoals(): Promise<SavingsGoal[]>;
  addGoal(goal: CreateGoalInput): Promise<SavingsGoal>;
  updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal>;
  getRecurringItems(): Promise<RecurringItem[]>;
  addRecurringItem(recurringItem: CreateRecurringItemInput): Promise<RecurringItem>;
  updateRecurringItem(id: string, updates: Partial<RecurringItem>): Promise<RecurringItem>;
  deleteRecurringItem(id: string): Promise<void>;
  // Credit Cards
  getCreditCards(): Promise<CreditCard[]>;
  addCreditCard(input: CreateCreditCardInput): Promise<CreditCard>;
  updateCreditCard(id: string, updates: Partial<CreditCard>): Promise<CreditCard>;
  deleteCreditCard(id: string): Promise<void>;
  getCreditCardStatements(month?: string): Promise<CreditCardStatement[]>;
  upsertCreditCardStatement(input: UpsertCreditCardStatementInput): Promise<CreditCardStatement>;
  // Streaks & Daily Check-ins
  getDailyCheckins(memberId?: string): Promise<DailyCheckin[]>;
  recordDailyCheckin(memberId: string, date: string, type: CheckinType): Promise<DailyCheckin>;
  getStreakSummary(memberId?: string): Promise<StreakSummary>;
  // Notification Preferences
  getNotificationPreferences(memberId: string): Promise<NotificationPreferences>;
  updateNotificationPreferences(
    memberId: string,
    updates: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferences>;
  // Notification Log
  getNotificationLog(memberId: string): Promise<NotificationLogEntry[]>;
  /** Returns true only for the first caller to claim this reminder key. */
  claimNotificationSend(memberId: string, ref: NotificationLogRef): Promise<boolean>;
  markNotificationsRead(memberId: string, refs: NotificationLogRef[]): Promise<void>;
  dismissNotification(memberId: string, ref: NotificationLogRef): Promise<void>;
  // Push Subscriptions (one per device)
  savePushSubscription(memberId: string, subscription: PushSubscriptionInput): Promise<void>;
  deletePushSubscription(endpoint: string): Promise<void>;
  // Bonus Log
  /** `available: false` when the bonus tables are missing (migration not applied). */
  getBonusEvents(): Promise<BonusEventsResult>;
  saveBonusEvent(input: SaveBonusEventInput): Promise<BonusEvent>;
  deleteBonusEvent(id: string): Promise<void>;
  /** The member's saved split, or the seeded default when none or unavailable. */
  getBonusSplitDefault(memberId: string): Promise<BonusSplitShare[]>;
  saveBonusSplitDefault(memberId: string, split: BonusSplitShare[]): Promise<void>;
}

export function isDemoModeActive(): boolean {
  if (typeof window !== 'undefined' && window.sessionStorage) {
    return (
      window.sessionStorage.getItem('budget_bubby_demo_pin') === 'true' ||
      window.sessionStorage.getItem('budget_buddy_demo_pin') === 'true'
    );
  }
  return false;
}

function getActiveService(): FinanceService {
  if (isDemoModeActive()) {
    return mockFinanceService;
  }
  return isSupabaseConfigured() ? supabaseFinanceService : mockFinanceService;
}

function invalidateFinanceCache() {
  try {
    queryClient.invalidateQueries({ queryKey: ['finance'] });
  } catch {
    // In restricted test environments without QueryClient mounted, fail silently
  }
}

export const financeService: FinanceService = {
  getHouseholdOverview: () => getActiveService().getHouseholdOverview(),
  getAccounts: (perspective) => getActiveService().getAccounts(perspective),
  createAccount: async (input) => {
    const res = await getActiveService().createAccount(input);
    invalidateFinanceCache();
    return res;
  },
  updateAccount: async (id, updates) => {
    const res = await getActiveService().updateAccount(id, updates);
    invalidateFinanceCache();
    return res;
  },
  deleteAccount: async (id) => {
    await getActiveService().deleteAccount(id);
    invalidateFinanceCache();
  },
  updateAccountBalance: async (accountId, newBalance, notes, date) => {
    const res = await getActiveService().updateAccountBalance(accountId, newBalance, notes, date);
    invalidateFinanceCache();
    return res;
  },
  bulkUpdateAccountBalances: async (updates, snapshotDate) => {
    const res = await getActiveService().bulkUpdateAccountBalances(updates, snapshotDate);
    invalidateFinanceCache();
    return res;
  },
  getAccountSnapshots: (accountId) => getActiveService().getAccountSnapshots(accountId),
  getAllAccountSnapshots: (perspective) =>
    getActiveService().getAllAccountSnapshots(perspective),
  getBaseProfiles: () => getActiveService().getBaseProfiles(),
  getBaseAllocations: (profileId) => getActiveService().getBaseAllocations(profileId),
  getCategories: () => getActiveService().getCategories(),
  addCategory: async (input) => {
    const res = await getActiveService().addCategory(input);
    invalidateFinanceCache();
    return res;
  },
  updateCategory: async (id, updates) => {
    const res = await getActiveService().updateCategory(id, updates);
    invalidateFinanceCache();
    return res;
  },
  deleteCategory: async (id) => {
    await getActiveService().deleteCategory(id);
    invalidateFinanceCache();
  },
  seedDefaultCategories: async () => {
    const res = await getActiveService().seedDefaultCategories();
    invalidateFinanceCache();
    return res;
  },
  updateBaseProfile: async (profile, allocations) => {
    await getActiveService().updateBaseProfile(profile, allocations);
    invalidateFinanceCache();
  },
  getMonthlyBudget: (month, memberId) =>
    getActiveService().getMonthlyBudget(month, memberId),
  updateMonthlyBudget: async (budget) => {
    await getActiveService().updateMonthlyBudget(budget);
    invalidateFinanceCache();
  },
  getExpenses: async (filter) => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return mockFinanceService.getExpenses(filter);
    }
    try {
      return await getActiveService().getExpenses(filter);
    } catch {
      return mockFinanceService.getExpenses(filter);
    }
  },
  addExpense: async (expense) => {
    let res: Expense;
    if (offlineSyncQueue.isReplaying()) {
      res = await getActiveService().addExpense(expense);
    } else {
      res = await offlineSyncQueue.addExpense(expense);
    }
    invalidateFinanceCache();
    return res;
  },
  updateExpense: async (id, updates) => {
    let res: Expense;
    if (offlineSyncQueue.isReplaying()) {
      res = await getActiveService().updateExpense(id, updates);
    } else {
      res = await offlineSyncQueue.updateExpense(id, updates);
    }
    invalidateFinanceCache();
    return res;
  },
  bulkAddExpenses: async (expenses) => {
    let res: Expense[];
    if (offlineSyncQueue.isReplaying()) {
      res = await getActiveService().bulkAddExpenses(expenses);
    } else {
      res = await offlineSyncQueue.bulkAddExpenses(expenses);
    }
    invalidateFinanceCache();
    return res;
  },
  deleteExpense: async (id) => {
    if (offlineSyncQueue.isReplaying()) {
      await getActiveService().deleteExpense(id);
    } else {
      await offlineSyncQueue.deleteExpense(id);
    }
    invalidateFinanceCache();
  },
  settleSharedExpenses: async (m1, m2) => {
    await getActiveService().settleSharedExpenses(m1, m2);
    invalidateFinanceCache();
  },
  getGoals: () => getActiveService().getGoals(),
  addGoal: async (goal) => {
    const res = await getActiveService().addGoal(goal);
    invalidateFinanceCache();
    return res;
  },
  updateGoal: async (id, updates) => {
    const res = await getActiveService().updateGoal(id, updates);
    invalidateFinanceCache();
    return res;
  },
  getRecurringItems: () => getActiveService().getRecurringItems(),
  addRecurringItem: async (recurringItem) => {
    const res = await getActiveService().addRecurringItem(recurringItem);
    invalidateFinanceCache();
    return res;
  },
  updateRecurringItem: async (id, updates) => {
    const res = await getActiveService().updateRecurringItem(id, updates);
    invalidateFinanceCache();
    return res;
  },
  deleteRecurringItem: async (id) => {
    await getActiveService().deleteRecurringItem(id);
    invalidateFinanceCache();
  },
  // Credit Cards
  getCreditCards: () => getActiveService().getCreditCards(),
  addCreditCard: async (input) => {
    const res = await getActiveService().addCreditCard(input);
    invalidateFinanceCache();
    return res;
  },
  updateCreditCard: async (id, updates) => {
    const res = await getActiveService().updateCreditCard(id, updates);
    invalidateFinanceCache();
    return res;
  },
  deleteCreditCard: async (id) => {
    await getActiveService().deleteCreditCard(id);
    invalidateFinanceCache();
  },
  getCreditCardStatements: (month) => getActiveService().getCreditCardStatements(month),
  upsertCreditCardStatement: async (input) => {
    const res = await getActiveService().upsertCreditCardStatement(input);
    invalidateFinanceCache();
    return res;
  },
  // Streaks & Daily Check-ins
  getDailyCheckins: (memberId) => getActiveService().getDailyCheckins(memberId),
  recordDailyCheckin: async (memberId, date, type) => {
    let res: DailyCheckin;
    if (offlineSyncQueue.isReplaying()) {
      res = await getActiveService().recordDailyCheckin(memberId, date, type);
    } else {
      res = await offlineSyncQueue.recordDailyCheckin(memberId, date, type);
    }
    invalidateFinanceCache();
    return res;
  },
  getStreakSummary: (memberId) => getActiveService().getStreakSummary(memberId),
  // Notification Preferences
  getNotificationPreferences: (memberId) =>
    getActiveService().getNotificationPreferences(memberId),
  updateNotificationPreferences: async (memberId, updates) => {
    const res = await getActiveService().updateNotificationPreferences(memberId, updates);
    invalidateFinanceCache();
    return res;
  },
  // Notification Log
  getNotificationLog: (memberId) => getActiveService().getNotificationLog(memberId),
  claimNotificationSend: (memberId, ref) =>
    getActiveService().claimNotificationSend(memberId, ref),
  markNotificationsRead: (memberId, refs) =>
    getActiveService().markNotificationsRead(memberId, refs),
  dismissNotification: (memberId, ref) => getActiveService().dismissNotification(memberId, ref),
  // Push Subscriptions
  savePushSubscription: (memberId, subscription) =>
    getActiveService().savePushSubscription(memberId, subscription),
  deletePushSubscription: (endpoint) => getActiveService().deletePushSubscription(endpoint),
  // Bonus Log (online only: an atomic RPC plus goal changes is not safe to replay blind)
  getBonusEvents: () => getActiveService().getBonusEvents(),
  saveBonusEvent: async (input) => {
    const res = await getActiveService().saveBonusEvent(input);
    invalidateFinanceCache();
    return res;
  },
  deleteBonusEvent: async (id) => {
    await getActiveService().deleteBonusEvent(id);
    invalidateFinanceCache();
  },
  getBonusSplitDefault: (memberId) => getActiveService().getBonusSplitDefault(memberId),
  saveBonusSplitDefault: async (memberId, split) => {
    await getActiveService().saveBonusSplitDefault(memberId, split);
    invalidateFinanceCache();
  },
};

export default financeService;
