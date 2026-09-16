/**
 * Dual-Mode Finance Service Dispatcher for Budget Buddy.
 * Seamlessly switches between Supabase PostgreSQL and In-Memory / LocalStorage Mock.
 */

import type {
  Account,
  AccountSnapshot,
  BaseBudgetProfile,
  BaseProfileAllocation,
  Category,
  CreateExpenseInput,
  CreateGoalInput,
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
  updateAccountBalance(
    accountId: string,
    newBalance: number,
    notes?: string,
    date?: string
  ): Promise<Account>;
  getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]>;
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
}

function getActiveService(): FinanceService {
  return isSupabaseConfigured() ? supabaseFinanceService : mockFinanceService;
}

export const financeService: FinanceService = {
  getHouseholdOverview: () => getActiveService().getHouseholdOverview(),
  getAccounts: (perspective) => getActiveService().getAccounts(perspective),
  updateAccountBalance: (accountId, newBalance, notes, date) =>
    getActiveService().updateAccountBalance(accountId, newBalance, notes, date),
  getAccountSnapshots: (accountId) => getActiveService().getAccountSnapshots(accountId),
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
  updateGoal: (id, updates) => getActiveService().updateGoal(id, updates),
  getPolicies: () => getActiveService().getPolicies(),
};

export default financeService;
