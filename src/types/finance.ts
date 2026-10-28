/**
 * Core Financial Domain Types & Data Models for Budget Bubby.
 * Matches Supabase PostgreSQL schema with full Row-Level Security partition support.
 */

export type Perspective = 'household' | 'yijia' | 'rachel' | string;

export interface Household {
  id: string;
  name: string;
  currency: string;
  created_at?: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id?: string | null;
  display_name: string;
  email?: string | null;
  role: 'owner' | 'member';
  avatar_url?: string | null;
  created_at?: string;
}

export type AccountType = 'Cash' | 'Investment' | 'CPF' | 'Other';

export interface Account {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  institution?: string | null;
  is_joint: boolean;
  notes?: string | null;
  updated_at?: string;
}

export interface CreateAccountInput {
  household_id?: string;
  owner_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency?: string;
  institution?: string | null;
  is_joint?: boolean;
  notes?: string | null;
}

export interface UpdateAccountInput {
  name?: string;
  type?: AccountType;
  institution?: string | null;
  owner_id?: string;
  is_joint?: boolean;
  notes?: string | null;
}

export interface AccountSnapshot {
  id: string;
  account_id: string;
  household_id: string;
  balance: number;
  snapshot_date: string;
}

export interface BaseBudgetProfile {
  id: string;
  household_id: string;
  owner_id: string;
  gross_salary: number;
  cpf_employee_rate: number;
  tithing_enabled: boolean;
  updated_at?: string;
}

export type CategoryGroup = 'spendable' | 'allocation';

export interface Category {
  id: string;
  household_id: string;
  name: string;
  color: string;
  icon: string;
  is_system: boolean;
  group?: CategoryGroup;
}

export interface CreateCategoryInput {
  household_id?: string;
  name: string;
  color?: string;
  icon?: string;
  is_system?: boolean;
  group?: CategoryGroup;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string;
  icon?: string;
  group?: CategoryGroup;
}

export interface BaseProfileAllocation {
  id: string;
  profile_id: string;
  category_id: string;
  target_percentage: number;
}

export interface MonthlyBudget {
  id: string;
  household_id: string;
  owner_id: string;
  month: string; // 'YYYY-MM'
  gross_salary: number;
  bonus: number;
  cpf_deduction: number;
  taxes_deduction: number;
  insurance_deduction: number;
  after_deductions: number;
  notes?: string | null;
  is_locked: boolean;
  created_at?: string;
}

export interface MonthlyBudgetCategory {
  id: string;
  monthly_budget_id: string;
  category_id: string;
  percentage: number;
  allocated_amount: number;
}

export interface MonthlyBudgetCategoryDetail extends MonthlyBudgetCategory {
  category?: Category;
  actualSpent?: number;
  remaining?: number;
  subscriptionSpent?: number;
  subscriptionItems?: RecurringPolicy[];
}

export interface MonthlyBudgetDetail {
  budget: MonthlyBudget;
  categories: MonthlyBudgetCategoryDetail[];
  disposablePool: number;
  totalSpent: number;
  totalRemaining: number;
  spendableAllocated?: number;
  spendableSpent?: number;
  spendableRemaining?: number;
  allocationTotal?: number;
}

export interface Expense {
  id: string;
  household_id: string;
  payer_id: string;
  category_id?: string | null;
  date: string; // 'YYYY-MM-DD'
  time?: string | null; // 'HH:mm' or 'HH:mm:ss'
  item: string;
  amount: number;
  remarks?: string | null;
  is_shared: boolean;
  split_ratio: number; // 0.0 - 1.0 (partner's share, default 0.50)
  settled: boolean;
  tags?: string[];
  goal_id?: string | null;
  original_amount?: number | null;
  original_currency?: string | null;
  exchange_rate?: number | null;
  created_at?: string;
}

export interface CreateExpenseInput {
  household_id?: string;
  payer_id: string;
  category_id?: string | null;
  date: string;
  time?: string | null;
  item: string;
  amount: number;
  remarks?: string | null;
  is_shared: boolean;
  split_ratio?: number;
  tags?: string[];
  goal_id?: string | null;
  original_amount?: number | null;
  original_currency?: string | null;
  exchange_rate?: number | null;
}

