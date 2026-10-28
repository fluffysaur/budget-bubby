import { describe, it, expect } from 'vitest';
import {
  calculateCPFAndNetPay,
  calculateDisposableBudget,
  calculateCategoryAllocations,
  calculateLoanAmortization,
  calculateSharedExpenseSettlement,
  calculateGoalPacing,
  calculateSpendablePacing,
  detectUnspentMonthEndSurplus,
} from '../src/lib/financialFormulas';
import type { Expense, Category } from '../src/types/finance';

describe('financialFormulas', () => {
  describe('calculateCPFAndNetPay', () => {
    it('calculates 20% employee CPF deduction and take-home pay for standard gross salary', () => {
      const result = calculateCPFAndNetPay(5000);
      expect(result.cpfDeduction).toBe(1000);
      expect(result.takeHomePay).toBe(4000);
    });

    it('handles gross salary with bonus', () => {
      const result = calculateCPFAndNetPay(6000, 0.20, 2000);
      expect(result.cpfDeduction).toBe(1200);
      expect(result.takeHomePay).toBe(6800); // 6000 - 1200 + 2000
    });

    it('supports custom CPF rates', () => {
      const result = calculateCPFAndNetPay(4000, 0.05, 0);
      expect(result.cpfDeduction).toBe(200);
      expect(result.takeHomePay).toBe(3800);
    });

    it('handles zero salary', () => {
      const result = calculateCPFAndNetPay(0);
      expect(result.cpfDeduction).toBe(0);
      expect(result.takeHomePay).toBe(0);
    });

    it('rounds cents accurately', () => {
      const result = calculateCPFAndNetPay(3333.33, 0.20);
      expect(result.cpfDeduction).toBe(666.67);
      expect(result.takeHomePay).toBe(2666.66);
    });
  });

  describe('calculateDisposableBudget', () => {
    it('deducts amortized taxes and insurance from take-home pay', () => {
      const disposable = calculateDisposableBudget(4000, 200, 150);
      expect(disposable).toBe(3650);
    });

    it('returns take-home pay unchanged when there are no deductions', () => {
      const disposable = calculateDisposableBudget(5000, 0, 0);
      expect(disposable).toBe(5000);
    });

    it('handles floating point cent precision cleanly', () => {
      const disposable = calculateDisposableBudget(3650.55, 120.25, 80.10);
      expect(disposable).toBe(3450.20);
    });
  });

  describe('calculateCategoryAllocations', () => {
    it('allocates pool across specified percentage targets', () => {
      const targets = [
        { categoryId: 'cat-food', percentage: 0.15 },
        { categoryId: 'cat-lifestyle', percentage: 0.15 },
        { categoryId: 'cat-invest', percentage: 0.35 },
        { categoryId: 'cat-savings', percentage: 0.15 },
        { categoryId: 'cat-tithing', percentage: 0.10 },
        { categoryId: 'cat-transport', percentage: 0.05 },
        { categoryId: 'cat-buffer', percentage: 0.05 },
      ];

      const allocations = calculateCategoryAllocations(3000, targets);

      expect(allocations).toHaveLength(7);
      expect(allocations.find(a => a.categoryId === 'cat-food')?.allocatedAmount).toBe(450);
      expect(allocations.find(a => a.categoryId === 'cat-lifestyle')?.allocatedAmount).toBe(450);
      expect(allocations.find(a => a.categoryId === 'cat-invest')?.allocatedAmount).toBe(1050);
      expect(allocations.find(a => a.categoryId === 'cat-savings')?.allocatedAmount).toBe(450);
      expect(allocations.find(a => a.categoryId === 'cat-tithing')?.allocatedAmount).toBe(300);
      expect(allocations.find(a => a.categoryId === 'cat-transport')?.allocatedAmount).toBe(150);
      expect(allocations.find(a => a.categoryId === 'cat-buffer')?.allocatedAmount).toBe(150);

      const totalAllocated = allocations.reduce((sum, a) => sum + a.allocatedAmount, 0);
      expect(totalAllocated).toBe(3000);
    });

    it('returns empty array when targets array is empty', () => {
      expect(calculateCategoryAllocations(3000, [])).toEqual([]);
    });
  });

  describe('calculateLoanAmortization', () => {
    it('calculates exact amortization schedule for HDB Loan ($500k @ 2.6%, $2,665/mo)', () => {
      const principal = 500000;
      const annualRate = 0.026; // 2.6%
      const monthlyPayment = 2665;
      const startDate = '2026-09-01';

      const result = calculateLoanAmortization(principal, annualRate, monthlyPayment, startDate);

      expect(result.totalMonths).toBe(242);
      expect(result.monthlyPayment).toBe(2665);
      expect(result.schedule).toHaveLength(242);

      // Month 1 checks
      const m1 = result.schedule[0];
      expect(m1.month).toBe(1);
      expect(m1.paymentDate).toBe('2026-09-01');
      // 500000 * (0.026 / 12) = 1083.33
      expect(m1.interestPayment).toBe(1083.33);
      // 2665 - 1083.33 = 1581.67
      expect(m1.principalPayment).toBe(1581.67);
      expect(m1.remainingBalance).toBe(498418.33);

      // Payoff checks
      const lastRow = result.schedule[result.schedule.length - 1];
      expect(lastRow.remainingBalance).toBe(0);
      expect(result.totalInterest).toBeGreaterThan(142000);
      expect(result.totalInterest).toBeLessThan(143000);
      expect(result.payoffDate).toBe('2046-10-01');
    });

    it('simulates prepayment accelerating loan payoff and reducing total interest', () => {
      const standard = calculateLoanAmortization(500000, 0.026, 2665, '2026-09-01');
      const withExtra = calculateLoanAmortization(500000, 0.026, 2665, '2026-09-01', 500);

      // Extra 500/month (total 3165/mo) reduces months from 242 to 194 (48 months shorter = 4 years!)
      expect(withExtra.totalMonths).toBe(194);
      expect(standard.totalMonths - withExtra.totalMonths).toBe(48);

      // Interest savings: ~142.4k down to ~112.7k (~29.7k saved!)
      const interestSaved = standard.totalInterest - withExtra.totalInterest;
      expect(interestSaved).toBeGreaterThan(29000);
      expect(interestSaved).toBeLessThan(30000);

      // Payoff date moves earlier
      expect(new Date(withExtra.payoffDate).getTime()).toBeLessThan(new Date(standard.payoffDate).getTime());
    });

    it('handles loan paid off in a single payment when payment exceeds principal', () => {
      const result = calculateLoanAmortization(1000, 0.05, 1200, '2026-09-01');
      expect(result.totalMonths).toBe(1);
      expect(result.schedule[0].remainingBalance).toBe(0);
    });

    it('handles zero balance or throws meaningful error if monthly payment cannot cover interest', () => {
      expect(() => calculateLoanAmortization(500000, 0.12, 100, '2026-09-01')).toThrow(
        /monthly payment.*cannot cover monthly interest/i
      );
    });
  });

  describe('calculateSharedExpenseSettlement', () => {
    const member1 = 'member-yijia';
    const member2 = 'member-rachel';

    it('calculates Splitwise-style settlement: Yi Jia paid $100 shared, Rachel paid $40 shared -> Rachel owes Yi Jia $30', () => {
      const expenses: Expense[] = [
        {
          id: 'exp-1',
          household_id: 'hh-1',
          payer_id: member1,
          category_id: 'cat-groceries',
          date: '2026-09-10',
          item: 'FairPrice Groceries',
          amount: 100,
          is_shared: true,
          split_ratio: 0.50,
          settled: false,
          created_at: '2026-09-10T10:00:00Z',
        },
        {
          id: 'exp-2',
          household_id: 'hh-1',
          payer_id: member2,
          category_id: 'cat-dining',
          date: '2026-09-11',
          item: 'Cafe Brunch',
          amount: 40,
          is_shared: true,
          split_ratio: 0.50,
          settled: false,
          created_at: '2026-09-11T12:00:00Z',
        },
      ];

      const settlement = calculateSharedExpenseSettlement(expenses, member1, member2);

      // Yi Jia paid 100 -> Rachel owes 50
      // Rachel paid 40 -> Yi Jia owes 20
      // Net: Rachel owes Yi Jia 30
      expect(settlement.netBalance).toBe(30);
      expect(settlement.debtorId).toBe(member2);
      expect(settlement.creditorId).toBe(member1);
      expect(settlement.member1OwesMember2).toBe(20);
      expect(settlement.member2OwesMember1).toBe(50);
      expect(settlement.settlementText).toContain('owes');
    });

    it('returns zero net balance when shared expenses are equal', () => {
      const expenses: Expense[] = [
        {
          id: 'exp-1',
          household_id: 'hh-1',
          payer_id: member1,
          date: '2026-09-01',
          item: 'Electricity bill',
          amount: 120,
          is_shared: true,
          split_ratio: 0.50,
          settled: false,
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'exp-2',
          household_id: 'hh-1',
          payer_id: member2,
          date: '2026-09-02',
          item: 'Water bill',
          amount: 120,
          is_shared: true,
          split_ratio: 0.50,
          settled: false,
          created_at: '2026-09-02T10:00:00Z',
        },
      ];

      const settlement = calculateSharedExpenseSettlement(expenses, member1, member2);
      expect(settlement.netBalance).toBe(0);
      expect(settlement.debtorId).toBeNull();
      expect(settlement.creditorId).toBeNull();
      expect(settlement.settlementText).toBe('All settled up');
    });

    it('ignores settled and non-shared expenses', () => {
      const expenses: Expense[] = [
        {
          id: 'exp-1',
          household_id: 'hh-1',
          payer_id: member1,
          date: '2026-09-01',
          item: 'Personal game',
          amount: 100,
          is_shared: false, // NOT shared
          split_ratio: 0.50,
          settled: false,
          created_at: '2026-09-01T10:00:00Z',
        },
        {
          id: 'exp-2',
          household_id: 'hh-1',
          payer_id: member1,
          date: '2026-08-15',
          item: 'Old groceries',
          amount: 80,
          is_shared: true,
          split_ratio: 0.50,
          settled: true, // ALREADY settled
          created_at: '2026-08-15T10:00:00Z',
        },
      ];

      const settlement = calculateSharedExpenseSettlement(expenses, member1, member2);
      expect(settlement.netBalance).toBe(0);
      expect(settlement.debtorId).toBeNull();
      expect(settlement.settlementText).toBe('All settled up');
    });

    it('respects custom split ratio', () => {
      const expenses: Expense[] = [
        {
          id: 'exp-1',
          household_id: 'hh-1',
          payer_id: member1,
          date: '2026-09-01',
          item: 'Hotel Booking',
          amount: 1000,
          is_shared: true,
          split_ratio: 0.30, // partner pays 30%
          settled: false,
          created_at: '2026-09-01T10:00:00Z',
        },
      ];

      const settlement = calculateSharedExpenseSettlement(expenses, member1, member2);
      expect(settlement.netBalance).toBe(300);
      expect(settlement.debtorId).toBe(member2);
      expect(settlement.creditorId).toBe(member1);
    });
  });

  describe('calculateGoalPacing', () => {
    const referenceDate = '2026-09-15';

    it('returns "achieved" status when savedSoFar equals or exceeds targetAmount', () => {
      const result = calculateGoalPacing(10000, 10000, '2027-09-15', 500, referenceDate);
      expect(result.status).toBe('achieved');
      expect(result.neededPerMonth).toBe(0);

      const overachieved = calculateGoalPacing(10000, 12000, '2027-09-15', 500, referenceDate);
      expect(overachieved.status).toBe('achieved');
      expect(overachieved.neededPerMonth).toBe(0);
    });

    it('returns "on_track" when monthly contribution meets or exceeds needed amount', () => {
      // 12 months remaining, 12000 needed => 1000/mo needed
      const result = calculateGoalPacing(12000, 0, '2027-09-15', 1000, referenceDate);
      expect(result.monthsRemaining).toBe(12);
      expect(result.neededPerMonth).toBe(1000);
      expect(result.status).toBe('on_track');

      // Contributing more than needed is also on_track
      const ahead = calculateGoalPacing(12000, 0, '2027-09-15', 1500, referenceDate);
      expect(ahead.status).toBe('on_track');
    });

    it('returns "behind" when monthly contribution is less than needed amount', () => {
      // 12 months remaining, 12000 needed => 1000/mo needed. Contributing 500 => behind
      const result = calculateGoalPacing(12000, 0, '2027-09-15', 500, referenceDate);
      expect(result.monthsRemaining).toBe(12);
      expect(result.neededPerMonth).toBe(1000);
      expect(result.status).toBe('behind');
    });

    it('enforces a minimum of 1 month remaining if target date is in the past or current month', () => {
      const result = calculateGoalPacing(5000, 2000, '2026-09-01', 1000, referenceDate);
      expect(result.monthsRemaining).toBe(1);
      expect(result.neededPerMonth).toBe(3000);
      expect(result.status).toBe('behind');
    });
  });

  describe('calculateSpendablePacing', () => {
    const mockCategories: Category[] = [
      { id: 'cat-food', household_id: 'hh-1', name: 'Food', color: '#F59E0B', icon: 'utensils', is_system: true, group: 'spendable' },
      { id: 'cat-lifestyle', household_id: 'hh-1', name: 'Lifestyle', color: '#EC4899', icon: 'sparkles', is_system: true, group: 'spendable' },
      { id: 'cat-invest', household_id: 'hh-1', name: 'Investments', color: '#10B981', icon: 'trending-up', is_system: true, group: 'allocation' },
      { id: 'cat-savings', household_id: 'hh-1', name: 'Savings', color: '#6366F1', icon: 'piggy-bank', is_system: true, group: 'allocation' },
    ];

    it('calculates dynamic daily pace and remaining spendable for active month', () => {
      const expenses: Expense[] = [
        { id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 300, date: '2026-10-05', is_shared: false, item: 'Groceries', split_ratio: 0.5, settled: false },
        { id: 'e2', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-lifestyle', amount: 200, date: '2026-10-10', is_shared: false, item: 'Shopping', split_ratio: 0.5, settled: false },
        // Goal-funded expense should be excluded
        { id: 'e3', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-lifestyle', amount: 500, date: '2026-10-12', is_shared: false, goal_id: 'goal-wedding', item: 'Wedding Ring', split_ratio: 0.5, settled: false },
        // Allocation category expense should be excluded
        { id: 'e4', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-invest', amount: 1000, date: '2026-10-15', is_shared: false, item: 'Stocks', split_ratio: 0.5, settled: false },
      ];

      // October has 31 days. Suppose today is 2026-10-11 => 31 - 11 + 1 = 21 days remaining
      const pacing = calculateSpendablePacing({
        month: '2026-10',
        todayDate: '2026-10-11',
        monthlyCap: 1550,
        expenses,
        categories: mockCategories,
      });

      expect(pacing.spendableAllocated).toBe(1550);
      expect(pacing.spendableSpent).toBe(500); // 300 + 200
      expect(pacing.spendableRemaining).toBe(1050); // 1550 - 500
      expect(pacing.daysInMonth).toBe(31);
      expect(pacing.dayOfMonth).toBe(11);
      expect(pacing.daysRemaining).toBe(21);
      // dynamicDailyPace = 1050 / 21 = 50
      expect(pacing.dynamicDailyPace).toBe(50);
      expect(pacing.isCurrentMonth).toBe(true);
      expect(pacing.pacingStatus).toBe('safe');
    });

    it('handles personal perspective with 50/50 shared split accurately', () => {
      const expenses: Expense[] = [
        // Personal 100%
        { id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 100, date: '2026-10-05', is_shared: false, item: 'Lunch', split_ratio: 0.5, settled: false },
        // Shared paid by m1 (50% share = 100)
        { id: 'e2', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 200, date: '2026-10-06', is_shared: true, split_ratio: 0.5, item: 'Dinner', settled: false },
        // Shared paid by partner m2 (m1 share = 50)
        { id: 'e3', household_id: 'hh-1', payer_id: 'm2', category_id: 'cat-food', amount: 100, date: '2026-10-07', is_shared: true, split_ratio: 0.5, item: 'Groceries', settled: false },
      ];

      const pacing = calculateSpendablePacing({
        month: '2026-10',
        todayDate: '2026-10-11',
        memberId: 'm1',
        perspective: 'm1',
        monthlyCap: 1000,
        expenses,
        categories: mockCategories,
      });

      // m1 spent: 100 + 100 + 50 = 250
      expect(pacing.spendableSpent).toBe(250);
      expect(pacing.spendableRemaining).toBe(750);
    });

    it('reports zero daily pace and completed surplus when viewing past month', () => {
      const expenses: Expense[] = [
        { id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 800, date: '2026-08-15', is_shared: false, item: 'Meals', split_ratio: 0.5, settled: false },
      ];

      const pacing = calculateSpendablePacing({
        month: '2026-08',
        todayDate: '2026-10-15',
        monthlyCap: 1000,
        expenses,
        categories: mockCategories,
      });

      expect(pacing.isCurrentMonth).toBe(false);
      expect(pacing.daysRemaining).toBe(0);
      expect(pacing.dynamicDailyPace).toBe(0);
      expect(pacing.spendableRemaining).toBe(200);
    });

    it('flags warning when spent >= 85% and exceeded when remaining < 0', () => {
      const warningPacing = calculateSpendablePacing({
        month: '2026-10',
        todayDate: '2026-10-15',
        monthlyCap: 1000,
        expenses: [{ id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 900, date: '2026-10-10', is_shared: false, item: 'Meals', split_ratio: 0.5, settled: false }],
        categories: mockCategories,
      });
      expect(warningPacing.pacingStatus).toBe('warning');

      const exceededPacing = calculateSpendablePacing({
        month: '2026-10',
        todayDate: '2026-10-15',
        monthlyCap: 1000,
        expenses: [{ id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 1100, date: '2026-10-10', is_shared: false, item: 'Meals', split_ratio: 0.5, settled: false }],
        categories: mockCategories,
      });
      expect(exceededPacing.pacingStatus).toBe('exceeded');
      expect(exceededPacing.spendableRemaining).toBe(-100);
    });
  });

  describe('detectUnspentMonthEndSurplus', () => {
    const mockCategories: Category[] = [
      { id: 'cat-food', household_id: 'hh-1', name: 'Food', color: '#F59E0B', icon: 'utensils', is_system: true, group: 'spendable' },
    ];

    it('detects unspent surplus from the previous month', () => {
      const expenses: Expense[] = [
        { id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 800, date: '2026-09-10', is_shared: false, item: 'Meals', split_ratio: 0.5, settled: false },
      ];

      const result = detectUnspentMonthEndSurplus({
        currentMonth: '2026-10',
        lastMonth: '2026-09',
        monthlyCap: 1200,
        expenses,
        categories: mockCategories,
      });

      expect(result.hasUnspentSurplus).toBe(true);
      expect(result.surplusAmount).toBe(400); // 1200 - 800
      expect(result.lastMonth).toBe('2026-09');
    });

    it('returns false when previous month was overspent or fully spent', () => {
      const expenses: Expense[] = [
        { id: 'e1', household_id: 'hh-1', payer_id: 'm1', category_id: 'cat-food', amount: 1300, date: '2026-09-10', is_shared: false, item: 'Meals', split_ratio: 0.5, settled: false },
      ];

      const result = detectUnspentMonthEndSurplus({
        currentMonth: '2026-10',
        lastMonth: '2026-09',
        monthlyCap: 1200,
        expenses,
        categories: mockCategories,
      });

      expect(result.hasUnspentSurplus).toBe(false);
      expect(result.surplusAmount).toBe(0);
    });
  });
});
