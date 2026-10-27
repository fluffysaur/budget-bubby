/**
 * Mathematical Calculation & Business Logic Engines for Budget Buddy.
 * Covers:
 * 1. Singapore CPF (20%) & Net Take-Home Pay
 * 2. Disposable Budget Allocation Pool
 * 3. Category Target Allocations
 * 4. Loan Amortization & Prepayment Simulator
 * 5. Couple Shared Expense Settlement ("Who Owes Whom")
 * 6. Savings Goal Pacing Indicator
 */

import type {
  Account,
  AccountSnapshot,
  BonusAllocationResult,
  Category,
  Expense,
  ExpenseTrendsSummary,
  Loan,
  MonthlyBalancePoint,
  MonthlyExpenseTrendPoint,
  Perspective,
  RecurringPolicy,
  CPFAndNetPayResult,
  CategoryAllocationTarget,
  CategoryAllocation,
  AmortizationScheduleRow,
  AmortizationResult,
  SettlementSummary,
  GoalPacingResult,
  GoalStatus,
} from '../types/finance';
import {
  addMonths,
  monthsBetween,
  getTodayDateString,
  getCurrentMonth,
  formatShortMonth,
} from './dateUtils';
import { formatSGD } from './currency';

/**
 * 1. Calculates Singapore CPF deduction (default 20% employee rate) and net take-home pay.
 * Formula:
 *   CPF Deduction = round(Gross Salary * CPF Rate)
 *   Take-Home Pay = Gross Salary - CPF Deduction + Bonus
 */
export function calculateCPFAndNetPay(
  grossSalary: number,
  cpfRate: number = 0.20,
  bonus: number = 0
): CPFAndNetPayResult {
  if (grossSalary <= 0) {
    return {
      cpfDeduction: 0,
      takeHomePay: Math.round(bonus * 100) / 100,
    };
  }

  const cpfDeduction = Math.round(grossSalary * cpfRate * 100) / 100;
  const takeHomePay = Math.round((grossSalary - cpfDeduction + bonus) * 100) / 100;

  return {
    cpfDeduction,
    takeHomePay,
  };
}

/**
 * 2. Calculates after-deductions disposable budget pool.
 * Formula:
 *   Disposable = Take-Home Pay - (Taxes Monthly + Insurance Monthly)
 */
export function calculateDisposableBudget(
  takeHomePay: number,
  taxesMonthly: number = 0,
  insuranceMonthly: number = 0
): number {
  const result = takeHomePay - taxesMonthly - insuranceMonthly;
  return Math.round(result * 100) / 100;
}

/**
 * 3. Allocates the disposable budget across budget categories according to target percentages.
 * Formula:
 *   Budget(C_i) = round(After Deductions * TargetPercentage(C_i))
 */
export function calculateCategoryAllocations(
  afterDeductions: number,
  targets: CategoryAllocationTarget[]
): CategoryAllocation[] {
  if (!targets || targets.length === 0) {
    return [];
  }

  return targets.map((target) => ({
    categoryId: target.categoryId,
    allocatedAmount: Math.round(afterDeductions * target.percentage * 100) / 100,
  }));
}

/**
 * 4. Calculates month-by-month loan amortization schedule and payoff metrics.
 * Supports optional extra monthly prepayment simulation.
 * Throws if the monthly payment is insufficient to cover monthly interest.
 */