export interface UpdateExpenseInput {
  payer_id?: string;
  category_id?: string | null;
  date?: string;
  time?: string | null;
  item?: string;
  amount?: number;
  remarks?: string | null;
  is_shared?: boolean;
  split_ratio?: number;
  settled?: boolean;
  tags?: string[];
  goal_id?: string | null;
  original_amount?: number | null;
  original_currency?: string | null;
  exchange_rate?: number | null;
}

export type ExpenseSortField = 'date' | 'amount' | 'category' | 'payer';
export type SortDirection = 'asc' | 'desc';

export interface ExpenseFilter {
  month?: string; // 'YYYY-MM'
  categoryId?: string;
  payerId?: string;
  isShared?: boolean;
  settled?: boolean;
  search?: string;
  tag?: string;
  goalId?: string;
  sortBy?: ExpenseSortField;
  sortOrder?: SortDirection;
  page?: number;
  pageSize?: number;
}

export interface CreditCard {
  id: string;
  household_id: string;
  owner_id: string;
  name: string;
  bank: string;
  last4?: string | null;
  billing_day: number;
  due_day: number;
  credit_limit?: number | null;
  color: string;
  is_active: boolean;
  created_at?: string;
}

export interface CreateCreditCardInput {
  household_id?: string;
  owner_id: string;
  name: string;
  bank: string;
  last4?: string | null;
  billing_day: number;
  due_day: number;
  credit_limit?: number | null;
  color?: string;
}

export interface CreditCardStatement {
  id: string;
  card_id: string;
  household_id: string;
  month: string; // 'YYYY-MM'
  statement_amount: number;
  due_date: string; // 'YYYY-MM-DD'
  is_paid: boolean;
  paid_at?: string | null;
  notes?: string | null;
  card?: CreditCard;
}

export interface UpsertCreditCardStatementInput {
  id?: string;
  card_id: string;
  household_id?: string;
  month: string;
  statement_amount: number;
  due_date: string;
  is_paid?: boolean;
  paid_at?: string | null;
  notes?: string | null;
}

export type CheckinType = 'expense' | 'no_spend';

export interface DailyCheckin {
  id: string;
  household_id: string;
  member_id: string;
  checkin_date: string; // 'YYYY-MM-DD'
  type: CheckinType;
  created_at?: string;
}

export interface StreakSummary {
  currentStreak: number;
  longestStreak: number;
  checkedInToday: boolean;
  lastCheckinDate?: string | null;
  coupleStreak: number;
}

export interface MonthlySurplusPoint {
  month: string;
  cap: number;
  spent: number;
  goalSpent: number;
  delta: number;
  cumulative: number;
}

export interface CumulativeSurplusSummary {
  currentMonthSurplus: number;
  cumulativeSurplus: number;
  monthlyHistory: MonthlySurplusPoint[];
}

export interface SpendablePacingResult {
  spendableAllocated: number;
  spendableSpent: number;
  spendableRemaining: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysRemaining: number;
  dynamicDailyPace: number;
  isCurrentMonth: boolean;
  pacingStatus: 'safe' | 'warning' | 'exceeded';
  progressPercent: number;
}

export interface CategoryLimitAlert {
  categoryId: string;
  categoryName: string;
  color: string;
  spent: number;
  allocated: number;
  percentage: number;
  severity: 'warning' | 'exceeded';
}

export interface Loan {
  id: string;
  household_id: string;
  borrower_id?: string | null;
  name: string;
  principal: number;
  interest_rate: number; // decimal e.g. 0.0260 for 2.6%
  monthly_payment: number;
  amount_paid: number;
  start_date: string;
  term_months: number;
  loan_type: string;
  status: 'active' | 'paid_off';
  created_at?: string;
}

export interface LoanPayment {
  id: string;
  loan_id: string;
  payment_date: string;
  payment_amount: number;
  principal_portion: number;
  interest_portion: number;
  is_extra_payment: boolean;
}

export type GoalStatus = 'on_track' | 'behind' | 'achieved';

export interface SavingsGoal {
  id: string;
  household_id: string;
  owner_id?: string | null;
  title: string;
  target_amount: number;
  saved_so_far: number;
  target_date: string; // 'YYYY-MM-DD'
  monthly_contribution: number;
  emoji: string;
  status: GoalStatus;
  created_at?: string;
}

export interface CreateGoalInput {
  household_id?: string;
  owner_id?: string | null;
  title: string;
  target_amount: number;
  saved_so_far?: number;
  target_date: string;
  monthly_contribution?: number;
  emoji?: string;
}

