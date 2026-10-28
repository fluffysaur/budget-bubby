/**
 * Mock Finance Service for Budget Bubby.
 * In-memory state initialized from mockSeedData.ts with localStorage synchronization.
 * Supports full CRUD for accounts, balances, snapshots, monthly budgets, expenses,
 * shared settlements, loans, savings goals, and recurring policies.
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
  CreateGoalInput,
  CreatePolicyInput,
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
  UpdateExpenseInput,
  CreditCard,
  CreateCreditCardInput,
  CreditCardStatement,
  UpsertCreditCardStatementInput,
  DailyCheckin,
  CheckinType,
  StreakSummary,
  NotificationPreferences,
  UpdateNotificationPreferencesInput,
} from '../types/finance';
import {
  mockSeedData,
  mockCategories,
  mockHistoricalAccountSnapshots,
  mockSubscriptionPolicies,
  mockCreditCards,
  mockCreditCardStatements,
  mockDailyCheckins,
  getDefaultNotificationPreferences,
  type MockSeedDataset,
} from '../data/mockSeedData';
import {
  calculateSharedExpenseSettlement,
  calculateGoalPacing,
  calculateCPFAndNetPay,
  getMemberExpenseShare,
  isSpendableCategory,
} from '../lib/financialFormulas';
import { getTodayDateString, formatISODate } from '../lib/dateUtils';
import type { FinanceService } from './financeService';

const STORAGE_KEY = 'budget_buddy_mock_dataset_v1';

function cloneDeep<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

function loadInitialData(): MockSeedDataset {
  let dataset: MockSeedDataset;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) {
        dataset = JSON.parse(stored);
      } else {
        dataset = cloneDeep(mockSeedData);
      }
    } catch {
      dataset = cloneDeep(mockSeedData);
    }
  } else {
    dataset = cloneDeep(mockSeedData);
  }

  // Ensure multi-month historical snapshots and subscription policies are available
  if (!dataset.accountSnapshots || dataset.accountSnapshots.length <= 18) {
    dataset.accountSnapshots = cloneDeep(mockHistoricalAccountSnapshots);
  }
  if (!dataset.recurringPolicies.some((p) => p.type === 'subscription')) {
    dataset.recurringPolicies = [
      ...dataset.recurringPolicies,
      ...cloneDeep(mockSubscriptionPolicies),
    ];
  }

  if (!dataset.creditCards) {
    dataset.creditCards = cloneDeep(mockCreditCards);
  }
  if (!dataset.creditCardStatements) {
    dataset.creditCardStatements = cloneDeep(mockCreditCardStatements);
  }
  if (!dataset.dailyCheckins) {
    dataset.dailyCheckins = cloneDeep(mockDailyCheckins);
  }
  if (!dataset.notificationPreferences) {
    dataset.notificationPreferences = {};
  }

  return dataset;
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
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    this.state = loadInitialData();
    this.persist();
  }

  public resetState(): void {
    this.resetData();
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
      household: cloneDeep(this.state.household),
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

  public async createAccount(input: CreateAccountInput): Promise<Account> {
    const householdId = input.household_id || this.state.household.id || 'hh-00000000-0001';
    const newAccount: Account = {
      id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      household_id: householdId,
      owner_id: input.owner_id,
      name: input.name,
      type: input.type,
      balance: Math.round(input.balance * 100) / 100,
      currency: input.currency || 'SGD',
      institution: input.institution || null,
      is_joint: input.is_joint || false,
      notes: input.notes || null,
      updated_at: new Date().toISOString(),
    };

    this.state.accounts.push(newAccount);

    // Create initial snapshot for the new account
    const snapshot: AccountSnapshot = {
      id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      account_id: newAccount.id,
      household_id: householdId,
      balance: newAccount.balance,
      snapshot_date: getTodayDateString(),
    };
    this.state.accountSnapshots.push(snapshot);

    this.persist();
    return cloneDeep(newAccount);
  }

  public async updateAccount(id: string, updates: UpdateAccountInput): Promise<Account> {
    const account = this.state.accounts.find((a) => a.id === id);
    if (!account) {
      throw new Error(`Account with id "${id}" not found`);
    }

    if (updates.name !== undefined) account.name = updates.name;
    if (updates.type !== undefined) account.type = updates.type;
    if (updates.institution !== undefined) account.institution = updates.institution;
    if (updates.owner_id !== undefined) account.owner_id = updates.owner_id;
    if (updates.is_joint !== undefined) account.is_joint = updates.is_joint;
    if (updates.notes !== undefined) account.notes = updates.notes;
    account.updated_at = new Date().toISOString();

    this.persist();
    return cloneDeep(account);
  }

  public async deleteAccount(id: string): Promise<void> {
    const idx = this.state.accounts.findIndex((a) => a.id === id);
    if (idx === -1) {
      throw new Error(`Account with id "${id}" not found`);
    }

    this.state.accounts.splice(idx, 1);
    // Cascade delete snapshots
    this.state.accountSnapshots = this.state.accountSnapshots.filter(
      (s) => s.account_id !== id
    );

    this.persist();
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
      account.notes = notes || null;
    }
    account.updated_at = new Date().toISOString();

    const snapDate = date || getTodayDateString();
    const snapMonth = snapDate.slice(0, 7);

    // Upsert snapshot if one already exists on the exact same date, or push new
    const existingIdx = this.state.accountSnapshots.findIndex(
      (s) => s.account_id === accountId && s.snapshot_date === snapDate
    );
    const snapshot: AccountSnapshot = {
      id:
        existingIdx >= 0
          ? this.state.accountSnapshots[existingIdx].id
          : `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      account_id: accountId,
      household_id: account.household_id,
      balance: rounded,
      snapshot_date: snapDate,
    };

    if (existingIdx >= 0) {
      this.state.accountSnapshots[existingIdx] = snapshot;
    } else {
      // Remove any same-month synthetic snapshot if user is recording an explicit snapshot in that month
      this.state.accountSnapshots = this.state.accountSnapshots.filter(
        (s) => !(s.account_id === accountId && s.snapshot_date.startsWith(snapMonth) && s.id.startsWith('snap-acc-'))
      );
      this.state.accountSnapshots.push(snapshot);
    }

    this.persist();
    return cloneDeep(account);
  }

  public async bulkUpdateAccountBalances(
    updates: BulkBalanceUpdateItem[],
    snapshotDate: string
  ): Promise<Account[]> {
    const snapDate = snapshotDate || getTodayDateString();
    const snapMonth = snapDate.slice(0, 7);
    const updatedAccounts: Account[] = [];

    for (const item of updates) {
      const account = this.state.accounts.find((a) => a.id === item.accountId);
      if (!account) continue;

      const rounded = Math.round(Number(item.balance) * 100) / 100;
      account.balance = rounded;
      if (item.notes !== undefined) {
        account.notes = item.notes || null;
      }
      account.updated_at = new Date().toISOString();

      // Remove existing snapshots for this account in the same month so end-of-month snapshot is clean
      this.state.accountSnapshots = this.state.accountSnapshots.filter(
        (s) => !(s.account_id === account.id && s.snapshot_date.startsWith(snapMonth))
      );

      this.state.accountSnapshots.push({
        id: `snap-${Date.now()}-${account.id}-${Math.random().toString(36).slice(2, 6)}`,
        account_id: account.id,
        household_id: account.household_id,
        balance: rounded,
        snapshot_date: snapDate,
      });

      updatedAccounts.push(cloneDeep(account));
    }

    this.persist();
    return updatedAccounts;
  }

  public async getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]> {
    const snapshots = this.state.accountSnapshots
      .filter((s) => s.account_id === accountId)
      .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
    return cloneDeep(snapshots);
  }

  public async getAllAccountSnapshots(perspective?: Perspective): Promise<AccountSnapshot[]> {
    if (!perspective || perspective === 'household') {
      return cloneDeep(
        [...this.state.accountSnapshots].sort((a, b) =>
          a.snapshot_date.localeCompare(b.snapshot_date)
        )
      );
    }

    const visibleAccounts = await this.getAccounts(perspective);
    const visibleIds = new Set(visibleAccounts.map((a) => a.id));
    return cloneDeep(
      this.state.accountSnapshots
        .filter((s) => visibleIds.has(s.account_id))
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
    );
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

  public async addCategory(input: CreateCategoryInput): Promise<Category> {
    const householdId = input.household_id || this.state.household.id || 'hh-00000000-0001';
    const newCategory: Category = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cat-${Date.now()}`,
      household_id: householdId,
      name: input.name.trim(),
      color: input.color || '#64748B',
      icon: input.icon || 'tag',
      is_system: input.is_system || false,
      group: input.group || 'spendable',
    };
    this.state.categories.push(newCategory);
    this.persist();
    return cloneDeep(newCategory);
  }

  public async updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category> {
    const idx = this.state.categories.findIndex((c) => c.id === id);
    if (idx === -1) {
      throw new Error(`Category not found: ${id}`);
    }
    const current = this.state.categories[idx];
    const updated: Category = {
      ...current,
      name: updates.name !== undefined ? updates.name.trim() : current.name,
      color: updates.color !== undefined ? updates.color : current.color,
      icon: updates.icon !== undefined ? updates.icon : current.icon,
      group: updates.group !== undefined ? updates.group : current.group,
    };
    this.state.categories[idx] = updated;
    this.persist();
    return cloneDeep(updated);
  }

  public async deleteCategory(id: string): Promise<void> {
    this.state.categories = this.state.categories.filter((c) => c.id !== id);
    // Remove from allocations
    this.state.baseAllocations = this.state.baseAllocations.filter((a) => a.category_id !== id);
    this.persist();
  }

  public async seedDefaultCategories(): Promise<Category[]> {
    this.state.categories = cloneDeep(mockCategories);
    this.persist();
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

    const baseProfile =
      this.state.baseProfiles.find((p) => !targetOwnerId || p.owner_id === targetOwnerId) ||
      this.state.baseProfiles[0];

    // If budget does not exist for this month, dynamically generate from base profile & recurring policies
    if (!budget) {
      const ownerId = targetOwnerId || this.state.members[0].id;
      const gross = baseProfile ? baseProfile.gross_salary : 5000;
      const rate = baseProfile ? baseProfile.cpf_employee_rate : 0.20;
      const cpf = calculateCPFAndNetPay(gross, rate).cpfDeduction;

      const memberPolicies = this.state.recurringPolicies.filter(
        (p) => p.owner_id === ownerId
      );
      const taxesDeduction = Math.round(
        memberPolicies
          .filter((p) => p.type === 'tax')
          .reduce((s, p) => s + (p.monthly_amortized_amount || 0), 0) * 100
      ) / 100;
      const insuranceDeduction = Math.round(
        memberPolicies
          .filter((p) => p.type === 'insurance')
          .reduce((s, p) => s + (p.monthly_amortized_amount || 0), 0) * 100
      ) / 100;

      const afterDeductions = Math.round(
        (gross - cpf - taxesDeduction - insuranceDeduction) * 100
      ) / 100;

      budget = {
        id: `mb-dyn-${month}-${ownerId}`,
        household_id: this.state.household.id,
        owner_id: ownerId,
        month,
        gross_salary: gross,
        bonus: 0,
        cpf_deduction: cpf,
        taxes_deduction: taxesDeduction,
        insurance_deduction: insuranceDeduction,
        after_deductions: afterDeductions,
        notes: 'Generated monthly budget',
        is_locked: false,
        created_at: new Date().toISOString(),
      };
      this.state.monthlyBudgets.push(budget);
    }

    let budgetCategories = this.state.monthlyBudgetCategories.filter(
      (c) => c.monthly_budget_id === budget!.id
    );

    // Ensure categories are populated from baseAllocations if missing for dynamically generated month
    if (budgetCategories.length === 0 && baseProfile) {
      const profAllocs = this.state.baseAllocations.filter(
        (a) => a.profile_id === baseProfile.id
      );
      const generated = profAllocs.map((alloc, idx) => ({
        id: `mbc-${budget!.id}-${idx}`,
        monthly_budget_id: budget!.id,
        category_id: alloc.category_id,
        percentage: alloc.target_percentage,
        allocated_amount: Math.round(budget!.after_deductions * alloc.target_percentage * 100) / 100,
      }));
      this.state.monthlyBudgetCategories.push(...generated);
      budgetCategories = generated;
    }

    // Active monthly subscriptions for this member
    const subscriptionItems = this.state.recurringPolicies.filter(
      (p) =>
        p.type === 'subscription' &&
        (p.owner_id === budget!.owner_id || p.owner_id === 'joint')
    );
    const totalSubscriptionMonthly = Math.round(
      subscriptionItems.reduce(
        (sum, p) => sum + (p.monthly_amortized_amount ?? p.amount ?? 0),
        0
      ) * 100
    ) / 100;

    // Calculate actual spent per category for this owner and month (including 50% share of shared expenses)
    const categoryDetails: MonthlyBudgetCategoryDetail[] = budgetCategories.map((bc) => {
      const category = this.state.categories.find((cat) => cat.id === bc.category_id);
      const isLifestyle = Boolean(
        category && category.name.toLowerCase().includes('lifestyle')
      );

      // Exclude goal-funded expenses from normal monthly spendable category caps
      const expenseShareSum = this.state.expenses
        .filter((e) => e.category_id === bc.category_id && e.date.startsWith(month) && !e.goal_id)
        .reduce(
          (sum, e) => sum + getMemberExpenseShare(e, budget!.owner_id, 'personal'),
          0
        );

      const subSpent = isLifestyle ? totalSubscriptionMonthly : 0;
      const actualSpent = Math.round((expenseShareSum + subSpent) * 100) / 100;
      const remaining = Math.round((bc.allocated_amount - actualSpent) * 100) / 100;

      return {
        ...cloneDeep(bc),
        category: category ? cloneDeep(category) : undefined,
        actualSpent,
        remaining,
        subscriptionSpent: subSpent,
        subscriptionItems: isLifestyle ? cloneDeep(subscriptionItems) : undefined,
      };
    });

    const totalSpent = Math.round(
      categoryDetails.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
    ) / 100;

    const disposablePool = budget.after_deductions;
    const totalRemaining = Math.round((disposablePool - totalSpent) * 100) / 100;

    // Spendable vs Allocation breakdown
    const spendableCats = categoryDetails.filter((c) => isSpendableCategory(c.category));
    const allocationCats = categoryDetails.filter((c) => !isSpendableCategory(c.category));

    const spendableAllocated = Math.round(
      spendableCats.reduce((sum, c) => sum + c.allocated_amount, 0) * 100
    ) / 100;
    const spendableSpent = Math.round(
      spendableCats.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
    ) / 100;
    const spendableRemaining = Math.round((spendableAllocated - spendableSpent) * 100) / 100;
    const allocationTotal = Math.round(
      allocationCats.reduce((sum, c) => sum + c.allocated_amount, 0) * 100
    ) / 100;

    return {
      budget: cloneDeep(budget),
      categories: categoryDetails,
      disposablePool,
      totalSpent,
      totalRemaining,
      spendableAllocated,
      spendableSpent,
      spendableRemaining,
      allocationTotal,
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
    if (filter?.tag) {
      const tagLower = filter.tag.toLowerCase();
      result = result.filter(
        (e) => e.tags && e.tags.some((t) => t.toLowerCase() === tagLower)
      );
    }
    if (filter?.goalId) {
      result = result.filter((e) => e.goal_id === filter.goalId);
    }
    if (filter?.search) {
      const query = filter.search.toLowerCase();
      result = result.filter(
        (e) =>
          e.item.toLowerCase().includes(query) ||
          (e.remarks && e.remarks.toLowerCase().includes(query)) ||
          (e.tags && e.tags.some((t) => t.toLowerCase().includes(query)))
      );
    }

    // Sorting
    const sortBy = filter?.sortBy || 'date';
    const sortOrder = filter?.sortOrder || 'desc';
    result.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = a.date.localeCompare(b.date);
      } else if (sortBy === 'amount') {
        comparison = a.amount - b.amount;
      } else if (sortBy === 'category') {
        const catA = this.state.categories.find((c) => c.id === a.category_id)?.name || '';
        const catB = this.state.categories.find((c) => c.id === b.category_id)?.name || '';
        comparison = catA.localeCompare(catB);
      } else if (sortBy === 'payer') {
        comparison = a.payer_id.localeCompare(b.payer_id);
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    // Pagination
    if (filter?.page && filter?.pageSize) {
      const start = (filter.page - 1) * filter.pageSize;
      result = result.slice(start, start + filter.pageSize);
    }

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
      tags: input.tags || [],
      goal_id: input.goal_id || null,
      original_amount: input.original_amount !== undefined ? input.original_amount : null,
      original_currency: input.original_currency || 'SGD',
      exchange_rate: input.exchange_rate !== undefined ? input.exchange_rate : null,
      created_at: new Date().toISOString(),
    };

    // Auto-record daily check-in
    await this.recordDailyCheckin(newExpense.payer_id, newExpense.date, 'expense');

    this.state.expenses.unshift(newExpense);
    this.persist();
    return cloneDeep(newExpense);
  }

  public async updateExpense(id: string, updates: UpdateExpenseInput): Promise<Expense> {
    const expense = this.state.expenses.find((e) => e.id === id);
    if (!expense) {
      throw new Error(`Expense with id "${id}" not found`);
    }

    Object.assign(expense, updates);
    this.persist();
    return cloneDeep(expense);
  }

  public async bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]> {
    const created: Expense[] = [];
    for (const input of expenses) {
      const exp = await this.addExpense(input);
      created.push(exp);
    }
    return created;
  }

  public async deleteExpense(id: string): Promise<void> {
    const expense = this.state.expenses.find((e) => e.id === id);
    if (!expense) {
      return;
    }
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

  public async addPolicy(input: CreatePolicyInput): Promise<RecurringPolicy> {
    const monthlyAmortized =
      input.frequency === 'annually'
        ? Math.round((input.amount / 12) * 100) / 100
        : Math.round(input.amount * 100) / 100;

    const newPolicy: RecurringPolicy = {
      id: `pol-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      household_id: input.household_id || this.state.household.id,
      owner_id: input.owner_id,
      type: input.type,
      name: input.name,
      amount: Math.round(input.amount * 100) / 100,
      frequency: input.frequency,
      payment_month: input.payment_month ?? null,
      start_date: input.start_date || null,
      end_date: input.end_date || null,
      notes: input.notes || null,
      monthly_amortized_amount: monthlyAmortized,
    };

    this.state.recurringPolicies.push(newPolicy);
    this.persist();
    return cloneDeep(newPolicy);
  }

  public async updatePolicy(
    id: string,
    updates: Partial<RecurringPolicy>
  ): Promise<RecurringPolicy> {
    const policy = this.state.recurringPolicies.find((p) => p.id === id);
    if (!policy) {
      throw new Error(`Recurring policy with id "${id}" not found`);
    }

    Object.assign(policy, updates);

    // Recompute monthly_amortized_amount if amount or frequency changed
    if (updates.amount !== undefined || updates.frequency !== undefined) {
      policy.monthly_amortized_amount =
        policy.frequency === 'annually'
          ? Math.round((policy.amount / 12) * 100) / 100
          : Math.round(policy.amount * 100) / 100;
    }

    this.persist();
    return cloneDeep(policy);
  }

  public async deletePolicy(id: string): Promise<void> {
    this.state.recurringPolicies = this.state.recurringPolicies.filter((p) => p.id !== id);
    this.persist();
  }

  // Credit Cards
  public async getCreditCards(): Promise<CreditCard[]> {
    return cloneDeep(this.state.creditCards || []);
  }

  public async addCreditCard(input: CreateCreditCardInput): Promise<CreditCard> {
    const newCard: CreditCard = {
      id: `cc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      household_id: input.household_id || this.state.household.id,
      owner_id: input.owner_id,
      name: input.name,
      bank: input.bank,
      last4: input.last4 || null,
      billing_day: input.billing_day,
      due_day: input.due_day,
      credit_limit: input.credit_limit || null,
      color: input.color || '#059669',
      is_active: true,
      created_at: new Date().toISOString(),
    };

    if (!this.state.creditCards) this.state.creditCards = [];
    this.state.creditCards.push(newCard);
    this.persist();
    return cloneDeep(newCard);
  }

  public async updateCreditCard(id: string, updates: Partial<CreditCard>): Promise<CreditCard> {
    const card = this.state.creditCards?.find((c) => c.id === id);
    if (!card) throw new Error(`Credit card with id "${id}" not found`);
    Object.assign(card, updates);
    this.persist();
    return cloneDeep(card);
  }

  public async deleteCreditCard(id: string): Promise<void> {
    if (this.state.creditCards) {
      this.state.creditCards = this.state.creditCards.filter((c) => c.id !== id);
    }
    if (this.state.creditCardStatements) {
      this.state.creditCardStatements = this.state.creditCardStatements.filter((s) => s.card_id !== id);
    }
    this.persist();
  }

  public async getCreditCardStatements(month?: string): Promise<CreditCardStatement[]> {
    let statements = cloneDeep(this.state.creditCardStatements || []);
    if (month) {
      statements = statements.filter((s) => s.month === month);
    }
    for (const stmt of statements) {
      stmt.card = this.state.creditCards?.find((c) => c.id === stmt.card_id);
    }
    return statements;
  }

  public async upsertCreditCardStatement(input: UpsertCreditCardStatementInput): Promise<CreditCardStatement> {
    if (!this.state.creditCardStatements) this.state.creditCardStatements = [];

    const existingIdx = this.state.creditCardStatements.findIndex(
      (s) => s.card_id === input.card_id && s.month === input.month
    );

    let statement: CreditCardStatement;
    if (existingIdx >= 0) {
      statement = this.state.creditCardStatements[existingIdx];
      statement.statement_amount = input.statement_amount;
      statement.due_date = input.due_date;
      if (input.is_paid !== undefined) statement.is_paid = input.is_paid;
      if (input.paid_at !== undefined) statement.paid_at = input.paid_at;
      if (input.notes !== undefined) statement.notes = input.notes;
    } else {
      statement = {
        id: input.id || `ccs-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        card_id: input.card_id,
        household_id: input.household_id || this.state.household.id,
        month: input.month,
        statement_amount: input.statement_amount,
        due_date: input.due_date,
        is_paid: input.is_paid || false,
        paid_at: input.paid_at || null,
        notes: input.notes || null,
      };
      this.state.creditCardStatements.push(statement);
    }

    this.persist();
    statement.card = this.state.creditCards?.find((c) => c.id === statement.card_id);
    return cloneDeep(statement);
  }

  // Daily Check-ins & Streak
  public async getDailyCheckins(memberId?: string): Promise<DailyCheckin[]> {
    let checkins = cloneDeep(this.state.dailyCheckins || []);
    if (memberId) {
      checkins = checkins.filter((c) => c.member_id === memberId);
    }
    checkins.sort((a, b) => b.checkin_date.localeCompare(a.checkin_date));
    return checkins;
  }

  public async recordDailyCheckin(
    memberId: string,
    date: string,
    type: CheckinType
  ): Promise<DailyCheckin> {
    if (!this.state.dailyCheckins) this.state.dailyCheckins = [];

    const existing = this.state.dailyCheckins.find(
      (c) => c.member_id === memberId && c.checkin_date === date
    );

    if (existing) {
      if (type === 'expense') {
        existing.type = 'expense';
      }
      this.persist();
      return cloneDeep(existing);
    }

    const checkin: DailyCheckin = {
      id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      household_id: this.state.household.id,
      member_id: memberId,
      checkin_date: date,
      type,
      created_at: new Date().toISOString(),
    };

    this.state.dailyCheckins.push(checkin);
    this.persist();
    return cloneDeep(checkin);
  }

  public async getStreakSummary(memberId?: string): Promise<StreakSummary> {
    const today = getTodayDateString();
    const allCheckins = await this.getDailyCheckins();
    const targetMemberCheckins = memberId
      ? allCheckins.filter((c) => c.member_id === memberId)
      : allCheckins;

    const dateSet = new Set(targetMemberCheckins.map((c) => c.checkin_date));
    const checkedInToday = dateSet.has(today);

    // Calculate current streak counting backward
    let currentStreak = 0;
    const cursor = new Date(today + 'T12:00:00');
    if (!checkedInToday) {
      cursor.setDate(cursor.getDate() - 1);
    }

    while (true) {
      const iso = formatISODate(cursor);
      if (dateSet.has(iso)) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
      } else {
        break;
      }
    }

    // Longest streak
    const sortedDates = Array.from(dateSet).sort();
    let longestStreak = 0;
    let running = 0;
    let prevDate: Date | null = null;

    for (const dStr of sortedDates) {
      const cur = new Date(dStr + 'T00:00:00');
      if (prevDate) {
        const diffDays = Math.round((cur.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          running++;
        } else if (diffDays > 1) {
          running = 1;
        }
      } else {
        running = 1;
      }
      prevDate = cur;
      if (running > longestStreak) longestStreak = running;
    }

    // Couple streak (days where BOTH partners checked in)
    const m1 = this.state.members[0]?.id;
    const m2 = this.state.members[1]?.id;
    let coupleStreak = 0;
    if (m1 && m2) {
      const m1Dates = new Set(allCheckins.filter((c) => c.member_id === m1).map((c) => c.checkin_date));
      const m2Dates = new Set(allCheckins.filter((c) => c.member_id === m2).map((c) => c.checkin_date));
      const cCursor = new Date(today + 'T12:00:00');
      if (!m1Dates.has(today) || !m2Dates.has(today)) {
        cCursor.setDate(cCursor.getDate() - 1);
      }
      while (true) {
        const iso = formatISODate(cCursor);
        if (m1Dates.has(iso) && m2Dates.has(iso)) {
          coupleStreak++;
          cCursor.setDate(cCursor.getDate() - 1);
        } else {
          break;
        }
      }
    }

    // If viewing household (no memberId specified), set currentStreak to max of both partners' streaks
    let resolvedCurrentStreak = currentStreak;
    if (!memberId && m1 && m2) {
      const m1Dates = new Set(allCheckins.filter((c) => c.member_id === m1).map((c) => c.checkin_date));
      const m2Dates = new Set(allCheckins.filter((c) => c.member_id === m2).map((c) => c.checkin_date));
      const calcMemberStreak = (dates: Set<string>) => {
        let s = 0;
        const cur = new Date(today + 'T12:00:00');
        if (!dates.has(today)) cur.setDate(cur.getDate() - 1);
        while (true) {
          const iso = formatISODate(cur);
          if (dates.has(iso)) {
            s++;
            cur.setDate(cur.getDate() - 1);
          } else break;
        }
        return s;
      };
      resolvedCurrentStreak = Math.max(calcMemberStreak(m1Dates), calcMemberStreak(m2Dates));
    }

    return {
      currentStreak: resolvedCurrentStreak,
      longestStreak: Math.max(longestStreak, resolvedCurrentStreak),
      checkedInToday,
      lastCheckinDate: targetMemberCheckins[0]?.checkin_date || null,
      coupleStreak,
    };
  }

  // Notification Preferences
  public async getNotificationPreferences(memberId: string): Promise<NotificationPreferences> {
    if (!this.state.notificationPreferences) {
      this.state.notificationPreferences = {};
    }
    const cacheKey = `bb_notif_prefs_${memberId}`;
    if (typeof window !== 'undefined' && window.localStorage) {
      const cached = window.localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          this.state.notificationPreferences[memberId] = parsed;
          return cloneDeep(parsed);
        } catch {
          // ignore parsing error
        }
      }
    }
    if (!this.state.notificationPreferences[memberId]) {
      this.state.notificationPreferences[memberId] = getDefaultNotificationPreferences(
        memberId,
        this.state.household.id
      );
      this.persist();
    }
    const prefs = this.state.notificationPreferences[memberId];
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(cacheKey, JSON.stringify(prefs));
    }
    return cloneDeep(prefs);
  }

  public async updateNotificationPreferences(
    memberId: string,
    updates: UpdateNotificationPreferencesInput
  ): Promise<NotificationPreferences> {
    const existing = await this.getNotificationPreferences(memberId);
    const updated: NotificationPreferences = {
      ...existing,
      ...updates,
      updated_at: new Date().toISOString(),
    };
    if (!this.state.notificationPreferences) {
      this.state.notificationPreferences = {};
    }
    this.state.notificationPreferences[memberId] = updated;
    this.persist();

    const cacheKey = `bb_notif_prefs_${memberId}`;
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(cacheKey, JSON.stringify(updated));
      window.dispatchEvent(
        new CustomEvent('notificationPreferencesUpdated', { detail: { memberId, preferences: updated } })
      );
    }
    return cloneDeep(updated);
  }
}

export const mockFinanceService = new MockFinanceServiceImpl();