export function calculateLoanAmortization(
  principal: number,
  annualRate: number,
  monthlyPayment: number,
  startDate: string,
  extraMonthlyPayment: number = 0
): AmortizationResult {
  if (principal <= 0) {
    return {
      schedule: [],
      totalMonths: 0,
      totalInterest: 0,
      payoffDate: startDate,
      monthlyPayment: 0,
    };
  }

  const monthlyRate = annualRate / 12;
  const totalPaymentPerMonth = monthlyPayment + extraMonthlyPayment;
  const firstMonthInterest = Math.round(principal * monthlyRate * 100) / 100;

  if (totalPaymentPerMonth <= firstMonthInterest) {
    throw new Error(
      `Monthly payment (${totalPaymentPerMonth}) cannot cover monthly interest (${firstMonthInterest}). Loan balance will not decrease.`
    );
  }

  let balance = principal;
  let totalInterest = 0;
  let month = 0;
  const schedule: AmortizationScheduleRow[] = [];
  const maxIterations = 600; // 50 years safeguard

  while (balance > 0.005 && month < maxIterations) {
    month++;
    const paymentDate = addMonths(startDate, month - 1);
    const interestPayment = Math.round(balance * monthlyRate * 100) / 100;
    const principalPayment = Math.min(
      Math.round((totalPaymentPerMonth - interestPayment) * 100) / 100,
      balance
    );
    const actualPayment = Math.round((principalPayment + interestPayment) * 100) / 100;

    totalInterest = Math.round((totalInterest + interestPayment) * 100) / 100;
    balance = Math.round((balance - principalPayment) * 100) / 100;

    schedule.push({
      month,
      paymentDate,
      payment: actualPayment,
      principalPayment,
      interestPayment,
      remainingBalance: balance,
      totalInterestPaid: totalInterest,
    });
  }

  const payoffDate = schedule.length > 0 ? schedule[schedule.length - 1].paymentDate : startDate;

  return {
    schedule,
    totalMonths: schedule.length,
    totalInterest,
    payoffDate,
    monthlyPayment: totalPaymentPerMonth,
  };
}

/**
 * 5. Calculates couple shared expense settlement ("Who owes whom").
 * Only considers unsettled (`settled: false`) expenses where `is_shared: true`.
 * Default split ratio is 50/50 (0.50), or uses custom split_ratio.
 */
export function calculateSharedExpenseSettlement(
  expenses: Expense[],
  member1Id: string,
  member2Id: string,
  member1Name?: string,
  member2Name?: string
): SettlementSummary {
  let member2OwesMember1 = 0;
  let member1OwesMember2 = 0;

  const relevantExpenses = expenses.filter(
    (e) => e.is_shared && !e.settled && (e.payer_id === member1Id || e.payer_id === member2Id)
  );

  for (const exp of relevantExpenses) {
    const partnerRatio = exp.split_ratio ?? 0.50;
    const partnerShare = Math.round(exp.amount * partnerRatio * 100) / 100;

    if (exp.payer_id === member1Id) {
      member2OwesMember1 += partnerShare;
    } else if (exp.payer_id === member2Id) {
      member1OwesMember2 += partnerShare;
    }
  }

  member2OwesMember1 = Math.round(member2OwesMember1 * 100) / 100;
  member1OwesMember2 = Math.round(member1OwesMember2 * 100) / 100;

  const netDiff = Math.round((member2OwesMember1 - member1OwesMember2) * 100) / 100;

  const m1Display = member1Name || 'Member 1';
  const m2Display = member2Name || 'Member 2';

  if (netDiff > 0) {
    // member2 owes member1
    return {
      netBalance: netDiff,
      debtorId: member2Id,
      creditorId: member1Id,
      debtorName: m2Display,
      creditorName: m1Display,
      settlementText: `${m2Display} owes ${m1Display} ${formatSGD(netDiff)}`,
      member1OwesMember2,
      member2OwesMember1,
    };
  } else if (netDiff < 0) {
    // member1 owes member2
    const absNet = Math.abs(netDiff);
    return {
      netBalance: absNet,
      debtorId: member1Id,
      creditorId: member2Id,
      debtorName: m1Display,
      creditorName: m2Display,
      settlementText: `${m1Display} owes ${m2Display} ${formatSGD(absNet)}`,
      member1OwesMember2,
      member2OwesMember1,
    };
  } else {
    // Zero balance
    return {
      netBalance: 0,
      debtorId: null,
      creditorId: null,
      debtorName: undefined,
      creditorName: undefined,
      settlementText: 'All settled up',
      member1OwesMember2,
      member2OwesMember1,
    };
  }
}

/**
 * 6. Calculates savings goal pacing status and required monthly contribution.
 * Formula:
 *   Months Remaining = max(monthsBetween(today, targetDate), 1)
 *   Needed Per Month = max(targetAmount - savedSoFar, 0) / Months Remaining
 * Status:
 *   - 'achieved': savedSoFar >= targetAmount
 *   - 'on_track': monthlyContribution >= neededPerMonth
 *   - 'behind': monthlyContribution < neededPerMonth
 */
