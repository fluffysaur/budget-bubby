import { describe, it, expect } from 'vitest';
import {
  mockHousehold,
  mockMembers,
  mockCategories,
  mockBaseProfiles,
  mockBaseAllocations,
  mockAccounts,
  mockAccountSnapshots,
  mockLoans,
  mockLoanPayments,
  mockSavingsGoals,
  mockRecurringPolicies,
  mockMonthlyBudgets,
  mockMonthlyBudgetCategories,
  mockExpenses,
  mockSeedData,
} from '../src/data/mockSeedData';

describe('mockSeedData', () => {
  it('exports valid household and members', () => {
    expect(mockHousehold.id).toBeDefined();
    expect(mockHousehold.currency).toBe('SGD');
    expect(mockMembers).toHaveLength(2);
    expect(mockMembers.map((m) => m.display_name)).toEqual(['Yi Jia', 'Rachel']);
    expect(mockMembers.map((m) => m.role)).toEqual(['owner', 'member']);
  });

  it('exports all 7 core financial categories', () => {
    expect(mockCategories).toHaveLength(7);
    const categoryNames = mockCategories.map((c) => c.name);
    expect(categoryNames).toContain('Food');
    expect(categoryNames).toContain('Lifestyle');
    expect(categoryNames).toContain('Transport');
    expect(categoryNames).toContain('Investments');
    expect(categoryNames).toContain('Savings');
    expect(categoryNames).toContain('Tithing');
    expect(categoryNames).toContain('Buffer');
  });

  it('allocations for Yi Jia and Rachel sum to 100%', () => {
    const yijiaProfile = mockBaseProfiles.find((p) => p.owner_id === 'mem-00000000-0011');
    const rachelProfile = mockBaseProfiles.find((p) => p.owner_id === 'mem-00000000-0012');

    expect(yijiaProfile).toBeDefined();
    expect(rachelProfile).toBeDefined();

    const yijiaAllocations = mockBaseAllocations.filter((a) => a.profile_id === yijiaProfile!.id);
    const rachelAllocations = mockBaseAllocations.filter((a) => a.profile_id === rachelProfile!.id);

    expect(yijiaAllocations).toHaveLength(7);
    expect(rachelAllocations).toHaveLength(7);

    const yijiaTotalPct = yijiaAllocations.reduce((sum, a) => sum + a.target_percentage, 0);
    const rachelTotalPct = rachelAllocations.reduce((sum, a) => sum + a.target_percentage, 0);

    expect(Math.round(yijiaTotalPct * 100)).toBe(100);
    expect(Math.round(rachelTotalPct * 100)).toBe(100);
  });

  it('contains 13 accounts for Yi Jia and 5 accounts for Rachel', () => {
    const yijiaAccounts = mockAccounts.filter((a) => a.owner_id === 'mem-00000000-0011');
    const rachelAccounts = mockAccounts.filter((a) => a.owner_id === 'mem-00000000-0012');

    expect(yijiaAccounts).toHaveLength(13);
    expect(rachelAccounts).toHaveLength(5);

    const accountTypes = new Set(mockAccounts.map((a) => a.type));
    expect(accountTypes).toContain('Cash');
    expect(accountTypes).toContain('Investment');
    expect(accountTypes).toContain('CPF');
    expect(mockAccountSnapshots).toHaveLength(mockAccounts.length);
  });

  it('contains HDB loan with correct amortization attributes', () => {
    expect(mockLoans).toHaveLength(1);
    const [loan] = mockLoans;
    expect(loan.name).toBe('HDB Loan');
    expect(loan.principal).toBe(500000);
    expect(loan.interest_rate).toBe(0.026);
    expect(loan.monthly_payment).toBe(2665);
    expect(loan.term_months).toBe(242);
    expect(loan.status).toBe('active');
    expect(mockLoanPayments.length).toBeGreaterThanOrEqual(1);
  });

  it('contains 5 shared goals with correct status', () => {
    expect(mockSavingsGoals).toHaveLength(5);
    const goalTitles = mockSavingsGoals.map((g) => g.title);
    expect(goalTitles).toEqual(['Wedding', 'Honeymoon', 'HDB Down Payment', 'Renovation', 'Baby Fund']);

    const wedding = mockSavingsGoals.find((g) => g.title === 'Wedding');
    expect(wedding?.status).toBe('achieved');

    const hdb = mockSavingsGoals.find((g) => g.title === 'HDB Down Payment');
    expect(hdb?.status).toBe('on_track');
  });

  it('contains recurring policies for insurance and taxes', () => {
    expect(mockRecurringPolicies).toHaveLength(4);
    const types = mockRecurringPolicies.map((p) => p.type);
    expect(types).toContain('insurance');
    expect(types).toContain('tax');
  });

  it('ensures referential integrity across mock datasets', () => {
    const memberIds = new Set(mockMembers.map((m) => m.id));
    const categoryIds = new Set(mockCategories.map((c) => c.id));
    const profileIds = new Set(mockBaseProfiles.map((p) => p.id));
    const budgetIds = new Set(mockMonthlyBudgets.map((b) => b.id));

    // Accounts point to valid members
    mockAccounts.forEach((acc) => {
      expect(memberIds.has(acc.owner_id)).toBe(true);
      expect(acc.household_id).toBe(mockHousehold.id);
    });

    // Base profiles point to valid members
    mockBaseProfiles.forEach((prof) => {
      expect(memberIds.has(prof.owner_id)).toBe(true);
      expect(prof.household_id).toBe(mockHousehold.id);
    });

    // Base allocations point to valid profiles & categories
    mockBaseAllocations.forEach((alloc) => {
      expect(profileIds.has(alloc.profile_id)).toBe(true);
      expect(categoryIds.has(alloc.category_id)).toBe(true);
    });

    // Monthly budgets point to valid members
    mockMonthlyBudgets.forEach((mb) => {
      expect(memberIds.has(mb.owner_id)).toBe(true);
      expect(mb.household_id).toBe(mockHousehold.id);
    });

    // Monthly budget categories point to valid budgets & categories
    mockMonthlyBudgetCategories.forEach((mbc) => {
      expect(budgetIds.has(mbc.monthly_budget_id)).toBe(true);
      expect(categoryIds.has(mbc.category_id)).toBe(true);
    });

    // Expenses point to valid payers & categories
    mockExpenses.forEach((exp) => {
      expect(memberIds.has(exp.payer_id)).toBe(true);
      expect(exp.household_id).toBe(mockHousehold.id);
      if (exp.category_id) {
        expect(categoryIds.has(exp.category_id)).toBe(true);
      }
    });

    // Bundled object contains everything
    expect(mockSeedData.household).toBe(mockHousehold);
    expect(mockSeedData.members).toBe(mockMembers);
    expect(mockSeedData.accounts).toBe(mockAccounts);
    expect(mockSeedData.expenses).toBe(mockExpenses);
  });
});
