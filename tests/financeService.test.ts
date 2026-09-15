import { describe, it, expect, beforeEach } from 'vitest';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { financeService } from '../src/services/financeService';
import { isSupabaseConfigured } from '../src/services/supabaseClient';
import { mockAccounts, mockMembers } from '../src/data/mockSeedData';

describe('FinanceService Layer (Dual-Mode & Mock Persistence)', () => {
  beforeEach(() => {
    // Reset in-memory / local storage state before each test
    mockFinanceService.resetData();
  });

  describe('Supabase Client Configuration', () => {
    it('reports isSupabaseConfigured as false when env vars are missing or dummy', () => {
      // In default test environment without VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
      expect(isSupabaseConfigured()).toBe(false);
    });

    it('dispatcher delegates to mockFinanceService when Supabase is not configured', async () => {
      const overview = await financeService.getHouseholdOverview();
      expect(overview).toBeDefined();
      expect(overview.household.name).toBe('Yi Jia & Rachel');
    });
  });

  describe('Accounts & Net Worth Calculation', () => {
    it('fetches all accounts for household perspective', async () => {
      const accounts = await mockFinanceService.getAccounts('household');
      expect(accounts.length).toBe(mockAccounts.length);
      expect(accounts.length).toBeGreaterThan(0);
    });

    it('filters accounts by user perspective including joint accounts', async () => {
      const yijiaAccounts = await mockFinanceService.getAccounts('yijia');
      const rachelAccounts = await mockFinanceService.getAccounts('rachel');

      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const rachelMember = mockMembers.find((m) => m.display_name === 'Rachel')!;

      // Every account in yijia's perspective must belong to yijia or be joint
      for (const acc of yijiaAccounts) {
        expect(acc.owner_id === yijiaMember.id || acc.is_joint).toBe(true);
      }

      // Every account in rachel's perspective must belong to rachel or be joint
      for (const acc of rachelAccounts) {
        expect(acc.owner_id === rachelMember.id || acc.is_joint).toBe(true);
      }
    });

    it('computes accurate household overview with True Net Worth = Total Assets - Total Liabilities', async () => {
      const overview = await mockFinanceService.getHouseholdOverview();
      const accounts = await mockFinanceService.getAccounts('household');
      const loans = await mockFinanceService.getLoans();

      const expectedAssets = Math.round(
        accounts.reduce((sum, a) => sum + a.balance, 0) * 100
      ) / 100;
      const expectedLiabilities = Math.round(
        loans.reduce((sum, l) => sum + (l.principal - l.amount_paid), 0) * 100
      ) / 100;
      const expectedTrueNetWorth = Math.round((expectedAssets - expectedLiabilities) * 100) / 100;

      expect(overview.totalAssets).toBe(expectedAssets);
      expect(overview.totalLiabilities).toBe(expectedLiabilities);
      expect(overview.trueNetWorth).toBe(expectedTrueNetWorth);
      expect(overview.settlementSummary).toBeDefined();
      expect(overview.activeGoals.length).toBeGreaterThan(0);
    });

    it('updates account balance and creates an account snapshot', async () => {
      const accountsBefore = await mockFinanceService.getAccounts('household');
      const targetAccount = accountsBefore[0];
      const newBalance = targetAccount.balance + 500.5;

      const updated = await mockFinanceService.updateAccountBalance(targetAccount.id, newBalance);
      expect(updated.balance).toBe(newBalance);

      // Verify in-memory state updated
      const accountsAfter = await mockFinanceService.getAccounts('household');
      const fetchedUpdated = accountsAfter.find((a) => a.id === targetAccount.id);
      expect(fetchedUpdated?.balance).toBe(newBalance);

      // Verify snapshots include new snapshot
      const snapshots = await mockFinanceService.getAccountSnapshots(targetAccount.id);
      const latestSnapshot = snapshots[snapshots.length - 1];
      expect(latestSnapshot.balance).toBe(newBalance);
      expect(latestSnapshot.account_id).toBe(targetAccount.id);
    });
  });

  describe('Expenses & Couple Shared Settlement', () => {
    it('fetches expenses with optional filter', async () => {
      const allExpenses = await mockFinanceService.getExpenses();
      expect(allExpenses.length).toBeGreaterThan(0);

      const foodExpenses = await mockFinanceService.getExpenses({ categoryId: 'cat-00000000-0101' });
      expect(foodExpenses.length).toBeGreaterThan(0);
      for (const e of foodExpenses) {
        expect(e.category_id).toBe('cat-00000000-0101');
      }
    });

    it('adds a new shared expense and verifies settlement balance updates', async () => {
      const overviewBefore = await mockFinanceService.getHouseholdOverview();

      // Add a 50/50 shared expense paid by Yi Jia ($100 => Rachel owes $50)
      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const created = await mockFinanceService.addExpense({
        payer_id: yijiaMember.id,
        category_id: 'cat-00000000-0101',
        date: '2026-09-15',
        item: 'Weekly Grocery Feast',
        amount: 100.0,
        remarks: 'Test shared expense',
        is_shared: true,
        split_ratio: 0.5,
      });

      expect(created.id).toBeDefined();
      expect(created.amount).toBe(100.0);
      expect(created.settled).toBe(false);

      const overviewAfter = await mockFinanceService.getHouseholdOverview();
      // Member 2 owes member 1 increased by $50
      expect(overviewAfter.settlementSummary.member2OwesMember1).toBe(
        Math.round((overviewBefore.settlementSummary.member2OwesMember1 + 50.0) * 100) / 100
      );
    });

    it('deletes an expense properly', async () => {
      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const created = await mockFinanceService.addExpense({
        payer_id: yijiaMember.id,
        date: '2026-09-15',
        item: 'Temp Expense',
        amount: 30.0,
        is_shared: false,
      });

      const beforeDelete = await mockFinanceService.getExpenses();
      expect(beforeDelete.some((e) => e.id === created.id)).toBe(true);

      await mockFinanceService.deleteExpense(created.id);

      const afterDelete = await mockFinanceService.getExpenses();
      expect(afterDelete.some((e) => e.id === created.id)).toBe(false);
    });

    it('settles shared expenses and resets net settlement balance to 0', async () => {
      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const rachelMember = mockMembers.find((m) => m.display_name === 'Rachel')!;

      // Verify there is an active settlement balance first
      const overviewBefore = await mockFinanceService.getHouseholdOverview();
      expect(overviewBefore.settlementSummary.netBalance).toBeGreaterThan(0);

      // Perform settlement
      await mockFinanceService.settleSharedExpenses(yijiaMember.id, rachelMember.id);

      // Verify settlement
      const overviewAfter = await mockFinanceService.getHouseholdOverview();
      expect(overviewAfter.settlementSummary.netBalance).toBe(0);
      expect(overviewAfter.settlementSummary.settlementText).toBe('All settled up');

      // Verify all shared expenses between them are now settled: true
      const sharedExpenses = await mockFinanceService.getExpenses({ isShared: true });
      for (const exp of sharedExpenses) {
        if (
          (exp.payer_id === yijiaMember.id || exp.payer_id === rachelMember.id)
        ) {
          expect(exp.settled).toBe(true);
        }
      }
    });
  });

  describe('Monthly Budget & Categories', () => {
    it('retrieves monthly budget detail with category breakdowns and actual spent', async () => {
      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const budgetDetail = await mockFinanceService.getMonthlyBudget('2026-09', yijiaMember.id);

      expect(budgetDetail).toBeDefined();
      expect(budgetDetail.budget.month).toBe('2026-09');
      expect(budgetDetail.budget.owner_id).toBe(yijiaMember.id);
      expect(budgetDetail.categories.length).toBeGreaterThan(0);
      expect(budgetDetail.disposablePool).toBe(budgetDetail.budget.after_deductions);
      expect(budgetDetail.totalSpent).toBeGreaterThanOrEqual(0);
    });

    it('updates monthly budget and recalculates after_deductions', async () => {
      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const budgetDetail = await mockFinanceService.getMonthlyBudget('2026-09', yijiaMember.id);

      await mockFinanceService.updateMonthlyBudget({
        id: budgetDetail.budget.id,
        gross_salary: 7000.0,
        bonus: 1000.0,
        cpf_deduction: 1400.0,
        taxes_deduction: 120.0,
        insurance_deduction: 400.0,
      });

      const updatedDetail = await mockFinanceService.getMonthlyBudget('2026-09', yijiaMember.id);
      expect(updatedDetail.budget.gross_salary).toBe(7000.0);
      expect(updatedDetail.budget.bonus).toBe(1000.0);
      // after_deductions = 7000 - 1400 + 1000 - 120 - 400 = 6080
      expect(updatedDetail.budget.after_deductions).toBe(6080.0);
    });

    it('updates base profile and allocations', async () => {
      const yijiaMember = mockMembers.find((m) => m.display_name === 'Yi Jia')!;
      const profiles = await mockFinanceService.getBaseProfiles();
      const profile = profiles.find((p) => p.owner_id === yijiaMember.id)!;

      const updatedProfile = { ...profile, gross_salary: 6500.0 };
      const newAllocations = [
        {
          id: 'bpa-test-1',
          profile_id: profile.id,
          category_id: 'cat-00000000-0101',
          target_percentage: 0.2,
        },
        {
          id: 'bpa-test-2',
          profile_id: profile.id,
          category_id: 'cat-00000000-0102',
          target_percentage: 0.8,
        },
      ];

      await mockFinanceService.updateBaseProfile(updatedProfile, newAllocations);

      const refreshedProfiles = await mockFinanceService.getBaseProfiles();
      const found = refreshedProfiles.find((p) => p.id === profile.id);
      expect(found?.gross_salary).toBe(6500.0);
    });
  });

  describe('Savings Goals & Liabilities & Policies', () => {
    it('fetches loans and recurring policies', async () => {
      const loans = await mockFinanceService.getLoans();
      expect(loans.length).toBeGreaterThan(0);
      expect(loans[0].name).toBe('HDB Loan');

      const policies = await mockFinanceService.getPolicies();
      expect(policies.length).toBeGreaterThan(0);
      expect(policies.some((p) => p.type === 'insurance')).toBe(true);
    });

    it('adds and updates savings goals with automatic status pacing', async () => {
      const goalsBefore = await mockFinanceService.getGoals();
      const initialCount = goalsBefore.length;

      const newGoal = await mockFinanceService.addGoal({
        title: 'Kyoto Holiday Fund',
        target_amount: 6000.0,
        saved_so_far: 1500.0,
        target_date: '2027-06-01',
        monthly_contribution: 500.0,
        emoji: '⛩️',
      });

      expect(newGoal.id).toBeDefined();
      expect(newGoal.title).toBe('Kyoto Holiday Fund');
      expect(newGoal.status).toBe('on_track');

      // Update goal: mark as achieved by increasing saved_so_far
      const updated = await mockFinanceService.updateGoal(newGoal.id, {
        saved_so_far: 6000.0,
      });
      expect(updated.saved_so_far).toBe(6000.0);
      expect(updated.status).toBe('achieved');

      const goalsAfter = await mockFinanceService.getGoals();
      expect(goalsAfter.length).toBe(initialCount + 1);
    });
  });
});