export function calculateGoalPacing(
  targetAmount: number,
  savedSoFar: number,
  targetDate: string,
  monthlyContribution: number,
  referenceDate?: string | Date
): GoalPacingResult {
  if (savedSoFar >= targetAmount) {
    return {
      status: 'achieved',
      monthsRemaining: 0,
      neededPerMonth: 0,
    };
  }

  const ref = referenceDate || getTodayDateString();
  const rawMonths = monthsBetween(ref, targetDate);
  const monthsRemaining = Math.max(rawMonths, 1);
  const remainingNeeded = Math.max(targetAmount - savedSoFar, 0);
  const neededPerMonth = Math.round((remainingNeeded / monthsRemaining) * 100) / 100;

  const status: GoalStatus = monthlyContribution >= neededPerMonth ? 'on_track' : 'behind';

  return {
    status,
    monthsRemaining,
    neededPerMonth,
  };
}

/**
 * 7. Determines whether a category belongs to day-to-day Spendable Budget
 * ('Food', 'Lifestyle', 'Transport', 'Buffer') vs. Wealth/Fixed Allocations
 * ('Investments', 'Savings', 'Tithing').
 */
export function isSpendableCategory(categoryOrName?: Category | string | null): boolean {
  if (!categoryOrName) return true;
  if (typeof categoryOrName === 'object') {
    if (categoryOrName.group) {
      return categoryOrName.group === 'spendable';
    }
    return isSpendableCategory(categoryOrName.name);
  }

  const clean = categoryOrName.toLowerCase().trim();
  if (
    clean.includes('invest') ||
    clean.includes('saving') ||
    clean.includes('tith')
  ) {
    return false;
  }
  return true;
}

/**
 * 8. Computes a member's effective share of an expense based on perspective and 50/50 split.
 * - In 'household' perspective: returns full expense amount.
 * - In personal perspective:
 *   - Personal expense (!is_shared): 100% if payer_id === memberId, else 0.
 *   - Shared expense (is_shared): (1 - split_ratio) if payer_id === memberId, else split_ratio.
 */
export function getMemberExpenseShare(
  expense: Expense,
  memberId?: string,
  perspective: Perspective = 'household'
): number {
  if (perspective === 'household' || !memberId) {
    return Math.round(Number(expense.amount) * 100) / 100;
  }

  const amount = Number(expense.amount) || 0;
  const partnerRatio = expense.split_ratio ?? 0.5;

  if (!expense.is_shared) {
    return expense.payer_id === memberId ? Math.round(amount * 100) / 100 : 0;
  }

  if (expense.payer_id === memberId) {
    return Math.round(amount * (1 - partnerRatio) * 100) / 100;
  }

  // Partner paid a shared household expense -> this member's share is partnerRatio (default 50%)
  return Math.round(amount * partnerRatio * 100) / 100;
}

/**
 * 9. Calculates historical End-of-Month balance & Net Worth series from real AccountSnapshots.
 * Supports All vs. Non-CPF (Liquid) assets and Month-over-Month (MoM) deltas.
 */
