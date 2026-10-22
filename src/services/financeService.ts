/**
 * Dual-Mode Finance Service Dispatcher for Budget Buddy.
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
  CreateExpenseInput,
  CreateGoalInput,
  CreatePolicyInput,
  Expense,
  ExpenseFilter,
  HouseholdOverview,
  Loan,
  MonthlyBudget,
  MonthlyBudgetDetail,
  Perspective,
  RecurringPolicy,
  SavingsGoal,
} from '../types/finance';
import { isSupabaseConfigured } from './supabaseClient';
import { mockFinanceService } from './mockFinanceService';
import { supabaseFinanceService } from './supabaseFinanceService';

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
  updateBaseProfile(
    profile: BaseBudgetProfile,
    allocations: BaseProfileAllocation[]
  ): Promise<void>;
  getMonthlyBudget(month: string, memberId?: string): Promise<MonthlyBudgetDetail>;
  updateMonthlyBudget(budget: Partial<MonthlyBudget> & { id?: string }): Promise<void>;
  getExpenses(filter?: ExpenseFilter): Promise<Expense[]>;
  addExpense(expense: CreateExpenseInput): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
  settleSharedExpenses(member1Id: string, member2Id: string): Promise<void>;
  getLoans(): Promise<Loan[]>;
  getGoals(): Promise<SavingsGoal[]>;
  addGoal(goal: CreateGoalInput): Promise<SavingsGoal>;
  updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal>;
  getPolicies(): Promise<RecurringPolicy[]>;
  addPolicy(policy: CreatePolicyInput): Promise<RecurringPolicy>;
  updatePolicy(id: string, updates: Partial<RecurringPolicy>): Promise<RecurringPolicy>;
  deletePolicy(id: string): Promise<void>;
}

function getActiveService(): FinanceService {
  return isSupabaseConfigured() ? supabaseFinanceService : mockFinanceService;
}

export const financeService: FinanceService = {
  getHouseholdOverview: () => getActiveService().getHouseholdOverview(),
  getAccounts: (perspective) => getActiveService().getAccounts(perspective),
  createAccount: (input) => getActiveService().createAccount(input),
  updateAccount: (id, updates) => getActiveService().updateAccount(id, updates),
  deleteAccount: (id) => getActiveService().deleteAccount(id),
  updateAccountBalance: (accountId, newBalance, notes, date) =>
    getActiveService().updateAccountBalance(accountId, newBalance, notes, date),
  bulkUpdateAccountBalances: (updates, snapshotDate) =>
    getActiveService().bulkUpdateAccountBalances(updates, snapshotDate),
  getAccountSnapshots: (accountId) => getActiveService().getAccountSnapshots(accountId),
  getAllAccountSnapshots: (perspective) =>
    getActiveService().getAllAccountSnapshots(perspective),
  getBaseProfiles: () => getActiveService().getBaseProfiles(),
  getBaseAllocations: (profileId) => getActiveService().getBaseAllocations(profileId),
  getCategories: () => getActiveService().getCategories(),
  updateBaseProfile: (profile, allocations) =>
    getActiveService().updateBaseProfile(profile, allocations),
  getMonthlyBudget: (month, memberId) =>
    getActiveService().getMonthlyBudget(month, memberId),
  updateMonthlyBudget: (budget) => getActiveService().updateMonthlyBudget(budget),
  getExpenses: (filter) => getActiveService().getExpenses(filter),
  addExpense: (expense) => getActiveService().addExpense(expense),
  deleteExpense: (id) => getActiveService().deleteExpense(id),
  settleSharedExpenses: (m1, m2) => getActiveService().settleSharedExpenses(m1, m2),
  getLoans: () => getActiveService().getLoans(),
  getGoals: () => getActiveService().getGoals(),
  addGoal: (goal) => getActiveService().addGoal(goal),
  updateGoal(id, updates) {
    return getActiveService().updateGoal(id, updates);
  },
  getPolicies: () => getActiveService().getPolicies(),
  addPolicy: (policy) => getActiveService().addPolicy(policy),
  updatePolicy: (id, updates) => getActiveService().updatePolicy(id, updates),
  deletePolicy: (id) => getActiveService().deletePolicy(id),
};

export default financeService;
