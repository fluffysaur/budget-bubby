/**
 * Supabase PostgreSQL Finance Service for Budget Buddy.
 * Directly queries Supabase tables using row-level security and schema mappings.
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
  UpdateExpenseInput,
  CreditCard,
  CreateCreditCardInput,
  CreditCardStatement,
  UpsertCreditCardStatementInput,
  DailyCheckin,
  CheckinType,
  StreakSummary,
} from '../types/finance';
import { supabase } from './supabaseClient';
import {
  calculateSharedExpenseSettlement,
  calculateGoalPacing,
  calculateCPFAndNetPay,
  getMemberExpenseShare,
  isSpendableCategory,
} from '../lib/financialFormulas';
import { getTodayDateString, addMonths, formatISODate } from '../lib/dateUtils';
import { isValidUuid } from '../lib/uuid';
import type { FinanceService } from './financeService';

export const PRESET_DEFAULT_CATEGORIES = [
  { name: 'Food', color: '#F59E0B', icon: 'utensils', group: 'spendable' as const },
  { name: 'Lifestyle', color: '#EC4899', icon: 'sparkles', group: 'spendable' as const },
  { name: 'Transport', color: '#3B82F6', icon: 'car', group: 'spendable' as const },
  { name: 'Investments', color: '#10B981', icon: 'trending-up', group: 'allocation' as const },
  { name: 'Savings', color: '#6366F1', icon: 'piggy-bank', group: 'allocation' as const },
  { name: 'Tithing', color: '#8B5CF6', icon: 'heart', group: 'allocation' as const },
  { name: 'Buffer', color: '#64748B', icon: 'shield', group: 'spendable' as const },
];

function getClient() {
  if (!supabase) {
    throw new Error('Supabase client is not configured');
  }
  return supabase;
}

export class SupabaseFinanceServiceImpl implements FinanceService {
  private async getHouseholdId(): Promise<string> {
    const client = getClient();
    const { data, error } = await client.from('households').select('id').limit(1).maybeSingle();
    if (error) throw error;
    if (data?.id) return data.id;

    // Fallback 1: Check household_members to find household_id
    const { data: memberData } = await client.from('household_members').select('household_id').limit(1).maybeSingle();
    if (memberData?.household_id) return memberData.household_id;

    // Fallback 2: Check if authenticated user needs their profile claimed
    let currentUserEmail = 'unknown';
    try {
      const { data: authData } = await client.auth.getUser();
      if (authData?.user?.email) {
        currentUserEmail = authData.user.email;
        await client.rpc('claim_household_member_profile', { user_email: authData.user.email });

        // Retry after claiming
        const { data: retryHh } = await client.from('households').select('id').limit(1).maybeSingle();
        if (retryHh?.id) return retryHh.id;

        const { data: retryMem } = await client.from('household_members').select('household_id').limit(1).maybeSingle();
        if (retryMem?.household_id) return retryMem.household_id;
      }
    } catch (claimErr) {
      console.warn('Auto-claim fallback in getHouseholdId encountered:', claimErr);
    }

    throw new Error(
      `No accessible household found for authenticated user (${currentUserEmail}). Please ensure your user account is linked to a household member profile in the 'household_members' table.`
    );
  }

  public async getHouseholdOverview(): Promise<HouseholdOverview> {
    const client = getClient();

    // 1. Fetch household
    const { data: householdData, error: hhError } = await client
      .from('households')
      .select('*')
      .limit(1)
      .maybeSingle();
    if (hhError) throw hhError;
    
    let household = householdData as Household;
    if (!household) {
      // Create or fallback
      household = {
        id: '00000000-0000-0000-0000-000000000001',
        name: 'Household',
        currency: 'SGD',
        created_at: new Date().toISOString(),
      };
    }

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

  public async createAccount(input: CreateAccountInput): Promise<Account> {
    const client = getClient();
    const householdId = isValidUuid(input.household_id)
      ? input.household_id
      : await this.getHouseholdId();
    const balance = Math.round(input.balance * 100) / 100;

    const { data, error } = await client
      .from('accounts')
      .insert({
        household_id: householdId,
        owner_id: input.owner_id,
        name: input.name,
        type: input.type,
        balance,
        currency: input.currency || 'SGD',
        institution: input.institution || null,
        is_joint: input.is_joint || false,
        notes: input.notes || null,
      })
      .select()
      .single();

    if (error) throw error;
    const createdAccount = data as Account;

    // Record initial snapshot
    await client.from('account_snapshots').insert({
      account_id: createdAccount.id,
      household_id: householdId,
      balance,
      snapshot_date: getTodayDateString(),
    });

    return createdAccount;
  }

  public async updateAccount(id: string, updates: UpdateAccountInput): Promise<Account> {
    const client = getClient();
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.name !== undefined) payload.name = updates.name;
    if (updates.type !== undefined) payload.type = updates.type;
    if (updates.institution !== undefined) payload.institution = updates.institution;
    if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id;
    if (updates.is_joint !== undefined) payload.is_joint = updates.is_joint;
    if (updates.notes !== undefined) payload.notes = updates.notes;

    const { data, error } = await client
      .from('accounts')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data as Account;
  }

  public async deleteAccount(id: string): Promise<void> {
    const client = getClient();
    const { error } = await client.from('accounts').delete().eq('id', id);
    if (error) throw error;
  }

  public async updateAccountBalance(
    accountId: string,
    newBalance: number,
    notes?: string,
    date?: string
  ): Promise<Account> {
    const client = getClient();
    const rounded = Math.round(newBalance * 100) / 100;

    const updates: Record<string, unknown> = { balance: rounded, updated_at: new Date().toISOString() };
    if (notes !== undefined) {
      updates.notes = notes || null;
    }

    // Update account balance
    const { data, error } = await client
      .from('accounts')
      .update(updates)
      .eq('id', accountId)
      .select()
      .single();
    if (error) throw error;

    const updatedAccount = data as Account;

    // Create snapshot
    const { error: snapError } = await client.from('account_snapshots').insert({
      account_id: accountId,
      household_id: updatedAccount.household_id,
      balance: rounded,
      snapshot_date: date || getTodayDateString(),
    });
    if (snapError) {
      console.warn('Failed to insert account snapshot:', snapError);
    }

    return updatedAccount;
  }

  public async bulkUpdateAccountBalances(
    updates: BulkBalanceUpdateItem[],
    snapshotDate: string
  ): Promise<Account[]> {
    const snapDate = snapshotDate || getTodayDateString();
    const results: Account[] = [];
    for (const item of updates) {
      const updated = await this.updateAccountBalance(
        item.accountId,
        item.balance,
        item.notes ?? undefined,
        snapDate
      );
      results.push(updated);
    }
    return results;
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

  public async getAllAccountSnapshots(perspective?: Perspective): Promise<AccountSnapshot[]> {
    const client = getClient();
    const { data, error } = await client
      .from('account_snapshots')
      .select('*')
      .order('snapshot_date', { ascending: true });
    if (error) throw error;
    const allSnaps = (data || []) as AccountSnapshot[];

    if (!perspective || perspective === 'household') {
      return allSnaps;
    }

    const visibleAccounts = await this.getAccounts(perspective);
    const visibleIds = new Set(visibleAccounts.map((a) => a.id));
    return allSnaps.filter((s) => visibleIds.has(s.account_id));
  }

  public async getBaseProfiles(): Promise<BaseBudgetProfile[]> {
    const client = getClient();
    const { data, error } = await client.from('base_budget_profiles').select('*');
    if (error) throw error;
    return (data || []) as BaseBudgetProfile[];
  }

  public async getBaseAllocations(profileId?: string): Promise<BaseProfileAllocation[]> {
    const client = getClient();
    let query = client.from('base_profile_allocations').select('*');
    if (profileId) {
      query = query.eq('profile_id', profileId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as BaseProfileAllocation[];
  }

  public async getCategories(): Promise<Category[]> {
    const client = getClient();
    const { data, error } = await client.from('categories').select('*');
    if (error) throw error;
    const cats = (data || []) as Category[];
    if (cats.length > 0) {
      return cats.map((row) => ({
        ...row,
        group: row.group || (isSpendableCategory(row.name) ? 'spendable' : 'allocation'),
      }));
    }

    // Auto-seed recommended default categories if household has no categories in Supabase
    try {
      const householdId = await this.getHouseholdId();
      return await this.seedDefaultCategories(householdId);
    } catch (seedErr) {
      console.warn('Auto-seed default categories encountered:', seedErr);
      return [];
    }
  }

  public async seedDefaultCategories(explicitHouseholdId?: string): Promise<Category[]> {
    const client = getClient();
    const householdId = explicitHouseholdId || (await this.getHouseholdId());

    const rowsToInsert = PRESET_DEFAULT_CATEGORIES.map((preset) => ({
      household_id: householdId,
      name: preset.name,
      color: preset.color,
      icon: preset.icon,
      is_system: false,
    }));

    const { data, error } = await client
      .from('categories')
      .upsert(rowsToInsert, { onConflict: 'household_id,name' })
      .select();

    if (error) throw error;
    return ((data || []) as Category[]).map((row) => ({
      ...row,
      group: row.group || (isSpendableCategory(row.name) ? 'spendable' : 'allocation'),
    }));
  }

  public async addCategory(input: CreateCategoryInput): Promise<Category> {
    const client = getClient();
    const householdId = isValidUuid(input.household_id)
      ? input.household_id
      : await this.getHouseholdId();

    const insertPayload: Record<string, unknown> = {
      household_id: householdId,
      name: input.name.trim(),
      color: input.color || '#64748B',
      icon: input.icon || 'tag',
      is_system: input.is_system || false,
    };

    const { data, error } = await client
      .from('categories')
      .insert(insertPayload)
      .select()
      .single();

    if (error) throw error;
    const row = data as Category;
    return {
      ...row,
      group: input.group || (isSpendableCategory(row.name) ? 'spendable' : 'allocation'),
    };
  }

  public async updateCategory(id: string, updates: UpdateCategoryInput): Promise<Category> {
    const client = getClient();
    const payload: Record<string, unknown> = {};
    if (updates.name !== undefined) payload.name = updates.name.trim();
    if (updates.color !== undefined) payload.color = updates.color;
    if (updates.icon !== undefined) payload.icon = updates.icon;

    const { data, error } = await client
      .from('categories')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    const row = data as Category;
    return {
      ...row,
      group: updates.group || (isSpendableCategory(row.name) ? 'spendable' : 'allocation'),
    };
  }

  public async deleteCategory(id: string): Promise<void> {
    const client = getClient();
    const { error } = await client
      .from('categories')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  public async updateBaseProfile(
    profile: BaseBudgetProfile,
    allocations: BaseProfileAllocation[]
  ): Promise<void> {
    const client = getClient();

    // 1. Resolve household_id safely (prevent invalid syntax for type uuid like "hh-00000000-0001")
    let householdId = profile.household_id;
    if (!isValidUuid(householdId)) {
      householdId = await this.getHouseholdId();
    }

    // 2. Resolve owner_id safely
    let ownerId = profile.owner_id;
    if (!isValidUuid(ownerId)) {
      const { data: members } = await client
        .from('household_members')
        .select('id, display_name')
        .eq('household_id', householdId);

      const matched = (members || []).find(
        (m) =>
          m.id === ownerId ||
          (ownerId.toLowerCase().includes('yijia') && m.display_name.toLowerCase().includes('yi jia')) ||
          (ownerId.toLowerCase().includes('rachel') && m.display_name.toLowerCase().includes('rachel'))
      );
      if (matched) {
        ownerId = matched.id;
      } else if (members && members.length > 0) {
        ownerId = members[0].id;
      } else {
        throw new Error('No valid household member found to associate with base profile');
      }
    }

    // 3. Resolve profile.id: reuse existing row ID for (household_id, owner_id) if one exists
    const { data: existingProf } = await client
      .from('base_budget_profiles')
      .select('id')
      .eq('household_id', householdId)
      .eq('owner_id', ownerId)
      .maybeSingle();

    let profileId: string | undefined;
    if (existingProf?.id) {
      profileId = existingProf.id;
    } else if (isValidUuid(profile.id)) {
      profileId = profile.id;
    } else if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      profileId = crypto.randomUUID();
    }

    const profileUpsertPayload: Record<string, unknown> = {
      household_id: householdId,
      owner_id: ownerId,
      gross_salary: Number(profile.gross_salary) || 0,
      cpf_employee_rate: Number(profile.cpf_employee_rate) || 0.20,
      tithing_enabled: profile.tithing_enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    if (profileId) {
      profileUpsertPayload.id = profileId;
    }

    const { data: savedProfile, error: profError } = await client
      .from('base_budget_profiles')
      .upsert(profileUpsertPayload, { onConflict: 'household_id,owner_id' })
      .select('id')
      .single();
    if (profError) throw profError;

    const finalProfileId = savedProfile?.id || profileId;
    if (!finalProfileId) {
      throw new Error('Failed to resolve base budget profile ID');
    }

    // 4. Delete existing allocations for this profile
    const { error: delError } = await client
      .from('base_profile_allocations')
      .delete()
      .eq('profile_id', finalProfileId);
    if (delError) throw delError;

    // 5. Insert new allocations with sanitized UUIDs
    if (allocations.length > 0) {
      const categories = await this.getCategories();

      const sanitizedAllocations = allocations.map((alloc) => {
        let catId = alloc.category_id;
        if (!isValidUuid(catId)) {
          const matched = categories.find(
            (c) => c.id === catId || c.name.toLowerCase() === catId.toLowerCase()
          );
          catId = matched?.id || categories[0]?.id || catId;
        }

        const allocRow: Record<string, unknown> = {
          profile_id: finalProfileId,
          category_id: catId,
          target_percentage: Number(alloc.target_percentage) || 0,
        };

        if (isValidUuid(alloc.id)) {
          allocRow.id = alloc.id;
        } else if (typeof crypto !== 'undefined' && crypto.randomUUID) {
          allocRow.id = crypto.randomUUID();
        }

        return allocRow;
      });

      const { error: insError } = await client
        .from('base_profile_allocations')
        .insert(sanitizedAllocations);
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

    type CategoryAllocRow = {
      id: string;
      monthly_budget_id: string;
      category_id: string;
      percentage: number;
      allocated_amount: number;
      categories?: Category;
    };

    let budget: MonthlyBudget;
    let catAllocData: CategoryAllocRow[];

    if (budgetData) {
      budget = budgetData as MonthlyBudget;
      const { data: allocRows, error: catAllocError } = await client
        .from('monthly_budget_categories')
        .select('*, categories(*)')
        .eq('monthly_budget_id', budget.id);
      if (catAllocError) throw catAllocError;
      catAllocData = (allocRows as unknown as CategoryAllocRow[]) || [];
    } else {
      // Synthesize budget from base_budget_profiles + base_profile_allocations for new months
      const [profs, allCats, policies] = await Promise.all([
        this.getBaseProfiles(),
        this.getCategories(),
        this.getPolicies(),
      ]);
      const baseProfile =
        profs.find((p) => !memberId || p.owner_id === memberId) || profs[0];
      const ownerId = memberId || baseProfile?.owner_id || '';
      const gross = baseProfile ? Number(baseProfile.gross_salary) : 5000;
      const rate = baseProfile ? Number(baseProfile.cpf_employee_rate) : 0.2;
      const cpf = calculateCPFAndNetPay(gross, rate).cpfDeduction;

      const memberPolicies = policies.filter((p) => p.owner_id === ownerId);
      const taxesDeduction = Math.round(
        memberPolicies
          .filter((p) => p.type === 'tax')
          .reduce((s, p) => s + Number(p.monthly_amortized_amount || 0), 0) * 100
      ) / 100;
      const insuranceDeduction = Math.round(
        memberPolicies
          .filter((p) => p.type === 'insurance')
          .reduce((s, p) => s + Number(p.monthly_amortized_amount || 0), 0) * 100
      ) / 100;
      const afterDeductions = Math.round(
        (gross - cpf - taxesDeduction - insuranceDeduction) * 100
      ) / 100;

      budget = {
        id: `mb-dyn-${month}-${ownerId}`,
        household_id: baseProfile?.household_id || '',
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
      };

      const baseAllocs = baseProfile
        ? await this.getBaseAllocations(baseProfile.id)
        : [];
      catAllocData = baseAllocs.map((alloc, idx) => ({
        id: `mbc-${budget.id}-${idx}`,
        monthly_budget_id: budget.id,
        category_id: alloc.category_id,
        percentage: Number(alloc.target_percentage),
        allocated_amount:
          Math.round(afterDeductions * Number(alloc.target_percentage) * 100) / 100,
        categories: allCats.find((c) => c.id === alloc.category_id),
      }));
    }

    const nextMonth = addMonths(month, 1);
    const [{ data: expensesData, error: expError }, policies] = await Promise.all([
      client
        .from('expenses')
        .select('*')
        .gte('date', `${month}-01`)
        .lt('date', `${nextMonth}-01`),
      this.getPolicies(),
    ]);
    if (expError) throw expError;

    const expenses = (expensesData || []) as Expense[];
    const subscriptionItems = (policies || []).filter(
      (p) =>
        p.type === 'subscription' &&
        (p.owner_id === budget.owner_id || p.owner_id === 'joint')
    );
    const totalSubscriptionMonthly = Math.round(
      subscriptionItems.reduce(
        (sum, p) => sum + Number(p.monthly_amortized_amount ?? p.amount ?? 0),
        0
      ) * 100
    ) / 100;

    const categories: MonthlyBudgetCategoryDetail[] = (catAllocData || []).map((row) => {
      const catObj: Category | undefined = row.categories;
      const isLifestyle = Boolean(
        catObj && catObj.name.toLowerCase().includes('lifestyle')
      );

      const expenseShareSum = expenses
        .filter((e) => e.category_id === row.category_id)
        .reduce(
          (sum, e) => sum + getMemberExpenseShare(e, budget.owner_id, 'personal'),
          0
        );

      const subSpent = isLifestyle ? totalSubscriptionMonthly : 0;
      const roundedSpent = Math.round((expenseShareSum + subSpent) * 100) / 100;
      const remaining = Math.round((Number(row.allocated_amount) - roundedSpent) * 100) / 100;

      return {
        id: row.id,
        monthly_budget_id: row.monthly_budget_id,
        category_id: row.category_id,
        percentage: Number(row.percentage),
        allocated_amount: Number(row.allocated_amount),
        category: catObj,
        actualSpent: roundedSpent,
        remaining,
        subscriptionSpent: subSpent,
        subscriptionItems: isLifestyle ? subscriptionItems : undefined,
      };
    });

    const totalSpent = Math.round(
      categories.reduce((sum, c) => sum + (c.actualSpent || 0), 0) * 100
    ) / 100;
    const disposablePool = Number(budget.after_deductions);
    const totalRemaining = Math.round((disposablePool - totalSpent) * 100) / 100;

    const spendableCats = categories.filter((c) => isSpendableCategory(c.category));
    const allocationCats = categories.filter((c) => !isSpendableCategory(c.category));

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
      budget,
      categories,
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
    const client = getClient();
    if (!budgetUpdates.id) {
      throw new Error('Monthly budget ID is required for update');
    }
    // Dynamic synthetic budget IDs (e.g. mb-dyn-*) are not yet persisted in monthly_budgets
    if (!isValidUuid(budgetUpdates.id)) {
      return;
    }

    const { error } = await client
      .from('monthly_budgets')
      .update(budgetUpdates)
      .eq('id', budgetUpdates.id);
    if (error) throw error;
  }

  public async getExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
    const client = getClient();
    const sortBy = filter?.sortBy || 'date';
    const ascending = filter?.sortOrder === 'asc';
    let query = client.from('expenses').select('*');

    if (sortBy === 'amount') {
      query = query.order('amount', { ascending });
    } else {
      query = query.order('date', { ascending });
    }

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
    if (filter?.goalId) {
      query = query.eq('goal_id', filter.goalId);
    }
    if (filter?.tag) {
      query = query.contains('tags', [filter.tag]);
    }
    if (filter?.search) {
      query = query.or(`item.ilike.%${filter.search}%,remarks.ilike.%${filter.search}%`);
    }

    if (filter?.page && filter?.pageSize) {
      const from = (filter.page - 1) * filter.pageSize;
      const to = from + filter.pageSize - 1;
      query = query.range(from, to);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as Expense[];
  }

  public async addExpense(input: CreateExpenseInput): Promise<Expense> {
    const client = getClient();
    const householdId = input.household_id || (await this.getHouseholdId());

    // Safely resolve payer_id if a mock or non-UUID string was supplied
    let resolvedPayerId = input.payer_id;
    if (resolvedPayerId.startsWith('mem-') || resolvedPayerId.length < 32) {
      const { data: members } = await client
        .from('household_members')
        .select('id, display_name');
      const matched = (members || []).find((m) =>
        m.id === resolvedPayerId ||
        (resolvedPayerId.toLowerCase().includes('yijia') && m.display_name.toLowerCase().includes('yi jia')) ||
        (resolvedPayerId.toLowerCase().includes('rachel') && m.display_name.toLowerCase().includes('rachel'))
      );
      if (matched) {
        resolvedPayerId = matched.id;
      } else if (members && members.length > 0) {
        resolvedPayerId = members[0].id;
      }
    }

    // Safely resolve category_id if a mock or non-UUID string was supplied
    let resolvedCategoryId: string | null = input.category_id || null;
    if (resolvedCategoryId && (resolvedCategoryId.startsWith('cat-') || resolvedCategoryId.length < 32)) {
      const { data: categories } = await client
        .from('categories')
        .select('id, name');
      const matchedCat = (categories || []).find((c) => c.id === resolvedCategoryId);
      if (matchedCat) {
        resolvedCategoryId = matchedCat.id;
      } else {
        resolvedCategoryId = categories?.[0]?.id || null;
      }
    }

    const insertPayload: Record<string, unknown> = {
      payer_id: resolvedPayerId,
      household_id: householdId,
      category_id: resolvedCategoryId,
      date: input.date,
      item: input.item,
      amount: input.amount,
      remarks: input.remarks || null,
      is_shared: input.is_shared,
      split_ratio: input.split_ratio ?? 0.50,
      settled: false,
      tags: input.tags || [],
      goal_id: input.goal_id || null,
      original_amount: input.original_amount !== undefined ? input.original_amount : null,
      original_currency: input.original_currency || 'SGD',
      exchange_rate: input.exchange_rate !== undefined ? input.exchange_rate : null,
    };

    const { data, error } = await client
      .from('expenses')
      .insert(insertPayload)
      .select();

    if (error) throw error;

    // Adjust linked goal if goal_id is present
    if (input.goal_id && isValidUuid(input.goal_id)) {
      try {
        const { data: goal } = await client.from('savings_goals').select('saved_so_far').eq('id', input.goal_id).single();
        if (goal) {
          const newSaved = Math.max(0, Math.round(((goal.saved_so_far || 0) - input.amount) * 100) / 100);
          await client.from('savings_goals').update({ saved_so_far: newSaved }).eq('id', input.goal_id);
        }
      } catch (goalErr) {
        console.warn('Failed to adjust goal balance on addExpense:', goalErr);
      }
    }

    // Auto-record daily checkin
    try {
      await this.recordDailyCheckin(resolvedPayerId, input.date, 'expense');
    } catch {
      // Non-fatal
    }

    if (!data || data.length === 0) {
      return {
        id: `exp-${Date.now()}`,
        household_id: householdId,
        payer_id: resolvedPayerId,
        category_id: resolvedCategoryId,
        date: input.date,
        item: input.item,
        amount: input.amount,
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
    }
    return data[0] as Expense;
  }

  public async updateExpense(id: string, updates: UpdateExpenseInput): Promise<Expense> {
    const client = getClient();
    const { data: existing, error: fetchErr } = await client.from('expenses').select('*').eq('id', id).single();
    if (fetchErr) throw fetchErr;

    // Handle goal balance adjustments
    const oldGoalId = existing.goal_id;
    const oldAmount = Number(existing.amount);
    const newGoalId = updates.goal_id !== undefined ? updates.goal_id : oldGoalId;
    const newAmount = updates.amount !== undefined ? updates.amount : oldAmount;

    if (oldGoalId && oldGoalId !== newGoalId && isValidUuid(oldGoalId)) {
      try {
        const { data: g } = await client.from('savings_goals').select('saved_so_far').eq('id', oldGoalId).single();
        if (g) {
          await client.from('savings_goals').update({ saved_so_far: Math.round(((g.saved_so_far || 0) + oldAmount) * 100) / 100 }).eq('id', oldGoalId);
        }
      } catch (err) {
        console.warn('Failed to restore goal balance:', err);
      }
    }

    if (newGoalId && isValidUuid(newGoalId)) {
      try {
        const { data: g } = await client.from('savings_goals').select('saved_so_far').eq('id', newGoalId).single();
        if (g) {
          const diff = (oldGoalId === newGoalId) ? (newAmount - oldAmount) : newAmount;
          await client.from('savings_goals').update({ saved_so_far: Math.max(0, Math.round(((g.saved_so_far || 0) - diff) * 100) / 100) }).eq('id', newGoalId);
        }
      } catch (err) {
        console.warn('Failed to adjust new goal balance:', err);
      }
    }

    const { data, error } = await client.from('expenses').update(updates).eq('id', id).select().single();
    if (error) throw error;
    return data as Expense;
  }

  public async bulkAddExpenses(expenses: CreateExpenseInput[]): Promise<Expense[]> {
    const created: Expense[] = [];
    for (const item of expenses) {
      const exp = await this.addExpense(item);
      created.push(exp);
    }
    return created;
  }

  public async deleteExpense(id: string): Promise<void> {
    const client = getClient();
    try {
      const { data: exp } = await client.from('expenses').select('goal_id, amount').eq('id', id).single();
      if (exp?.goal_id && isValidUuid(exp.goal_id)) {
        const { data: g } = await client.from('savings_goals').select('saved_so_far').eq('id', exp.goal_id).single();
        if (g) {
          await client.from('savings_goals').update({ saved_so_far: Math.round(((g.saved_so_far || 0) + Number(exp.amount)) * 100) / 100 }).eq('id', exp.goal_id);
        }
      }
    } catch {
      // ignore
    }
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

    const householdId = isValidUuid(input.household_id)
      ? input.household_id
      : await this.getHouseholdId();
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

  public async addPolicy(input: CreatePolicyInput): Promise<RecurringPolicy> {
    const client = getClient();
    const householdId = isValidUuid(input.household_id)
      ? input.household_id
      : await this.getHouseholdId();
    const monthlyAmortized =
      input.frequency === 'annually'
        ? Math.round((input.amount / 12) * 100) / 100
        : Math.round(input.amount * 100) / 100;

    const { data, error } = await client
      .from('recurring_policies')
      .insert({
        household_id: householdId,
        owner_id: input.owner_id === 'joint' || !input.owner_id ? null : input.owner_id,
        type: input.type,
        name: input.name,
        amount: input.amount,
        frequency: input.frequency,
        payment_month: input.payment_month ?? null,
        start_date: input.start_date || null,
        end_date: input.end_date || null,
        notes: input.notes || null,
        monthly_amortized_amount: monthlyAmortized,
      })
      .select()
      .single();
    if (error) throw error;
    return data as RecurringPolicy;
  }

  public async updatePolicy(
    id: string,
    updates: Partial<RecurringPolicy>
  ): Promise<RecurringPolicy> {
    const client = getClient();

    const finalUpdates: Partial<RecurringPolicy> = { ...updates };
    if (updates.amount !== undefined || updates.frequency !== undefined) {
      const { data: existing, error: fetchErr } = await client
        .from('recurring_policies')
        .select('*')
        .eq('id', id)
        .single();
      if (fetchErr) throw fetchErr;

      const newAmount = updates.amount !== undefined ? updates.amount : existing.amount;
      const newFrequency =
        updates.frequency !== undefined ? updates.frequency : existing.frequency;
      const monthlyAmortized =
        newFrequency === 'annually'
          ? Math.round((newAmount / 12) * 100) / 100
          : Math.round(newAmount * 100) / 100;

      finalUpdates.monthly_amortized_amount = monthlyAmortized;
    }

    const { data, error } = await client
      .from('recurring_policies')
      .update(finalUpdates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as RecurringPolicy;
  }

  public async deletePolicy(id: string): Promise<void> {
    const client = getClient();
    const { error } = await client.from('recurring_policies').delete().eq('id', id);
    if (error) throw error;
  }

  // Credit Cards
  public async getCreditCards(): Promise<CreditCard[]> {
    const client = getClient();
    const { data, error } = await client.from('credit_cards').select('*').order('created_at', { ascending: true });
    if (error) throw error;
    return (data || []) as CreditCard[];
  }

  public async addCreditCard(input: CreateCreditCardInput): Promise<CreditCard> {
    const client = getClient();
    const householdId = input.household_id || (await this.getHouseholdId());
    const { data, error } = await client
      .from('credit_cards')
      .insert({
        household_id: householdId,
        owner_id: input.owner_id,
        name: input.name,
        bank: input.bank,
        last4: input.last4 || null,
        billing_day: input.billing_day,
        due_day: input.due_day,
        credit_limit: input.credit_limit || null,
        color: input.color || '#059669',
        is_active: true,
      })
      .select()
      .single();
    if (error) throw error;
    return data as CreditCard;
  }

  public async updateCreditCard(id: string, updates: Partial<CreditCard>): Promise<CreditCard> {
    const client = getClient();
    const { data, error } = await client
      .from('credit_cards')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as CreditCard;
  }

  public async deleteCreditCard(id: string): Promise<void> {
    const client = getClient();
    const { error } = await client.from('credit_cards').delete().eq('id', id);
    if (error) throw error;
  }

  public async getCreditCardStatements(month?: string): Promise<CreditCardStatement[]> {
    const client = getClient();
    let query = client.from('credit_card_statements').select('*, card:credit_cards(*)');
    if (month) {
      query = query.eq('month', month);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as CreditCardStatement[];
  }

  public async upsertCreditCardStatement(input: UpsertCreditCardStatementInput): Promise<CreditCardStatement> {
    const client = getClient();
    const householdId = input.household_id || (await this.getHouseholdId());
    const { data, error } = await client
      .from('credit_card_statements')
      .upsert(
        {
          ...(input.id ? { id: input.id } : {}),
          card_id: input.card_id,
          household_id: householdId,
          month: input.month,
          statement_amount: input.statement_amount,
          due_date: input.due_date,
          is_paid: input.is_paid || false,
          paid_at: input.paid_at || null,
          notes: input.notes || null,
        },
        { onConflict: 'card_id,month' }
      )
      .select('*, card:credit_cards(*)')
      .single();
    if (error) throw error;
    return data as CreditCardStatement;
  }

  // Daily Check-ins & Streaks
  public async getDailyCheckins(memberId?: string): Promise<DailyCheckin[]> {
    const client = getClient();
    let query = client.from('daily_checkins').select('*').order('checkin_date', { ascending: false });
    if (memberId) {
      query = query.eq('member_id', memberId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return (data || []) as DailyCheckin[];
  }

  public async recordDailyCheckin(
    memberId: string,
    date: string,
    type: CheckinType
  ): Promise<DailyCheckin> {
    const client = getClient();
    const householdId = await this.getHouseholdId();
    const { data, error } = await client
      .from('daily_checkins')
      .upsert(
        {
          household_id: householdId,
          member_id: memberId,
          checkin_date: date,
          type,
        },
        { onConflict: 'member_id,checkin_date' }
      )
      .select()
      .single();
    if (error) throw error;
    return data as DailyCheckin;
  }

  public async getStreakSummary(memberId?: string): Promise<StreakSummary> {
    const checkins = await this.getDailyCheckins(memberId);
    const today = getTodayDateString();
    const dateSet = new Set(checkins.map((c) => c.checkin_date));
    const checkedInToday = dateSet.has(today);

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

    return {
      currentStreak,
      longestStreak: Math.max(longestStreak, currentStreak),
      checkedInToday,
      lastCheckinDate: checkins[0]?.checkin_date || null,
      coupleStreak: currentStreak,
    };
  }
}

export const supabaseFinanceService = new SupabaseFinanceServiceImpl();