export function calculateMonthlyBalanceTrends(
  accounts: Account[],
  snapshots: AccountSnapshot[],
  loans: Loan[],
  perspective: Perspective = 'household',
   monthsCount: number = 6,
  referenceMonth?: string
): MonthlyBalancePoint[] {
  const currentM = referenceMonth || getCurrentMonth();
  const months: string[] = [];
  for (let i = -(monthsCount - 1); i <= 0; i++) {
    months.push(addMonths(currentM, i));
  }

  const activeLoans = (loans || []).filter((l) => l.status === 'active');
  const currentTotalLiability = activeLoans.reduce((sum, l) => {
    const remaining = Math.max(0, Number(l.principal) - Number(l.amount_paid));
    if (perspective !== 'household' && !l.borrower_id) {
      return sum + remaining * 0.5;
    }
    return sum + remaining;
  }, 0);

  const monthlyLoanPrincipalStep = activeLoans.reduce((sum, l) => {
    const payment = Number(l.monthly_payment) || 0;
    const estPrincipal = payment * 0.6;
    if (perspective !== 'household' && !l.borrower_id) {
      return sum + estPrincipal * 0.5;
    }
    return sum + estPrincipal;
  }, 0);

  const points: MonthlyBalancePoint[] = [];

  for (let idx = 0; idx < months.length; idx++) {
    const month = months[idx];
    const monthsBeforeCurrent = months.length - 1 - idx;

    let cash = 0;
    let investments = 0;
    let cpf = 0;
    let other = 0;

    for (const acc of accounts) {
      // Find latest snapshot for this account up to the end of `month`
      const accSnaps = snapshots
        .filter((s) => s.account_id === acc.id && s.snapshot_date.slice(0, 7) <= month)
        .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

      let bal: number;
      if (accSnaps.length > 0) {
        bal = Number(accSnaps[accSnaps.length - 1].balance);
      } else {
        // Fallback if no snapshot exists at or before `month`: check earliest snapshot or current balance
        const allAccSnaps = snapshots
          .filter((s) => s.account_id === acc.id)
          .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        bal = allAccSnaps.length > 0 ? Number(allAccSnaps[0].balance) : Number(acc.balance);
      }

      if (acc.type === 'Cash') cash += bal;
      else if (acc.type === 'Investment') investments += bal;
      else if (acc.type === 'CPF') cpf += bal;
      else other += bal;
    }

    cash = Math.round(cash * 100) / 100;
    investments = Math.round(investments * 100) / 100;
    cpf = Math.round(cpf * 100) / 100;
    other = Math.round(other * 100) / 100;

    const totalAssets = Math.round((cash + investments + cpf + other) * 100) / 100;
    const nonCpfAssets = Math.round((cash + investments + other) * 100) / 100;

    const liabilities =
      currentTotalLiability > 0
        ? Math.round((currentTotalLiability + monthsBeforeCurrent * monthlyLoanPrincipalStep) * 100) / 100
        : 0;

    const netWorth = Math.round((totalAssets - liabilities) * 100) / 100;
    const nonCpfNetWorth = nonCpfAssets;

    const prevPoint = idx > 0 ? points[idx - 1] : null;
    const momChange = prevPoint ? Math.round((totalAssets - prevPoint.totalAssets) * 100) / 100 : 0;
    const momChangePct =
      prevPoint && prevPoint.totalAssets > 0
        ? Math.round(((totalAssets - prevPoint.totalAssets) / prevPoint.totalAssets) * 1000) / 10
        : 0;

    points.push({
      month,
      label: formatShortMonth(month),
      cash,
      investments,
      cpf,
      other,
      totalAssets,
      nonCpfAssets,
      liabilities,
      netWorth,
      nonCpfNetWorth,
      momChange,
      momChangePct,
    });
  }

  return points;
}

/**
 * 10. Calculates Monthly Expense Trends, 3/6-month rolling averages, and Per-Category Monthly Averages.
 * Automatically includes monthly subscriptions under the Lifestyle category.
 */