export type RecurringPolicyType = 'insurance' | 'tax' | 'subscription';
export type RecurringFrequency = 'annually' | 'monthly';

export interface RecurringPolicy {
  id: string;
  household_id: string;
  owner_id: string;
  type: RecurringPolicyType;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  payment_month?: number | null; // 1 - 12
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  monthly_amortized_amount: number;
}

export interface CreatePolicyInput {
  household_id?: string;
  owner_id: string;
  type: RecurringPolicyType;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  payment_month?: number | null; // 1 - 12
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Mathematical Calculation Engine Types
// ---------------------------------------------------------------------------

export interface CPFAndNetPayResult {
  cpfDeduction: number;
  takeHomePay: number;
}

export interface CategoryAllocationTarget {
  categoryId: string;
  percentage: number;
}

export interface CategoryAllocation {
  categoryId: string;
  allocatedAmount: number;
}

export interface AmortizationScheduleRow {
  month: number;
  paymentDate: string; // 'YYYY-MM-DD'
  payment: number;
  principalPayment: number;
  interestPayment: number;
  remainingBalance: number;
  totalInterestPaid: number;
}

export interface AmortizationResult {
  schedule: AmortizationScheduleRow[];
  totalMonths: number;
  totalInterest: number;
  payoffDate: string;
  monthlyPayment: number;
}

export interface SettlementSummary {
  netBalance: number;
  debtorId: string | null;
  creditorId: string | null;
  debtorName?: string;
  creditorName?: string;
  settlementText: string;
  member1OwesMember2: number;
  member2OwesMember1: number;
}

export interface GoalPacingResult {
  status: GoalStatus;
  monthsRemaining: number;
  neededPerMonth: number;
  projectedDate?: string;
}

export interface HouseholdOverview {
  household: Household;
  members: HouseholdMember[];
  totalAssets: number;
  totalLiabilities: number;
  trueNetWorth: number;
  settlementSummary: SettlementSummary;
  activeGoals: SavingsGoal[];
  upcomingBills: RecurringPolicy[];
}

export interface BulkBalanceUpdateItem {
  accountId: string;
  balance: number;
  newBalance?: number;
  notes?: string | null;
}

export interface MonthlyBalancePoint {
  month: string; // 'YYYY-MM'
  label: string; // 'Sep 2026'
  cash: number;
  investments: number;
  cpf: number;
  other: number;
  totalAssets: number;
  nonCpfAssets: number;
  liabilities: number;
  netWorth: number;
  nonCpfNetWorth: number;
  momChange: number;
  momChangePct: number;
}

export interface MonthlyExpenseTrendPoint {
  month: string; // 'YYYY-MM'
  label: string; // 'Sep 2026'
  totalSpent: number;
  subscriptionsSpent: number;
  byCategory: Record<string, number>;
}

export interface CategoryAverageMetric {
  categoryId: string;
  categoryName: string;
  color: string;
  averageMonthly: number;
  currentMonth: number;
}

export interface ExpenseTrendsSummary {
  monthlySeries: MonthlyExpenseTrendPoint[];
  averageMonthlyTotal: number;
  rolling3MonthAvg: number;
  rolling6MonthAvg: number;
  currentMonthTotal: number;
  vsAverageDelta: number;
  categoryAverages: CategoryAverageMetric[];
}

export interface BonusAllocationResult {
  grossBonus: number;
  cpfDeduction: number;
  afterCpf: number;
  allocations: Array<{
    name: string;
    percentage: number;
    amount: number;
    color: string;
  }>;
}

export interface NotificationPreferences {
    id?: string;
    household_id: string;
    member_id: string;
    // Master channels
    push_enabled: boolean;
    sound_enabled: boolean;
    // Category toggles
    cc_payment_due: boolean;
    cc_missing_statement: boolean;
    streak_and_logging: boolean;
    monthly_balance_updates: boolean;
    partner_shared_spend: boolean;
    budget_limit_alerts: boolean;
    recurring_bills_due: boolean;
    goal_pacing_alerts: boolean;
    monthly_budget_review: boolean;
    // Custom thresholds
    cc_due_days_before: number; // default: 5
    budget_warning_pct: number; // default: 80
    settlement_threshold_sgd: number; // default: 200
    updated_at?: string;
}

export type UpdateNotificationPreferencesInput = Partial<
    Omit<NotificationPreferences, "id" | "household_id" | "member_id" | "updated_at">
>;

