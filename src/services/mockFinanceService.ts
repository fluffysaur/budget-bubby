/**
 * Mock Finance Service for Budget Bubby.
 * In-memory state initialized from mockSeedData.ts with localStorage synchronization.
 * Supports full CRUD for accounts, balances, snapshots, monthly budgets, expenses,
 * shared settlements, savings goals, and recurring items.
 *
 * This class is a thin facade: each domain lives in `./mock/{domain}.ts` and
 * shares one `MockContext` holding the dataset.
 */

import type { FinanceService } from "./financeService";
import { MockInboxStore } from "./inbox/mockInboxStore";
import { MockContext } from "./mock/context";
import { HouseholdStore } from "./mock/household";
import { AccountsStore } from "./mock/accounts";
import { CategoriesStore } from "./mock/categories";
import { BudgetStore } from "./mock/budget";
import { ExpensesStore } from "./mock/expenses";
import { SettleUpsStore } from "./mock/settleUps";
import { GoalsStore } from "./mock/goals";
import { RecurringStore } from "./mock/recurring";
import { CardsStore } from "./mock/cards";
import { NotificationsStore } from "./mock/notifications";
import { BonusStore } from "./mock/bonus";

class MockFinanceServiceImpl implements FinanceService {
    private readonly ctx = new MockContext();

    /** Live dataset. Tests reach in here to seed edge cases. */
    get state() {
        return this.ctx.state;
    }

    private readonly household = new HouseholdStore(this.ctx);
    private readonly accounts = new AccountsStore(this.ctx);
    private readonly categories = new CategoriesStore(this.ctx);
    private readonly budget = new BudgetStore(this.ctx);
    private readonly expenses = new ExpensesStore(this.ctx, () => this);
    private readonly settleUps = new SettleUpsStore(this.ctx);
    private readonly goals = new GoalsStore(this.ctx);
    private readonly recurring = new RecurringStore(this.ctx);
    private readonly cards = new CardsStore(this.ctx);
    private readonly notifications = new NotificationsStore(this.ctx);
    private readonly bonus = new BonusStore(this.ctx);

    // Capture Inbox (demo data in ./inbox/mockInboxStore)
    public readonly inbox = new MockInboxStore((input) =>
        this.addExpense(input),
    );
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
    listCaptureTokens: FinanceService["listCaptureTokens"] = (memberId) =>
        this.inbox.listCaptureTokens(memberId);
    createCaptureToken: FinanceService["createCaptureToken"] = (
        label,
        memberId,
    ) => this.inbox.createCaptureToken(label, memberId);
    revokeCaptureToken: FinanceService["revokeCaptureToken"] = (id) =>
        this.inbox.revokeCaptureToken(id);

    /**
     * Resets mock data back to pure initial seed data and updates localStorage.
     */
    public resetData(): void {
        this.ctx.reset();
        this.inbox.reset();
    }

    public resetState(): void {
        this.resetData();
    }

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
    addCategory: FinanceService["addCategory"] = (...args) =>
        this.categories.addCategory(...args);
    updateCategory: FinanceService["updateCategory"] = (...args) =>
        this.categories.updateCategory(...args);
    deleteCategory: FinanceService["deleteCategory"] = (...args) =>
        this.categories.deleteCategory(...args);
    seedDefaultCategories: FinanceService["seedDefaultCategories"] = (
        ...args
    ) => this.categories.seedDefaultCategories(...args);
    // budget
    getBaseProfiles: FinanceService["getBaseProfiles"] = (...args) =>
        this.budget.getBaseProfiles(...args);
    getBaseAllocations: FinanceService["getBaseAllocations"] = (...args) =>
        this.budget.getBaseAllocations(...args);
    updateBaseProfile: FinanceService["updateBaseProfile"] = (...args) =>
        this.budget.updateBaseProfile(...args);
    getMonthlyBudgetHistory: FinanceService["getMonthlyBudgetHistory"] = (
        ...args
    ) => this.budget.getMonthlyBudgetHistory(...args);
    getMonthlyBudget: FinanceService["getMonthlyBudget"] = (...args) =>
        this.budget.getMonthlyBudget(...args);
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

export const mockFinanceService = new MockFinanceServiceImpl();
