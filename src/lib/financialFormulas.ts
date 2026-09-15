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
  Expense,
  CPFAndNetPayResult,
  CategoryAllocationTarget,
  CategoryAllocation,
  AmortizationScheduleRow,
  AmortizationResult,
  SettlementSummary,
  GoalPacingResult,
  GoalStatus,
} from '../types/finance';
import { addMonths, monthsBetween, getTodayDateString } from './dateUtils';

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
      settlementText: `${m2Display} owes ${m1Display} S$${netDiff.toFixed(2)}`,
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
      settlementText: `${m1Display} owes ${m2Display} S$${absNet.toFixed(2)}`,
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
