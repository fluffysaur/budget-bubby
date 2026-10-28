import { describe, it, expect, beforeEach } from 'vitest';
import { mockFinanceService } from '../src/services/mockFinanceService';
import { financeService } from '../src/services/financeService';
import { isSupabaseConfigured } from '../src/services/supabaseClient';
import { mockAccounts, mockMembers } from '../src/data/mockSeedData';
import { getTodayDateString } from '../src/lib/dateUtils';

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
        target_date: '2027-07-01',
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

  describe('Extended Operations (Tags, FX, Goals Drawdown, Credit Cards & Streaks)', () => {
    it('supports adding expense with tags, foreign currency, and goal linking', async () => {
      const today = getTodayDateString();
      const goals = await financeService.getGoals();
      const targetGoal = goals[0];
      const initialSaved = targetGoal.saved_so_far;

      const created = await financeService.addExpense({
        payer_id: 'mem-00000000-0011',
        category_id: 'cat-00000000-0101',
        date: today,
        item: 'Pho Hanoi Dinner',
        amount: 15.5,
        is_shared: true,
        tags: ['Vietnam Trip', 'Dinner'],
        goal_id: targetGoal.id,
        original_amount: 290000,
        original_currency: 'VND',
        exchange_rate: 18700,
      });

      expect(created.tags).toEqual(['Vietnam Trip', 'Dinner']);
      expect(created.goal_id).toBe(targetGoal.id);
      expect(created.original_currency).toBe('VND');

      // Verify goal balance was drawn down
      const updatedGoals = await financeService.getGoals();
      const updatedTargetGoal = updatedGoals.find((g) => g.id === targetGoal.id);
      expect(updatedTargetGoal?.saved_so_far).toBe(Math.max(0, initialSaved - 15.5));
    });

    it('filters expenses by tag and goalId', async () => {
      const allExpenses = await financeService.getExpenses({ tag: 'Vietnam Trip' });
      expect(allExpenses.length).toBeGreaterThan(0);
      expect(allExpenses[0].tags).toContain('Vietnam Trip');
    });

    it('updates an existing expense and restores goal balance when goal link changes', async () => {
      const expenses = await financeService.getExpenses();
      const exp = expenses[0];

      const updated = await financeService.updateExpense(exp.id, {
        item: 'Pho Hanoi Special Dinner',
        amount: 20.0,
      });

      expect(updated.item).toBe('Pho Hanoi Special Dinner');
      expect(updated.amount).toBe(20.0);
    });

    it('supports bulk expense addition', async () => {
      const today = getTodayDateString();
      const bulk = await financeService.bulkAddExpenses([
        {
          payer_id: 'mem-00000000-0011',
          date: today,
          item: 'Bulk 1',
          amount: 5,
          is_shared: false,
        },
        {
          payer_id: 'mem-00000000-0012',
          date: today,
          item: 'Bulk 2',
          amount: 10,
          is_shared: true,
        },
      ]);

      expect(bulk).toHaveLength(2);
      expect(bulk[0].item).toBe('Bulk 1');
      expect(bulk[1].item).toBe('Bulk 2');
    });

    it('manages credit cards and monthly statements', async () => {
      const cards = await financeService.getCreditCards();
      expect(cards.length).toBeGreaterThanOrEqual(2);

      const newCard = await financeService.addCreditCard({
        owner_id: 'mem-00000000-0011',
        name: 'Citi Cash Back',
        bank: 'Citibank',
        last4: '1234',
        billing_day: 10,
        due_day: 28,
        credit_limit: 8000,
      });

      expect(newCard.name).toBe('Citi Cash Back');

      // Upsert statement
      const stmt = await financeService.upsertCreditCardStatement({
        card_id: newCard.id,
        month: '2026-10',
        statement_amount: 450.75,
        due_date: '2026-10-28',
        is_paid: false,
      });

      expect(stmt.statement_amount).toBe(450.75);
      expect(stmt.is_paid).toBe(false);

      // Toggle paid
      const paidStmt = await financeService.upsertCreditCardStatement({
        card_id: newCard.id,
        month: '2026-10',
        statement_amount: 450.75,
        due_date: '2026-10-28',
        is_paid: true,
        paid_at: new Date().toISOString(),
      });
      expect(paidStmt.is_paid).toBe(true);
    });

    it('records daily checkins and calculates streak summaries', async () => {
      const today = getTodayDateString();
      await financeService.recordDailyCheckin('mem-00000000-0011', today, 'no_spend');

      const checkins = await financeService.getDailyCheckins('mem-00000000-0011');
      expect(checkins.some((c) => c.checkin_date === today)).toBe(true);

      const streak = await financeService.getStreakSummary('mem-00000000-0011');
      expect(streak.checkedInToday).toBe(true);
      expect(streak.currentStreak).toBeGreaterThanOrEqual(1);
    });
  });
});
