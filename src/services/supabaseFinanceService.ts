/**
 * Supabase PostgreSQL Finance Service for Budget Buddy.
 * Directly queries Supabase tables using row-level security and schema mappings.
 */

import type {
  Account,
  AccountSnapshot,
  BaseBudgetProfile,
  BaseProfileAllocation,
  CreateExpenseInput,
  CreateGoalInput,
  Expense,
  ExpenseFilter,
  Household,
  HouseholdMember,
  HouseholdOverview,
  Loan,
  MonthlyBudget,
  MonthlyBudgetCategoryDetail,
  MonthlyBudgetDetail,
  Perspective,
  RecurringPolicy,
  SavingsGoal,
} from '../types/finance';
import { supabase } from './supabaseClient';
import {
  calculateSharedExpenseSettlement,
  calculateGoalPacing,
} from '../lib/financialFormulas';
import { getTodayDateString, addMonths } from '../lib/dateUtils';
import type { FinanceService } from './financeService';

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

export class SupabaseFinanceServiceImpl implements FinanceService {
  private async getHouseholdId(): Promise<string> {
    const client = getClient();
    const { data, error } = await client.from('households').select('id').limit(1).single();
    if (error) throw error;
    return data.id;
  }

  public async getHouseholdOverview(): Promise<HouseholdOverview> {
    const client = getClient();

    // 1. Fetch household
    const { data: householdData, error: hhError } = await client
      .from('households')
      .select('*')
      .limit(1)
      .single();
    if (hhError) throw hhError;
    const household = householdData as Household;

    // 2. Fetch members
    const { data: membersData, error: memError } = await client
      .from('household_members')
      .select('*')
      .eq('household_id', household.id)
      .order('created_at', { ascending: true });
    if (memError) throw memError;
    const members = (membersData || []) as HouseholdMember[];

    // 3. Fetch accounts for total assets
    const { data: accountsData, error: accError } = await client
      .from('accounts')
      .select('*')
      .eq('household_id', household.id);
    if (accError) throw accError;
    const accounts = (accountsData || []) as Account[];
    const totalAssets = Math.round(
      accounts.reduce((sum, a) => sum + Number(a.balance), 0) * 100
    ) / 100;

    // 4. Fetch active loans for liabilities
    const { data: loansData, error: loanError } = await client
      .from('loans')
      .select('*')
      .eq('household_id', household.id)
      .eq('status', 'active');
    if (loanError) throw loanError;
    const loans = (loansData || []) as Loan[];
    const totalLiabilities = Math.round(
      loans.reduce((sum, l) => sum + (Number(l.principal) - Number(l.amount_paid)), 0) * 100
    ) / 100;

    const trueNetWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;

    // 5. Fetch unsettled shared expenses for couple settlement
    const { data: expensesData, error: expError } = await client
      .from('expenses')
      .select('*')
      .eq('household_id', household.id)
      .eq('is_shared', true)
      .eq('settled', false);
    if (expError) throw expError;
    const expenses = (expensesData || []) as Expense[];

    const m1 = members[0];
    const m2 = members[1];
    const settlementSummary = m1 && m2
      ? calculateSharedExpenseSettlement(
          expenses,
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

    // 6. Savings Goals
    const { data: goalsData, error: goalError } = await client
      .from('savings_goals')
      .select('*')
      .eq('household_id', household.id)
      .neq('status', 'achieved');
    if (goalError) throw goalError;
    const activeGoals = (goalsData || []) as SavingsGoal[];

    // 7. Recurring Policies
    const { data: policiesData, error: polError } = await client
      .from('recurring_policies')
      .select('*')
      .eq('household_id', household.id);
    if (polError) throw polError;
    const upcomingBills = (policiesData || []) as RecurringPolicy[];

    return {
      household,
      members,
      totalAssets,
      totalLiabilities,
      trueNetWorth,
      settlementSummary,
      activeGoals,
      upcomingBills,
    };
  }

  public async getAccounts(perspective: Perspective): Promise<Account[]> {
    const client = getClient();
    let query = client.from('accounts').select('*');

    if (perspective !== 'household') {
      const clean = perspective.toLowerCase();
      // Fetch members to find corresponding member ID
      const { data: members } = await client.from('household_members').select('*');
      const targetMember = (members || []).find(
        (m: HouseholdMember) =>
          m.id === perspective ||
          m.display_name.toLowerCase().replace(/\s+/g, '') === clean ||
          (clean === 'yijia' && m.display_name.toLowerCase().includes('yi jia')) ||
          (clean === 'rachel' && m.display_name.toLowerCase().includes('rachel'))
      );

      if (targetMember) {
        query = query.or(`owner_id.eq.${targetMember.id},is_joint.eq.true`);
      }
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Account[];
  }

  public async updateAccountBalance(accountId: string, newBalance: number): Promise<Account> {
    const client = getClient();
    const rounded = Math.round(newBalance * 100) / 100;

    // Update account balance
    const { data, error } = await client
      .from('accounts')
      .update({ balance: rounded, updated_at: new Date().toISOString() })
      .eq('id', accountId)
      .select()
      .single();
    if (error) throw error;

    const updatedAccount = data as Account;

    // Create snapshot
    await client.from('account_snapshots').insert({
      account_id: accountId,
      household_id: updatedAccount.household_id,
      balance: rounded,
      snapshot_date: getTodayDateString(),
    });

    return updatedAccount;
  }

  public async getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]> {
    const client = getClient();
    const { data, error } = await client
      .from('account_snapshots')
      .select('*')
      .eq('account_id', accountId)
      .order('snapshot_date', { ascending: true });
    if (error) throw error;
    return (data || []) as AccountSnapshot[];
  }

  public async getBaseProfiles(): Promise<BaseBudgetProfile[]> {
    const client = getClient();
    const { data, error } = await client.from('base_budget_profiles').select('*');
    if (error) throw error;
    return (data || []) as BaseBudgetProfile[];
  }

  public async updateBaseProfile(
    profile: BaseBudgetProfile,
    allocations: BaseProfileAllocation[]
  ): Promise<void> {
    const client = getClient();
    const { error: profError } = await client
      .from('base_budget_profiles')
      .upsert({ ...profile, updated_at: new Date().toISOString() });
    if (profError) throw profError;

    // Delete existing allocations for this profile
    const { error: delError } = await client
      .from('base_profile_allocations')
      .delete()
      .eq('profile_id', profile.id);
    if (delError) throw delError;

    // Insert new allocations
    if (allocations.length > 0) {
      const { error: insError } = await client
        .from('base_profile_allocations')
        .insert(allocations);
      if (insError) throw insError;
    }
  }

  public async getMonthlyBudget(month: string, memberId?: string): Promise<MonthlyBudgetDetail> {
    const client = getClient();
    let query = client.from('monthly_budgets').select('*').eq('month', month);
    if (memberId) {
      query = query.eq('owner_id', memberId);
    }

    const { data: budgetData, error: budgetError } = await query.limit(1).maybeSingle();
    if (budgetError) throw budgetError;

    if (!budgetData) {
      throw new Error(`Monthly budget not found for month ${month}`);
    }
    const budget = budgetData as MonthlyBudget;

    // Fetch budget category allocations
    const { data: catAllocData, error: catAllocError } = await client
      .from('monthly_budget_categories')
      .select('*, categories(*)')
      .eq('monthly_budget_id', budget.id);
    if (catAllocError) throw catAllocError;

    const nextMonth = addMonths(month, 1);
    const { data: expensesData, error: expError } = await client
      .from('expenses')
      .select('*')
      .eq('payer_id', budget.owner_id)
      .gte('date', `${month}-01`)
      .lt('date', `${nextMonth}-01`);
    if (expError) throw expError;

    const expenses = (expensesData || []) as Expense[];

    const categories: MonthlyBudgetCategoryDetail[] = (catAllocData || []).map((row: any) => {
      const actualSpent = expenses
        .filter((e) => e.category_id === row.category_id)
        .reduce((sum, e) => sum + Number(e.amount), 0);
      const roundedSpent = Math.round(actualSpent * 100) / 100;
      const remaining = Math.round((Number(row.allocated_amount) - roundedSpent) * 100) / 100;

      return {
        id: row.id,
        monthly_budget_id: row.monthly_budget_id,
        category_id: row.category_id,
        percentage: Number(row.percentage),
        allocated_amount: Number(row.allocated_amount),
        category: row.categories,
        actualSpent: roundedSpent,
        remaining,
      };
    });

    const totalSpent = Math.round(
      categories.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
    ) / 100;
    const disposablePool = Number(budget.after_deductions);
    const totalRemaining = Math.round((disposablePool - totalSpent) * 100) / 100;

    return {
      budget,
      categories,
      disposablePool,
      totalSpent,
      totalRemaining,
    };
  }

  public async updateMonthlyBudget(
    budgetUpdates: Partial<MonthlyBudget> & { id?: string }
  ): Promise<void> {
    const client = getClient();
    if (!budgetUpdates.id) {
      throw new Error('Monthly budget ID is required for update');
    }

    const { error } = await client
      .from('monthly_budgets')
      .update(budgetUpdates)
      .eq('id', budgetUpdates.id);
    if (error) throw error;
  }

  public async getExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
    const client = getClient();
    let query = client.from('expenses').select('*').order('date', { ascending: false });

    if (filter?.month) {
      const nextMonth = addMonths(filter.month, 1);
      query = query.gte('date', `${filter.month}-01`).lt('date', `${nextMonth}-01`);
    }
    if (filter?.categoryId) {
      query = query.eq('category_id', filter.categoryId);
    }
    if (filter?.payerId) {
      query = query.eq('payer_id', filter.payerId);
    }
    if (filter?.isShared !== undefined) {
      query = query.eq('is_shared', filter.isShared);
    }
    if (filter?.settled !== undefined) {
      query = query.eq('settled', filter.settled);
    }
    if (filter?.search) {
      query = query.ilike('item', `%${filter.search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Expense[];
  }

  public async addExpense(input: CreateExpenseInput): Promise<Expense> {
    const client = getClient();
    const householdId = input.household_id || (await this.getHouseholdId());
    const { data, error } = await client
      .from('expenses')
      .insert({
        payer_id: input.payer_id,
        household_id: householdId,
        category_id: input.category_id || null,
        date: input.date,
        item: input.item,
        amount: input.amount,
        remarks: input.remarks || null,
        is_shared: input.is_shared,
        split_ratio: input.split_ratio ?? 0.50,
        settled: false,
      })
      .select()
      .single();
    if (error) throw error;
    return data as Expense;
  }

  public async deleteExpense(id: string): Promise<void> {
    const client = getClient();
    const { error } = await client.from('expenses').delete().eq('id', id);
    if (error) throw error;
  }

  public async settleSharedExpenses(member1Id: string, member2Id: string): Promise<void> {
    const client = getClient();
    const { error } = await client
      .from('expenses')
      .update({ settled: true })
      .eq('is_shared', true)
      .eq('settled', false)
      .or(`payer_id.eq.${member1Id},payer_id.eq.${member2Id}`);
    if (error) throw error;
  }

  public async getLoans(): Promise<Loan[]> {
    const client = getClient();
    const { data, error } = await client.from('loans').select('*');
    if (error) throw error;
    return (data || []) as Loan[];
  }

  public async getGoals(): Promise<SavingsGoal[]> {
    const client = getClient();
    const { data, error } = await client.from('savings_goals').select('*');
    if (error) throw error;
    return (data || []) as SavingsGoal[];
  }

  public async addGoal(input: CreateGoalInput): Promise<SavingsGoal> {
    const client = getClient();
    const savedSoFar = input.saved_so_far ?? 0;
    const monthlyContribution = input.monthly_contribution ?? 0;
    const pacing = calculateGoalPacing(
      input.target_amount,
      savedSoFar,
      input.target_date,
      monthlyContribution
    );

    const householdId = input.household_id || (await this.getHouseholdId());
    const { data, error } = await client
      .from('savings_goals')
      .insert({
        household_id: householdId,
        owner_id: input.owner_id || null,
        title: input.title,
        target_amount: input.target_amount,
        saved_so_far: savedSoFar,
        target_date: input.target_date,
        monthly_contribution: monthlyContribution,
        emoji: input.emoji || '🎯',
        status: pacing.status,
      })
      .select()
      .single();
    if (error) throw error;
    return data as SavingsGoal;
  }

  public async updateGoal(id: string, updates: Partial<SavingsGoal>): Promise<SavingsGoal> {
    const client = getClient();
    // Fetch existing goal to recalculate pacing if amounts/dates change
    const { data: existing, error: fetchError } = await client
      .from('savings_goals')
      .select('*')
      .eq('id', id)
      .single();
    if (fetchError) throw fetchError;

    const merged = { ...existing, ...updates };
    const pacing = calculateGoalPacing(
      merged.target_amount,
      merged.saved_so_far,
      merged.target_date,
      merged.monthly_contribution
    );

    const { data, error } = await client
      .from('savings_goals')
      .update({ ...updates, status: pacing.status })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as SavingsGoal;
  }

  public async getPolicies(): Promise<RecurringPolicy[]> {
    const client = getClient();
    const { data, error } = await client.from('recurring_policies').select('*');
    if (error) throw error;
    return (data || []) as RecurringPolicy[];
  }
}

export const supabaseFinanceService = new SupabaseFinanceServiceImpl();
