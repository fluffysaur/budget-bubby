/**
 * Mock Finance Service for Budget Buddy.
 * In-memory state initialized from mockSeedData.ts with localStorage synchronization.
 * Supports full CRUD for accounts, balances, snapshots, monthly budgets, expenses,
 * shared settlements, loans, savings goals, and recurring policies.
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
  MonthlyBudgetCategoryDetail,
  MonthlyBudgetDetail,
  Perspective,
  RecurringPolicy,
  SavingsGoal,
} from '../types/finance';
import {
  mockSeedData,
  type MockSeedDataset,
} from '../data/mockSeedData';
import {
  calculateSharedExpenseSettlement,
  calculateGoalPacing,
  calculateCPFAndNetPay,
} from '../lib/financialFormulas';
import { getTodayDateString } from '../lib/dateUtils';
import type { FinanceService } from './financeService';

const STORAGE_KEY = 'budget_buddy_mock_dataset_v1';

function cloneDeep<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function loadInitialData(): MockSeedDataset {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {
      // Fallback to mock seed data if localStorage read fails
    }
  }
  return cloneDeep(mockSeedData);
}

class MockFinanceServiceImpl implements FinanceService {
  private state: MockSeedDataset = loadInitialData();

  private persist() {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
      } catch {
        // Ignore quota / serialization errors in sandbox environments
      }
    }
  }

  /**
   * Resets mock data back to pure initial seed data and updates localStorage.
   */
  public resetData(): void {
    this.state = cloneDeep(mockSeedData);
    this.persist();
  }

  public async getHouseholdOverview(): Promise<HouseholdOverview> {
    const accounts = this.state.accounts;
    const totalAssets = Math.round(
      accounts.reduce((sum, a) => sum + a.balance, 0) * 100
    ) / 100;

    const activeLoans = this.state.loans.filter((l) => l.status === 'active');
    const totalLiabilities = Math.round(
      activeLoans.reduce((sum, l) => sum + (l.principal - l.amount_paid), 0) * 100
    ) / 100;

    const trueNetWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;

    const m1 = this.state.members[0];
    const m2 = this.state.members[1];

    const settlementSummary = m1 && m2
      ? calculateSharedExpenseSettlement(
          this.state.expenses,
          m1.id,
          m2.id,
          m1.display_name,
          m2.display_name
        )
      : {
          netBalance: 0,
          debtorId: null,
          creditorId: null,
          settlementText: 'All settled up',
          member1OwesMember2: 0,
          member2OwesMember1: 0,
        };

    const activeGoals = this.state.savingsGoals.filter((g) => g.status !== 'achieved');

    return {
      household: cloneDeep(this.state.household as any),
      members: cloneDeep(this.state.members),
      totalAssets,
      totalLiabilities,
      trueNetWorth,
      settlementSummary,
      activeGoals: cloneDeep(activeGoals),
      upcomingBills: cloneDeep(this.state.recurringPolicies),
    };
  }

  public async getAccounts(perspective: Perspective): Promise<Account[]> {
    if (perspective === 'household') {
      return cloneDeep(this.state.accounts);
    }

    const clean = perspective.toLowerCase();
    const targetMember = this.state.members.find(
      (m) =>
        m.id === perspective ||
        m.display_name.toLowerCase().replace(/\s+/g, '') === clean ||
        (clean === 'yijia' && m.display_name.toLowerCase().includes('yi jia')) ||
        (clean === 'rachel' && m.display_name.toLowerCase().includes('rachel'))
    );

    if (!targetMember) {
      return cloneDeep(this.state.accounts);
    }

    const filtered = this.state.accounts.filter(
      (a) => a.owner_id === targetMember.id || a.is_joint
    );
    return cloneDeep(filtered);
  }

  public async updateAccountBalance(
    accountId: string,
    newBalance: number,
    notes?: string,
    date?: string
  ): Promise<Account> {
    const account = this.state.accounts.find((a) => a.id === accountId);
    if (!account) {
      throw new Error(`Account with id "${accountId}" not found`);
    }

    const rounded = Math.round(newBalance * 100) / 100;
    account.balance = rounded;
    if (notes !== undefined) {
      account.notes = notes;
    }
    account.updated_at = new Date().toISOString();

    const snapshot: AccountSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      account_id: accountId,
      household_id: account.household_id,
      balance: rounded,
      snapshot_date: date || getTodayDateString(),
    };
    this.state.accountSnapshots.push(snapshot);

    this.persist();
    return cloneDeep(account);
  }

  public async getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]> {
    const snapshots = this.state.accountSnapshots.filter((s) => s.account_id === accountId);
    return cloneDeep(snapshots);
  }

  public async getBaseProfiles(): Promise<BaseBudgetProfile[]> {
    return cloneDeep(this.state.baseProfiles);
  }

  public async getBaseAllocations(profileId?: string): Promise<BaseProfileAllocation[]> {
    if (profileId) {
      return cloneDeep(this.state.baseAllocations.filter((a) => a.profile_id === profileId));
    }
    return cloneDeep(this.state.baseAllocations);
  }

  public async getCategories(): Promise<Category[]> {
    return cloneDeep(this.state.categories);
  }

  public async updateBaseProfile(
    profile: BaseBudgetProfile,
    allocations: BaseProfileAllocation[]
  ): Promise<void> {
    const idx = this.state.baseProfiles.findIndex((p) => p.id === profile.id);
    if (idx >= 0) {
      this.state.baseProfiles[idx] = { ...profile, updated_at: new Date().toISOString() };
    } else {
      this.state.baseProfiles.push({ ...profile, updated_at: new Date().toISOString() });
    }

    // Replace allocations for this profile
    this.state.baseAllocations = this.state.baseAllocations.filter(
      (a) => a.profile_id !== profile.id
    );
    this.state.baseAllocations.push(...cloneDeep(allocations));

    this.persist();
  }

  public async getMonthlyBudget(month: string, memberId?: string): Promise<MonthlyBudgetDetail> {
    let targetOwnerId = memberId;
    if (!targetOwnerId && this.state.members.length > 0) {
      targetOwnerId = this.state.members[0].id;
    }

    let budget = this.state.monthlyBudgets.find(
      (b) => b.month === month && (!targetOwnerId || b.owner_id === targetOwnerId)
    );

    // If budget does not exist for this month, dynamically generate from base profile
    if (!budget) {
      const baseProfile = this.state.baseProfiles.find(
        (p) => !targetOwnerId || p.owner_id === targetOwnerId
      ) || this.state.baseProfiles[0];

      const gross = baseProfile ? baseProfile.gross_salary : 5000;
      const rate = baseProfile ? baseProfile.cpf_employee_rate : 0.20;
      const cpf = calculateCPFAndNetPay(gross, rate).cpfDeduction;
      const afterDeductions = Math.round((gross - cpf) * 100) / 100;

      budget = {
        id: `mb-dyn-${month}-${targetOwnerId || 'gen'}`,
        household_id: this.state.household.id,
        owner_id: targetOwnerId || this.state.members[0].id,
        month,
        gross_salary: gross,
        bonus: 0,
        cpf_deduction: cpf,
        taxes_deduction: 0,
        insurance_deduction: 0,
        after_deductions: afterDeductions,
        notes: 'Generated monthly budget',
        is_locked: false,
        created_at: new Date().toISOString(),
      };
      this.state.monthlyBudgets.push(budget);
    }

    const budgetCategories = this.state.monthlyBudgetCategories.filter(
      (c) => c.monthly_budget_id === budget!.id
    );

    // Calculate actual spent per category for this owner and month
    const categoryDetails: MonthlyBudgetCategoryDetail[] = budgetCategories.map((bc) => {
      const category = this.state.categories.find((cat) => cat.id === bc.category_id);
      const spent = this.state.expenses
        .filter(
          (e) =>
            e.category_id === bc.category_id &&
            e.date.startsWith(month) &&
            e.payer_id === budget!.owner_id
        )
        .reduce((sum, e) => sum + e.amount, 0);

      const actualSpent = Math.round(spent * 100) / 100;
      const remaining = Math.round((bc.allocated_amount - actualSpent) * 100) / 100;

      return {
        ...cloneDeep(bc),
        category: category ? cloneDeep(category) : undefined,
        actualSpent,
        remaining,
      };
    });

    const totalSpent = Math.round(
      categoryDetails.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
    ) / 100;

    const disposablePool = budget.after_deductions;
    const totalRemaining = Math.round((disposablePool - totalSpent) * 100) / 100;

    return {
      budget: cloneDeep(budget),
      categories: categoryDetails,
      disposablePool,
      totalSpent,
      totalRemaining,
    };
  }

  public async updateMonthlyBudget(
    budgetUpdates: Partial<MonthlyBudget> & { id?: string }
  ): Promise<void> {
    const budget = this.state.monthlyBudgets.find((b) => b.id === budgetUpdates.id);
    if (!budget) {
      throw new Error(`Monthly budget with id "${budgetUpdates.id}" not found`);
    }

    Object.assign(budget, budgetUpdates);

    // Recalculate after_deductions if not explicitly provided
    if (budgetUpdates.after_deductions === undefined) {
      budget.after_deductions = Math.round(
        (budget.gross_salary -
          budget.cpf_deduction +
          budget.bonus -
          budget.taxes_deduction -
          budget.insurance_deduction) * 100
      ) / 100;
    }

    this.persist();
  }

  public async getExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
    let result = [...this.state.expenses];

    if (filter?.month) {
      result = result.filter((e) => e.date.startsWith(filter.month!));
    }
    if (filter?.categoryId) {
      result = result.filter((e) => e.category_id === filter.categoryId);
    }
    if (filter?.payerId) {
      result = result.filter((e) => e.payer_id === filter.payerId);
    }
    if (filter?.isShared !== undefined) {
      result = result.filter((e) => e.is_shared === filter.isShared);
    }
    if (filter?.settled !== undefined) {
      result = result.filter((e) => e.settled === filter.settled);
    }
    if (filter?.search) {
      const query = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.item.toLowerCase().includes(query) ||
          (e.remarks && e.remarks.toLowerCase().includes(query))
      );
    }

    // Sort newest first
    result.sort((a, b) => b.date.localeCompare(a.date));
    return cloneDeep(result);
  }

  public async addExpense(input: CreateExpenseInput): Promise<Expense> {
    const newExpense: Expense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      household_id: input.household_id || this.state.household.id,
      payer_id: input.payer_id,
      category_id: input.category_id || null,
      date: input.date,
      item: input.item,
      amount: Math.round(input.amount * 100) / 100,
      remarks: input.remarks || null,
      is_shared: input.is_shared,
      split_ratio: input.split_ratio ?? 0.50,
      settled: false,
      created_at: new Date().toISOString(),
    };

    this.state.expenses.unshift(newExpense);
    this.persist();
    return cloneDeep(newExpense);
  }

  public async deleteExpense(id: string): Promise<void> {
    this.state.expenses = this.state.expenses.filter((e) => e.id !== id);
    this.persist();
  }

  public async settleSharedExpenses(member1Id: string, member2Id: string): Promise<void> {
    for (const exp of this.state.expenses) {
      if (
        exp.is_shared &&
        !exp.settled &&
        (exp.payer_id === member1Id || exp.payer_id === member2Id)
      ) {
        exp.settled = true;
      }
    }
    this.persist();
  }

  public async getLoans(): Promise<Loan[]> {
    return cloneDeep(this.state.loans);
  }

  public async getGoals(): Promise<SavingsGoal[]> {
    return cloneDeep(this.state.savingsGoals);
  }

  public async addGoal(input: CreateGoalInput): Promise<SavingsGoal> {
    const savedSoFar = input.saved_so_far ?? 0;
    const monthlyContribution = input.monthly_contribution ?? 0;
    const pacing = calculateGoalPacing(
      input.target_amount,
      savedSoFar,
      input.target_date,
      monthlyContribution
    );

    const newGoal: SavingsGoal = {
      id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      household_id: input.household_id || this.state.household.id,
      owner_id: input.owner_id || null,
      title: input.title,
      target_amount: Math.round(input.target_amount * 100) / 100,
      saved_so_far: Math.round(savedSoFar * 100) / 100,
      target_date: input.target_date,
      monthly_contribution: Math.round(monthlyContribution * 100) / 100,
      emoji: input.emoji || '🎯',
      status: pacing.status,
      created_at: new Date().toISOString(),
    };

    this.state.savingsGoals.push(newGoal);
    this.persist();
    return cloneDeep(newGoal);
  }

  public async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const goal = this.state.savingsGoals.find((g) => g.id === id);
    if (!goal) {
      throw new Error(`Savings goal with id "${id}" not found`);
    }

    Object.assign(goal, updates);

    // Recalculate status pacing
    const pacing = calculateGoalPacing(
      goal.target_amount,
      goal.saved_so_far,
      goal.target_date,
      goal.monthly_contribution
    );
    goal.status = pacing.status;

    this.persist();
    return cloneDeep(goal);
  }

  public async getPolicies(): Promise<RecurringPolicy[]> {
    return cloneDeep(this.state.recurringPolicies);
  }
}

export const mockFinanceService = new MockFinanceServiceImpl();
