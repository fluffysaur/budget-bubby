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
  /** Monthly spend from subscription/bill/other recurring items in this category */
  recurringSpent?: number;
  recurringItems?: RecurringItem[];
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
  /** Recurring subscription/bill/other spend with no budget category (counted in totalSpent) */
  uncategorizedRecurringSpent?: number;
  uncategorizedRecurringItems?: RecurringItem[];
  /** Bonuses received this month. Counted as income, kept outside category caps. */
  bonusSummary?: BonusMonthSummary;
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

export type RecurringItemType = 'insurance' | 'tax' | 'subscription' | 'bill' | 'other';
export type RecurringFrequency = 'annually' | 'monthly';

export interface RecurringItem {
  id: string;
  household_id: string;
  owner_id: string;
  type: RecurringItemType;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  payment_month?: number | null; // 1 - 12
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  monthly_amortized_amount: number;
  due_day?: number | null; // 1 - 31, clamped to short months; required for monthly items
  category_id?: string | null; // budget category for subscription/bill/other spend
}

export interface CreateRecurringItemInput {
  household_id?: string;
  owner_id: string;
  type: RecurringItemType;
  name: string;
  amount: number;
  frequency: RecurringFrequency;
  payment_month?: number | null; // 1 - 12
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
  due_day?: number | null; // 1 - 31
  category_id?: string | null;
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
  trueNetWorth: number;
  settlementSummary: SettlementSummary;
  activeGoals: SavingsGoal[];
  upcomingBills: RecurringItem[];
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
  cardDebt: number;
  netWorth: number;
  nonCpfNetWorth: number;
  momChange: number;
  momChangePct: number;
}

export interface MonthlyExpenseTrendPoint {
  month: string; // 'YYYY-MM'
  label: string; // 'Sep 2026'
  totalSpent: number;
  recurringSpent: number;
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

// ---------------------------------------------------------------------------
// Bonus Log
// ---------------------------------------------------------------------------

export type BonusType = 'aws' | 'performance' | 'sign_on' | 'other';
export type BonusSplitKey = 'tithing' | 'goals' | 'savings' | 'investments' | 'lifestyle';

/** One bucket of a bonus split. `pct` is a 0-1 fraction. */
export interface BonusSplitShare {
  key: BonusSplitKey;
  pct: number;
  amount?: number;
}

export interface BonusGoalContribution {
  goal_id: string;
  amount: number;
}

export interface BonusEvent {
  id: string;
  household_id: string;
  recipient_id: string;
  type: BonusType;
  received_on: string; // 'YYYY-MM-DD'
  gross: number;
  cpf: number;
  net: number; // generated in DB; computed in mock
  note?: string | null;
  split: BonusSplitShare[];
  goal_contributions: BonusGoalContribution[];
  created_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface SaveBonusEventInput {
  id?: string;
  recipient_id: string;
  type: BonusType;
  received_on: string;
  gross: number;
  cpf: number;
  note?: string | null;
  split: BonusSplitShare[];
  goal_contributions: BonusGoalContribution[];
}

export interface BonusEventsResult {
  available: boolean;
  events: BonusEvent[];
}

export interface BonusMonthSummary {
  gross: number;
  cpf: number;
  net: number;
  count: number;
  source: 'events' | 'legacy' | 'none';
}

export interface NotificationPreferences {
    id?: string;
    household_id: string;
    member_id: string;
    // Master channels
    push_enabled: boolean;
    sound_enabled: boolean;
    haptics_enabled: boolean;
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
    /** @deprecated Kept for the deployed frontend; use cc_due_reminder_days. */
    cc_due_days_before: number; // default: 5
    /** Days before a CC due date to remind; 0 = due day. Default [7, 3, 1, 0]. */
    cc_due_reminder_days?: number[];
    budget_warning_pct: number; // default: 80
    settlement_threshold_sgd: number; // default: 200
    // Timing ("HH:MM", Singapore time)
    checkin_time?: string; // default: "18:00"
    quiet_hours_start?: string; // default: "22:00"
    quiet_hours_end?: string; // default: "08:00"
    updated_at?: string;
}

export type UpdateNotificationPreferencesInput = Partial<
    Omit<NotificationPreferences, "id" | "household_id" | "member_id" | "updated_at">
>;


/** Per-member record of a reminder's push, read and dismiss state. */
export interface NotificationLogEntry {
    reminder_key: string;
    type: string;
    sent_at?: string | null;
    read_at?: string | null;
    dismissed_at?: string | null;
    created_at?: string;
}

/** A device's Web Push subscription keys. */
export interface PushSubscriptionInput {
    endpoint: string;
    p256dh: string;
    auth: string;
    user_agent?: string;
}

/** Identifies one reminder when writing to the notification log. */
export interface NotificationLogRef {
    key: string;
    type: string;
}
