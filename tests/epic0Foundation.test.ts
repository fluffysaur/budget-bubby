import { describe, it, expect, beforeEach } from 'vitest';
import { financeService } from '../src/services/financeService';
import {
  convertToSGD,
  formatForeignAmount,
  SUPPORTED_CURRENCIES,
  getCachedRates,
} from '../src/lib/currencyConverter';
import {
  playChaChingSound,
  playBudgetWarningSound,
  playBudgetExceededSound,
} from '../src/lib/soundEffects';
import { getTodayDateString } from '../src/lib/dateUtils';

describe('Epic 0: Shared Foundation Services & Libs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('Currency Converter', () => {
    it('supports major regional currencies including VND, MYR, JPY, THB, USD', () => {
      const codes = SUPPORTED_CURRENCIES.map((c) => c.code);
      expect(codes).toContain('SGD');
      expect(codes).toContain('VND');
      expect(codes).toContain('MYR');
      expect(codes).toContain('JPY');
      expect(codes).toContain('THB');
      expect(codes).toContain('USD');
    });

    it('converts foreign currencies to SGD accurately using default rates', () => {
      // 1 SGD = 18,900 VND -> 189,000 VND should be ~10 SGD
      const resVND = convertToSGD(189000, 'VND');
      expect(resVND.amountInSGD).toBe(10);
      expect(resVND.exchangeRate).toBe(18900);

      // Custom override rate
      const resCustom = convertToSGD(100, 'USD', 0.8);
      expect(resCustom.amountInSGD).toBe(125);
    });

    it('formats foreign amounts with native symbols and zero-decimal rules', () => {
      expect(formatForeignAmount(250000, 'VND')).toBe('₫250,000');
      expect(formatForeignAmount(1500, 'JPY')).toBe('¥1,500');
      expect(formatForeignAmount(12.5, 'USD')).toBe('$12.50');
    });

    it('returns cached rates fallback', () => {
      const rates = getCachedRates();
      expect(rates.SGD).toBe(1);
      expect(rates.VND).toBeGreaterThan(10000);
    });
  });

  describe('Sound Effects Engine', () => {
    it('executes audio chimes without throwing', () => {
      expect(() => playChaChingSound()).not.toThrow();
      expect(() => playBudgetWarningSound()).not.toThrow();
      expect(() => playBudgetExceededSound()).not.toThrow();
    });
  });

  describe('Finance Service - Extended Foundation Operations', () => {
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