export function calculateExpenseTrends(
  expenses: Expense[],
  categories: Category[],
  policies: RecurringPolicy[] = [],
  perspective: Perspective = 'household',
  memberId?: string,
  currentMonth?: string,
  monthsCount: number = 6
): ExpenseTrendsSummary {
  const refMonth = currentMonth || getCurrentMonth();
  const months: string[] = [];
  for (let i = -(monthsCount - 1); i <= 0; i++) {
    months.push(addMonths(refMonth, i));
  }

  // Spendable categories
  const spendableCats = categories.filter((c) => isSpendableCategory(c));
  const lifestyleCat =
    spendableCats.find((c) => c.name.toLowerCase().includes('lifestyle')) ||
    spendableCats[0];

  // Monthly subscriptions in scope
  const activeSubs = (policies || []).filter((p) => {
    if (p.type !== 'subscription') return false;
    if (perspective === 'household' || !memberId) return true;
    return p.owner_id === memberId || p.owner_id === 'joint';
  });
  const monthlySubTotal = Math.round(
    activeSubs.reduce((sum, s) => sum + Number(s.monthly_amortized_amount || s.amount || 0), 0) * 100
  ) / 100;

  const monthlySeries: MonthlyExpenseTrendPoint[] = months.map((m) => {
    const byCategory: Record<string, number> = {};
    for (const cat of spendableCats) {
      byCategory[cat.id] = 0;
    }

    // Exclude goal-funded expenses from regular monthly trends
    const monthExpenses = expenses.filter((e) => e.date.startsWith(m) && !e.goal_id);
    for (const exp of monthExpenses) {
      const cat = categories.find((c) => c.id === exp.category_id);
      if (cat && !isSpendableCategory(cat)) {
        continue;
      }
      const share = getMemberExpenseShare(exp, memberId, perspective);
      if (share <= 0) continue;

      const catKey = exp.category_id && byCategory[exp.category_id] !== undefined
        ? exp.category_id
        : spendableCats[0]?.id || 'uncategorized';

      byCategory[catKey] = Math.round(((byCategory[catKey] || 0) + share) * 100) / 100;
    }

    // Add monthly subscriptions to Lifestyle category if applicable
    if (lifestyleCat && monthlySubTotal > 0) {
      byCategory[lifestyleCat.id] = Math.round(
        ((byCategory[lifestyleCat.id] || 0) + monthlySubTotal) * 100
      ) / 100;
    }

    const totalSpent = Math.round(
      Object.values(byCategory).reduce((sum, val) => sum + val, 0) * 100
    ) / 100;

    return {
      month: m,
      label: formatShortMonth(m),
      totalSpent,
      subscriptionsSpent: monthlySubTotal,
      byCategory,
    };
  });

  // Compute averages across months that have activity (or all months in window)
  const nonZeroSeries = monthlySeries.filter((pt) => pt.totalSpent > 0);
  const denomAll = nonZeroSeries.length > 0 ? nonZeroSeries.length : 1;
  const averageMonthlyTotal = Math.round(
    (nonZeroSeries.reduce((s, pt) => s + pt.totalSpent, 0) / denomAll) * 100
  ) / 100;

  const last3 = monthlySeries.slice(-3).filter((pt) => pt.totalSpent > 0);
  const rolling3MonthAvg = Math.round(
    (last3.reduce((s, pt) => s + pt.totalSpent, 0) / (last3.length || 1)) * 100
  ) / 100;

  const last6 = monthlySeries.slice(-6).filter((pt) => pt.totalSpent > 0);
  const rolling6MonthAvg = Math.round(
    (last6.reduce((s, pt) => s + pt.totalSpent, 0) / (last6.length || 1)) * 100
  ) / 100;

  const currentPoint = monthlySeries[monthlySeries.length - 1];
  const currentMonthTotal = currentPoint ? currentPoint.totalSpent : 0;
  const vsAverageDelta = Math.round((currentMonthTotal - rolling3MonthAvg) * 100) / 100;

  const categoryAverages = spendableCats.map((cat) => {
    const totalForCat = nonZeroSeries.reduce(
      (sum, pt) => sum + (pt.byCategory[cat.id] || 0),
      0
    );
    const avg = Math.round((totalForCat / denomAll) * 100) / 100;
    const curr = currentPoint ? currentPoint.byCategory[cat.id] || 0 : 0;

    return {
      categoryId: cat.id,
      categoryName: cat.name,
      color: cat.color,
      averageMonthly: avg,
      currentMonth: curr,
    };
  });

  return {
    monthlySeries,
    averageMonthlyTotal,
    rolling3MonthAvg,
    rolling6MonthAvg,
    currentMonthTotal,
    vsAverageDelta,
    categoryAverages,
  };
}

export const calculateExpenseTrendsSummary = calculateExpenseTrends;

/**
 * 11. Calculates Bonus Allocation breakdown matching Notion's Bonus helper:
 * Default splits after 20% CPF:
 * - Tithing: 10%
 * - Goals: 40%
 * - Savings: 10%
 * - Investments: 20%
 * - Lifestyle: 20%
 */
export function calculateBonusAllocation(
  grossBonus: number,
  cpfRate: number = 0.2,
  customSplits?: Array<{ name: string; percentage: number; color: string }>
): BonusAllocationResult {
  const safeGross = Math.max(0, Number(grossBonus) || 0);
  const cpfDeduction = Math.round(safeGross * cpfRate * 100) / 100;
  const afterCpf = Math.round((safeGross - cpfDeduction) * 100) / 100;

  const splits = customSplits || [
    { name: 'Tithing', percentage: 0.1, color: '#8B5CF6' },
    { name: 'Goals', percentage: 0.4, color: '#3B82F6' },
    { name: 'Savings', percentage: 0.1, color: '#6366F1' },
    { name: 'Investments', percentage: 0.2, color: '#10B981' },
    { name: 'Lifestyle', percentage: 0.2, color: '#EC4899' },
  ];

  return {
    grossBonus: safeGross,
    cpfDeduction,
    afterCpf,
    allocations: splits.map((s) => ({
      name: s.name,
      percentage: s.percentage,
      amount: Math.round(afterCpf * s.percentage * 100) / 100,
      color: s.color,
    })),
  };
}
