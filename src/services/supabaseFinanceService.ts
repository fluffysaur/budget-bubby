/**
 * Supabase PostgreSQL Finance Service for Budget Bubby.
 * Directly queries Supabase tables using row-level security and schema mappings.
 *
 * This class is a thin facade: each domain's queries live in
 * `./supabase/{domain}.ts` and share one `SupabaseContext`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { FinanceService } from "./financeService";
import { SupabaseInboxStore } from "./inbox/supabaseInboxStore";
import { SupabaseContext, type StorePeers } from "./supabase/context";

import { HouseholdStore } from "./supabase/household";
import { AccountsStore } from "./supabase/accounts";
import { CategoriesStore } from "./supabase/categories";
import { BudgetStore } from "./supabase/budget";
import { ExpensesStore } from "./supabase/expenses";
import { SettleUpsStore } from "./supabase/settleUps";
import { GoalsStore } from "./supabase/goals";
import { RecurringStore } from "./supabase/recurring";
import { CardsStore } from "./supabase/cards";
import { NotificationsStore } from "./supabase/notifications";
import { BonusStore } from "./supabase/bonus";

export {
    PRESET_DEFAULT_CATEGORIES,
    resetCategoryGroupColumnSupport,
    quotePostgrestIlikePattern,
    buildExpenseSearchOrFilter,
} from "./supabase/shared";

export class SupabaseFinanceServiceImpl implements FinanceService {
    private readonly ctx: SupabaseContext;
    private readonly inbox: SupabaseInboxStore;

    private readonly household: HouseholdStore;
    private readonly accounts: AccountsStore;
    private readonly categories: CategoriesStore;
    private readonly budget: BudgetStore;
    private readonly expenses: ExpensesStore;
    private readonly settleUps: SettleUpsStore;
    private readonly goals: GoalsStore;
    private readonly recurring: RecurringStore;
    private readonly cards: CardsStore;
    private readonly notifications: NotificationsStore;
    private readonly bonus: BonusStore;

    /**
     * @param client Supabase client to use. Defaults to the browser client,
     *   read on each call. The send-reminders function passes a service-role
     *   client.
     * @param options.localFallback When true (default), notification log calls
     *   fall back to the device-local log on errors. The server sets it false
     *   so errors surface instead of being recorded in memory.
     */
    constructor(
        client?: SupabaseClient,
        options: { localFallback?: boolean } = {},
    ) {
        this.ctx = new SupabaseContext(client, options.localFallback ?? true);
        const peers = (): StorePeers => ({
            service: this,
            bonus: this.bonus,
        });
        this.inbox = new SupabaseInboxStore(
            () => this.ctx.getClient(),
            () => this.ctx.getHouseholdId(),
        );

        this.household = new HouseholdStore(this.ctx);
        this.accounts = new AccountsStore(this.ctx);
        this.categories = new CategoriesStore(this.ctx);
        this.budget = new BudgetStore(this.ctx, peers);
        this.expenses = new ExpensesStore(this.ctx, peers);
        this.settleUps = new SettleUpsStore(this.ctx);
        this.goals = new GoalsStore(this.ctx);
        this.recurring = new RecurringStore(this.ctx, peers);
        this.cards = new CardsStore(this.ctx);
        this.notifications = new NotificationsStore(this.ctx);
        this.bonus = new BonusStore(this.ctx);
    }

    /** Test hook: forget what we learned about the bonus log tables. */
    public resetBonusLogAvailability(): void {
        this.ctx.bonusTableAvailable = null;
        this.ctx.settleUpsTableAvailable = null;
    }

    // Capture Inbox (implemented in ./inbox/supabaseInboxStore)
    getInboxItems: FinanceService["getInboxItems"] = (status) =>
        this.inbox.getInboxItems(status);
    getInboxSummary: FinanceService["getInboxSummary"] = (memberId) =>
        this.inbox.getInboxSummary(memberId);
    confirmInboxItem: FinanceService["confirmInboxItem"] = (itemId, expense) =>
        this.inbox.confirmInboxItem(itemId, expense);
    resolveInboxItem: FinanceService["resolveInboxItem"] = (itemId, status) =>
        this.inbox.resolveInboxItem(itemId, status);
    getMerchantRules: FinanceService["getMerchantRules"] = () =>
        this.inbox.getMerchantRules();
    upsertMerchantRule: FinanceService["upsertMerchantRule"] = (rule) =>
        this.inbox.upsertMerchantRule(rule);
    deleteMerchantRule: FinanceService["deleteMerchantRule"] = (id) =>
        this.inbox.deleteMerchantRule(id);
    listCaptureTokens: FinanceService["listCaptureTokens"] = () =>
        this.inbox.listCaptureTokens();
    createCaptureToken: FinanceService["createCaptureToken"] = (
        label,
        memberId,
    ) => this.inbox.createCaptureToken(label, memberId);
    revokeCaptureToken: FinanceService["revokeCaptureToken"] = (id) =>
        this.inbox.revokeCaptureToken(id);

    // household
    updateHouseholdSettings: FinanceService["updateHouseholdSettings"] = (
        ...args
    ) => this.household.updateHouseholdSettings(...args);
    getHouseholdOverview: FinanceService["getHouseholdOverview"] = (...args) =>
        this.household.getHouseholdOverview(...args);
    hatchMemberBubby: FinanceService["hatchMemberBubby"] = (...args) =>
        this.household.hatchMemberBubby(...args);
    // accounts
    getAccounts: FinanceService["getAccounts"] = (...args) =>
        this.accounts.getAccounts(...args);
    createAccount: FinanceService["createAccount"] = (...args) =>
        this.accounts.createAccount(...args);
    updateAccount: FinanceService["updateAccount"] = (...args) =>
        this.accounts.updateAccount(...args);
    reorderAccounts: FinanceService["reorderAccounts"] = (...args) =>
        this.accounts.reorderAccounts(...args);
    deleteAccount: FinanceService["deleteAccount"] = (...args) =>
        this.accounts.deleteAccount(...args);
    updateAccountBalance: FinanceService["updateAccountBalance"] = (...args) =>
        this.accounts.updateAccountBalance(...args);
    bulkUpdateAccountBalances: FinanceService["bulkUpdateAccountBalances"] = (
        ...args
    ) => this.accounts.bulkUpdateAccountBalances(...args);
    getAccountSnapshots: FinanceService["getAccountSnapshots"] = (...args) =>
        this.accounts.getAccountSnapshots(...args);
    getAllAccountSnapshots: FinanceService["getAllAccountSnapshots"] = (
        ...args
    ) => this.accounts.getAllAccountSnapshots(...args);
    // categories
    getCategories: FinanceService["getCategories"] = (...args) =>
        this.categories.getCategories(...args);
    seedDefaultCategories: FinanceService["seedDefaultCategories"] = (
        ...args
    ) => this.categories.seedDefaultCategories(...args);
    addCategory: FinanceService["addCategory"] = (...args) =>
        this.categories.addCategory(...args);
    updateCategory: FinanceService["updateCategory"] = (...args) =>
        this.categories.updateCategory(...args);
    deleteCategory: FinanceService["deleteCategory"] = (...args) =>
        this.categories.deleteCategory(...args);
    // budget
    getBaseProfiles: FinanceService["getBaseProfiles"] = (...args) =>
        this.budget.getBaseProfiles(...args);
    getBaseAllocations: FinanceService["getBaseAllocations"] = (...args) =>
        this.budget.getBaseAllocations(...args);
    updateBaseProfile: FinanceService["updateBaseProfile"] = (...args) =>
        this.budget.updateBaseProfile(...args);
    getMonthlyBudget: FinanceService["getMonthlyBudget"] = (...args) =>
        this.budget.getMonthlyBudget(...args);
    getMonthlyBudgetHistory: FinanceService["getMonthlyBudgetHistory"] = (
        ...args
    ) => this.budget.getMonthlyBudgetHistory(...args);
    updateMonthlyBudget: FinanceService["updateMonthlyBudget"] = (...args) =>
        this.budget.updateMonthlyBudget(...args);
    // expenses
    getExpenses: FinanceService["getExpenses"] = (...args) =>
        this.expenses.getExpenses(...args);
    addExpense: FinanceService["addExpense"] = (...args) =>
        this.expenses.addExpense(...args);
    updateExpense: FinanceService["updateExpense"] = (...args) =>
        this.expenses.updateExpense(...args);
    bulkAddExpenses: FinanceService["bulkAddExpenses"] = (...args) =>
        this.expenses.bulkAddExpenses(...args);
    deleteExpense: FinanceService["deleteExpense"] = (...args) =>
        this.expenses.deleteExpense(...args);
    // settleUps
    settleSharedExpenses: FinanceService["settleSharedExpenses"] = (...args) =>
        this.settleUps.settleSharedExpenses(...args);
    getSettleUps: FinanceService["getSettleUps"] = (...args) =>
        this.settleUps.getSettleUps(...args);
    // goals
    getGoals: FinanceService["getGoals"] = (...args) =>
        this.goals.getGoals(...args);
    getGoal: FinanceService["getGoal"] = (...args) =>
        this.goals.getGoal(...args);
    addGoal: FinanceService["addGoal"] = (...args) =>
        this.goals.addGoal(...args);
    updateGoal: FinanceService["updateGoal"] = (...args) =>
        this.goals.updateGoal(...args);
    // recurring
    getRecurringItems: FinanceService["getRecurringItems"] = (...args) =>
        this.recurring.getRecurringItems(...args);
    addRecurringItem: FinanceService["addRecurringItem"] = (...args) =>
        this.recurring.addRecurringItem(...args);
    updateRecurringItem: FinanceService["updateRecurringItem"] = (...args) =>
        this.recurring.updateRecurringItem(...args);
    deleteRecurringItem: FinanceService["deleteRecurringItem"] = (...args) =>
        this.recurring.deleteRecurringItem(...args);
    // cards
    getCreditCards: FinanceService["getCreditCards"] = (...args) =>
        this.cards.getCreditCards(...args);
    addCreditCard: FinanceService["addCreditCard"] = (...args) =>
        this.cards.addCreditCard(...args);
    updateCreditCard: FinanceService["updateCreditCard"] = (...args) =>
        this.cards.updateCreditCard(...args);
    deleteCreditCard: FinanceService["deleteCreditCard"] = (...args) =>
        this.cards.deleteCreditCard(...args);
    getCreditCardStatements: FinanceService["getCreditCardStatements"] = (
        ...args
    ) => this.cards.getCreditCardStatements(...args);
    upsertCreditCardStatement: FinanceService["upsertCreditCardStatement"] = (
        ...args
    ) => this.cards.upsertCreditCardStatement(...args);
    // notifications
    getDailyCheckins: FinanceService["getDailyCheckins"] = (...args) =>
        this.notifications.getDailyCheckins(...args);
    recordDailyCheckin: FinanceService["recordDailyCheckin"] = (...args) =>
        this.notifications.recordDailyCheckin(...args);
    getNotificationPreferences: FinanceService["getNotificationPreferences"] = (
        ...args
    ) => this.notifications.getNotificationPreferences(...args);
    updateNotificationPreferences: FinanceService["updateNotificationPreferences"] =
        (...args) => this.notifications.updateNotificationPreferences(...args);
    getNotificationLog: FinanceService["getNotificationLog"] = (...args) =>
        this.notifications.getNotificationLog(...args);
    claimNotificationSend: FinanceService["claimNotificationSend"] = (
        ...args
    ) => this.notifications.claimNotificationSend(...args);
    markNotificationsRead: FinanceService["markNotificationsRead"] = (
        ...args
    ) => this.notifications.markNotificationsRead(...args);
    dismissNotification: FinanceService["dismissNotification"] = (...args) =>
        this.notifications.dismissNotification(...args);
    savePushSubscription: FinanceService["savePushSubscription"] = (...args) =>
        this.notifications.savePushSubscription(...args);
    deletePushSubscription: FinanceService["deletePushSubscription"] = (
        ...args
    ) => this.notifications.deletePushSubscription(...args);
    // bonus
    getBonusEvents: FinanceService["getBonusEvents"] = (...args) =>
        this.bonus.getBonusEvents(...args);
    saveBonusEvent: FinanceService["saveBonusEvent"] = (...args) =>
        this.bonus.saveBonusEvent(...args);
    deleteBonusEvent: FinanceService["deleteBonusEvent"] = (...args) =>
        this.bonus.deleteBonusEvent(...args);
    getBonusSplitDefault: FinanceService["getBonusSplitDefault"] = (...args) =>
        this.bonus.getBonusSplitDefault(...args);
    saveBonusSplitDefault: FinanceService["saveBonusSplitDefault"] = (
        ...args
    ) => this.bonus.saveBonusSplitDefault(...args);
}

export const supabaseFinanceService = new SupabaseFinanceServiceImpl();
