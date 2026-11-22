/**
 * Gemini function-calling definitions, automatic read tool executors,
 * structured action proposals, and confirmed mutation executors.
 */

import type { QueryClient } from "@tanstack/react-query";
import { financeService } from "../financeService";
import { queryClient as defaultQueryClient } from "../../lib/queryClient";
import { queryKeys } from "../../hooks/useFinanceQueries";
import { generateUuid } from "../../lib/uuid";
import type {
    CreateExpenseInput,
    MonthlyBudget,
    Perspective,
} from "../../types/finance";
import type { GeminiFunctionDeclaration } from "./geminiClient";

export type ReadToolName =
    | "getHouseholdOverview"
    | "getAccounts"
    | "getExpenses"
    | "getMonthlyBudget"
    | "getGoals";

export type ProposalToolName =
    | "proposeExpense"
    | "proposeBalanceUpdate"
    | "proposeBudgetAdjustment";

export type AiToolName = ReadToolName | ProposalToolName;

export const READ_TOOL_NAMES: readonly ReadToolName[] = [
    "getHouseholdOverview",
    "getAccounts",
    "getExpenses",
    "getMonthlyBudget",
    "getGoals",
];

export const PROPOSAL_TOOL_NAMES: readonly ProposalToolName[] = [
    "proposeExpense",
    "proposeBalanceUpdate",
    "proposeBudgetAdjustment",
];

export function isReadTool(name: string): name is ReadToolName {
    return (READ_TOOL_NAMES as readonly string[]).includes(name);
}

export function isProposalTool(name: string): name is ProposalToolName {
    return (PROPOSAL_TOOL_NAMES as readonly string[]).includes(name);
}

export interface AiToolContext {
    perspective: Perspective;
    activeMemberId?: string;
    todayIso?: string;
}

export interface ProposedExpensePayload {
    item: string;
    amount: number;
    date: string;
    payerId: string;
    payerName?: string;
    categoryId?: string | null;
    categoryName?: string;
    isShared: boolean;
    splitRatio: number;
    remarks?: string;
}

export interface ProposedBalanceUpdatePayload {
    accountId: string;
    accountName: string;
    previousBalance?: number;
    newBalance: number;
    date: string;
    notes?: string;
}

export interface ProposedBudgetAdjustmentPayload {
    budgetId?: string;
    month: string;
    ownerId?: string;
    grossSalary?: number;
    bonus?: number;
    cpfDeduction?: number;
    taxesDeduction?: number;
    insuranceDeduction?: number;
    notes?: string;
}

export type ProposedAction =
    | {
          id: string;
          type: "proposeExpense";
          title: string;
          payload: ProposedExpensePayload;
          status: "pending" | "confirmed" | "cancelled" | "error";
          errorMessage?: string;
      }
    | {
          id: string;
          type: "proposeBalanceUpdate";
          title: string;
          payload: ProposedBalanceUpdatePayload;
          status: "pending" | "confirmed" | "cancelled" | "error";
          errorMessage?: string;
      }
    | {
          id: string;
          type: "proposeBudgetAdjustment";
          title: string;
          payload: ProposedBudgetAdjustmentPayload;
          status: "pending" | "confirmed" | "cancelled" | "error";
          errorMessage?: string;
      };

export const BUBBY_TOOLS: GeminiFunctionDeclaration[] = [
    {
        name: "getHouseholdOverview",
        description:
            "Get household summary including members, total net worth, liquid cash, investments, CPF, and currency.",
        parameters: {
            type: "OBJECT",
            properties: {},
        },
    },
    {
        name: "getAccounts",
        description:
            "List bank, investment, CPF, and cash accounts with their IDs, names, types, and current balances.",
        parameters: {
            type: "OBJECT",
            properties: {
                perspective: {
                    type: "STRING",
                    description:
                        "Optional perspective filter: 'household' for all accounts or a specific member key/ID.",
                },
            },
        },
    },
    {
        name: "getExpenses",
        description:
            "List expenses for a given month or search query. Defaults to the current month.",
        parameters: {
            type: "OBJECT",
            properties: {
                month: {
                    type: "STRING",
                    description: "Month in YYYY-MM format (e.g. '2026-11').",
                },
                search: {
                    type: "STRING",
                    description:
                        "Optional keyword to filter expense item names or remarks.",
                },
                categoryId: {
                    type: "STRING",
                    description: "Optional category ID filter.",
                },
                limit: {
                    type: "INTEGER",
                    description:
                        "Maximum number of expenses to return (default 40, max 100).",
                },
            },
        },
    },
    {
        name: "getMonthlyBudget",
        description:
            "Get monthly budget breakdown, disposable pool, category allocations, actual spend, and remaining budget.",
        parameters: {
            type: "OBJECT",
            properties: {
                month: {
                    type: "STRING",
                    description:
                        "Month in YYYY-MM format (defaults to current month).",
                },
                memberId: {
                    type: "STRING",
                    description: "Optional household member ID.",
                },
            },
        },
    },
    {
        name: "getGoals",
        description:
            "Get all household savings goals with target amounts, current progress, and target dates.",
        parameters: {
            type: "OBJECT",
            properties: {},
        },
    },
    {
        name: "proposeExpense",
        description:
            "Propose logging a new expense for the user to review and confirm before saving.",
        parameters: {
            type: "OBJECT",
            properties: {
                item: {
                    type: "STRING",
                    description:
                        "Short expense description (e.g. 'Chicken rice lunch').",
                },
                amount: {
                    type: "NUMBER",
                    description: "Positive expense amount in SGD.",
                },
                date: {
                    type: "STRING",
                    description: "Expense date in YYYY-MM-DD format.",
                },
                categoryName: {
                    type: "STRING",
                    description:
                        "Category name (e.g. 'Food & Dining', 'Groceries', 'Transport').",
                },
                categoryId: {
                    type: "STRING",
                    description: "Optional exact category ID if known.",
                },
                isShared: {
                    type: "BOOLEAN",
                    description:
                        "Whether the expense is shared with partner (default false).",
                },
                splitRatio: {
                    type: "NUMBER",
                    description:
                        "Partner's share from 0 to 1 when shared (default 0.5).",
                },
                remarks: {
                    type: "STRING",
                    description: "Optional short note.",
                },
            },
            required: ["item", "amount"],
        },
    },
    {
        name: "proposeBalanceUpdate",
        description:
            "Propose updating an account balance for the user to review and confirm before saving.",
        parameters: {
            type: "OBJECT",
            properties: {
                accountId: {
                    type: "STRING",
                    description: "Account ID if known from getAccounts.",
                },
                accountName: {
                    type: "STRING",
                    description:
                        "Account name to match (e.g. 'DBS Multiplier').",
                },
                newBalance: {
                    type: "NUMBER",
                    description: "New account balance in SGD.",
                },
                date: {
                    type: "STRING",
                    description: "Snapshot date in YYYY-MM-DD format.",
                },
                notes: {
                    type: "STRING",
                    description: "Optional short note for the balance update.",
                },
            },
            required: ["newBalance"],
        },
    },
    {
        name: "proposeBudgetAdjustment",
        description:
            "Propose updating monthly budget income, bonus, deductions, or notes for the user to review and confirm.",
        parameters: {
            type: "OBJECT",
            properties: {
                month: {
                    type: "STRING",
                    description:
                        "Month in YYYY-MM format (defaults to current month).",
                },
                grossSalary: {
                    type: "NUMBER",
                    description: "Updated monthly gross salary in SGD.",
                },
                bonus: {
                    type: "NUMBER",
                    description: "Updated monthly bonus in SGD.",
                },
                cpfDeduction: {
                    type: "NUMBER",
                    description: "Updated CPF deduction in SGD.",
                },
                taxesDeduction: {
                    type: "NUMBER",
                    description: "Updated tax deduction in SGD.",
                },
                insuranceDeduction: {
                    type: "NUMBER",
                    description: "Updated insurance deduction in SGD.",
                },
                notes: {
                    type: "STRING",
                    description: "Optional note on the monthly budget.",
                },
            },
        },
    },
];

function getTodayIso(context?: AiToolContext): string {
    if (context?.todayIso) return context.todayIso;
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

function getCurrentMonth(context?: AiToolContext): string {
    return getTodayIso(context).slice(0, 7);
}

function toFiniteNumber(val: unknown): number | undefined {
    if (typeof val === "number" && Number.isFinite(val)) return val;
    if (typeof val === "string" && val.trim() !== "") {
        const parsed = Number(val);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
}

/**
 * Builds the system prompt with current date & active perspective so Gemini
 * produces grounded SGD answers and uses tools accurately.
 */
export function buildBubbySystemInstruction(context: AiToolContext): string {
    const today = getTodayIso(context);
    const month = today.slice(0, 7);
    return [
        "You are Bubby, a friendly, concise financial assistant for the Budget Bubby app (currency: SGD / S$).",
        `Today's date is ${today} (current month: ${month}). Active perspective: ${context.perspective}.`,
        "Use read tools (getHouseholdOverview, getAccounts, getExpenses, getMonthlyBudget, getGoals) to look up real numbers before answering budget questions.",
        "Never invent balances, expenses, or budget numbers. Format currency as S$X,XXX.XX.",
        "When the user asks to log an expense, update an account balance, or adjust a monthly budget, call the corresponding propose* tool (proposeExpense, proposeBalanceUpdate, proposeBudgetAdjustment).",
        "If an account ID is needed for proposeBalanceUpdate, call getAccounts first so you match the exact account.",
        "Keep replies concise, warm, and scannable.",
    ].join(" ");
}

/** Executes a read-only Gemini tool call against financeService. */
export async function executeReadTool(
    name: ReadToolName,
    args: Record<string, unknown>,
    context: AiToolContext,
): Promise<Record<string, unknown>> {
    switch (name) {
        case "getHouseholdOverview": {
            const overview = await financeService.getHouseholdOverview();
            return {
                householdName: overview.household.name,
                currency: overview.household.currency,
                members: overview.members.map((m) => ({
                    id: m.id,
                    name: m.display_name,
                    role: m.role,
                })),
                totalAssets: overview.totalAssets,
                trueNetWorth: overview.trueNetWorth,
                settlementText: overview.settlementSummary.settlementText,
                activeGoalsCount: overview.activeGoals.length,
                upcomingBillsCount: overview.upcomingBills.length,
            };
        }
        case "getAccounts": {
            const perspective =
                typeof args.perspective === "string" && args.perspective.trim()
                    ? args.perspective.trim()
                    : context.perspective;
            const accounts = await financeService.getAccounts(perspective);
            return {
                perspective,
                count: accounts.length,
                accounts: accounts.map((a) => ({
                    id: a.id,
                    name: a.name,
                    type: a.type,
                    balance: a.balance,
                    institution: a.institution ?? null,
                    isJoint: a.is_joint,
                    ownerId: a.owner_id,
                })),
            };
        }
        case "getExpenses": {
            const month =
                typeof args.month === "string" && args.month.trim()
                    ? args.month.trim()
                    : getCurrentMonth(context);
            const search =
                typeof args.search === "string" && args.search.trim()
                    ? args.search.trim()
                    : undefined;
            const categoryId =
                typeof args.categoryId === "string" && args.categoryId.trim()
                    ? args.categoryId.trim()
                    : undefined;
            const rawLimit = toFiniteNumber(args.limit);
            const limit = Math.min(Math.max(Math.round(rawLimit ?? 40), 1), 100);

            const [expenses, categories] = await Promise.all([
                financeService.getExpenses({
                    month,
                    search,
                    categoryId,
                    payerId:
                        context.perspective !== "household"
                            ? context.activeMemberId
                            : undefined,
                }),
                financeService.getCategories(),
            ]);

            const categoryMap = new Map(categories.map((c) => [c.id, c.name]));
            const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

            return {
                month,
                totalCount: expenses.length,
                totalAmount,
                expenses: expenses.slice(0, limit).map((e) => ({
                    id: e.id,
                    date: e.date,
                    item: e.item,
                    amount: e.amount,
                    category: e.category_id
                        ? (categoryMap.get(e.category_id) ?? "Uncategorized")
                        : "Uncategorized",
                    isShared: e.is_shared,
                    remarks: e.remarks ?? null,
                })),
            };
        }
        case "getMonthlyBudget": {
            const month =
                typeof args.month === "string" && args.month.trim()
                    ? args.month.trim()
                    : getCurrentMonth(context);
            const memberId =
                typeof args.memberId === "string" && args.memberId.trim()
                    ? args.memberId.trim()
                    : context.activeMemberId;

            const detail = await financeService.getMonthlyBudget(
                month,
                memberId,
            );
            return {
                month: detail.budget.month,
                budgetId: detail.budget.id,
                grossSalary: detail.budget.gross_salary,
                bonus: detail.budget.bonus,
                afterDeductions: detail.budget.after_deductions,
                disposablePool: detail.disposablePool,
                totalSpent: detail.totalSpent,
                totalRemaining: detail.totalRemaining,
                categories: detail.categories.map((c) => ({
                    categoryId: c.category_id,
                    name: c.category?.name ?? c.category_id,
                    allocated: c.allocated_amount,
                    spent: c.actualSpent ?? 0,
                    remaining:
                        c.remaining ?? c.allocated_amount - (c.actualSpent ?? 0),
                })),
            };
        }
        case "getGoals": {
            const goals = await financeService.getGoals();
            return {
                count: goals.length,
                goals: goals.map((g) => ({
                    id: g.id,
                    title: g.title,
                    targetAmount: g.target_amount,
                    savedSoFar: g.saved_so_far,
                    remaining: Math.max(0, g.target_amount - g.saved_so_far),
                    targetDate: g.target_date,
                    status: g.status,
                })),
            };
        }
    }
}

/**
 * Converts a Gemini `propose*` tool call into a structured, reviewable
 * ProposedAction card without mutating any data.
 */
export async function buildProposedAction(
    name: ProposalToolName,
    args: Record<string, unknown>,
    context: AiToolContext,
): Promise<ProposedAction> {
    const today = getTodayIso(context);

    if (name === "proposeExpense") {
        const item =
            typeof args.item === "string" && args.item.trim()
                ? args.item.trim()
                : "New expense";
        const amount = Math.abs(toFiniteNumber(args.amount) ?? 0);
        const date =
            typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
                ? args.date
                : today;
        const isShared = Boolean(args.isShared);
        const splitRatio = isShared
            ? Math.min(Math.max(toFiniteNumber(args.splitRatio) ?? 0.5, 0), 1)
            : 0;
        const remarks =
            typeof args.remarks === "string" && args.remarks.trim()
                ? args.remarks.trim()
                : undefined;

        const [overview, categories] = await Promise.all([
            financeService.getHouseholdOverview(),
            financeService.getCategories(),
        ]);

        const payer =
            overview.members.find((m) => m.id === context.activeMemberId) ??
            overview.members[0];

        let matchedCategory =
            typeof args.categoryId === "string"
                ? categories.find((c) => c.id === args.categoryId)
                : undefined;

        if (!matchedCategory && typeof args.categoryName === "string") {
            const query = args.categoryName.trim().toLowerCase();
            matchedCategory =
                categories.find((c) => c.name.toLowerCase() === query) ??
                categories.find((c) => c.name.toLowerCase().includes(query));
        }

        return {
            id: generateUuid(),
            type: "proposeExpense",
            title: "Log Expense",
            status: "pending",
            payload: {
                item,
                amount,
                date,
                payerId: payer?.id ?? context.activeMemberId ?? "",
                payerName: payer?.display_name,
                categoryId: matchedCategory?.id ?? null,
                categoryName:
                    matchedCategory?.name ??
                    (typeof args.categoryName === "string"
                        ? args.categoryName
                        : undefined),
                isShared,
                splitRatio,
                remarks,
            },
        };
    }

    if (name === "proposeBalanceUpdate") {
        const newBalance = toFiniteNumber(args.newBalance) ?? 0;
        const date =
            typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
                ? args.date
                : today;
        const notes =
            typeof args.notes === "string" && args.notes.trim()
                ? args.notes.trim()
                : undefined;

        const accounts = await financeService.getAccounts("household");
        let matched =
            typeof args.accountId === "string"
                ? accounts.find((a) => a.id === args.accountId)
                : undefined;

        if (!matched && typeof args.accountName === "string") {
            const query = args.accountName.trim().toLowerCase();
            matched =
                accounts.find((a) => a.name.toLowerCase() === query) ??
                accounts.find((a) => a.name.toLowerCase().includes(query));
        }

        return {
            id: generateUuid(),
            type: "proposeBalanceUpdate",
            title: "Update Balance",
            status: "pending",
            payload: {
                accountId:
                    matched?.id ??
                    (typeof args.accountId === "string" ? args.accountId : ""),
                accountName:
                    matched?.name ??
                    (typeof args.accountName === "string"
                        ? args.accountName
                        : "Unknown Account"),
                previousBalance: matched?.balance,
                newBalance,
                date,
                notes,
            },
        };
    }

    // proposeBudgetAdjustment
    const month =
        typeof args.month === "string" && /^\d{4}-\d{2}$/.test(args.month)
            ? args.month
            : getCurrentMonth(context);

    let budgetId: string | undefined;
    let ownerId: string | undefined = context.activeMemberId;
    try {
        const detail = await financeService.getMonthlyBudget(
            month,
            context.activeMemberId,
        );
        budgetId = detail.budget.id;
        ownerId = detail.budget.owner_id;
    } catch {
        // Proceed without existing budget ID
    }

    return {
        id: generateUuid(),
        type: "proposeBudgetAdjustment",
        title: "Adjust Budget",
        status: "pending",
        payload: {
            budgetId,
            month,
            ownerId,
            grossSalary: toFiniteNumber(args.grossSalary),
            bonus: toFiniteNumber(args.bonus),
            cpfDeduction: toFiniteNumber(args.cpfDeduction),
            taxesDeduction: toFiniteNumber(args.taxesDeduction),
            insuranceDeduction: toFiniteNumber(args.insuranceDeduction),
            notes:
                typeof args.notes === "string" && args.notes.trim()
                    ? args.notes.trim()
                    : undefined,
        },
    };
}

/**
 * Executes a user-confirmed ProposedAction via financeService and invalidates
 * relevant TanStack Query caches so all pages refresh immediately.
 */
export async function executeProposedAction(
    action: ProposedAction,
    qc: QueryClient = defaultQueryClient,
): Promise<void> {
    if (action.type === "proposeExpense") {
        const { payload } = action;
        if (!payload.item.trim()) {
            throw new Error("Expense item description is required.");
        }
        if (payload.amount <= 0) {
            throw new Error("Expense amount must be greater than zero.");
        }
        if (!payload.payerId) {
            throw new Error("No household member available to log this expense.");
        }

        const input: CreateExpenseInput = {
            payer_id: payload.payerId,
            category_id: payload.categoryId ?? null,
            date: payload.date,
            item: payload.item,
            amount: payload.amount,
            is_shared: payload.isShared,
            split_ratio: payload.isShared ? payload.splitRatio : 0,
            remarks: payload.remarks,
        };
        await financeService.addExpense(input);

        await Promise.all([
            qc.invalidateQueries({ queryKey: ["finance", "expenses"] }),
            qc.invalidateQueries({ queryKey: queryKeys.allExpenses }),
            qc.invalidateQueries({ queryKey: ["finance", "monthly-budget"] }),
            qc.invalidateQueries({ queryKey: ["finance", "daily-checkins"] }),
            qc.invalidateQueries({ queryKey: queryKeys.householdOverview }),
        ]);
        return;
    }

    if (action.type === "proposeBalanceUpdate") {
        const { payload } = action;
        if (!payload.accountId) {
            throw new Error(
                `Could not match account "${payload.accountName}". Please check the account name.`,
            );
        }

        await financeService.updateAccountBalance(
            payload.accountId,
            payload.newBalance,
            payload.notes,
            payload.date,
        );

        await Promise.all([
            qc.invalidateQueries({ queryKey: ["finance", "accounts"] }),
            qc.invalidateQueries({ queryKey: queryKeys.householdOverview }),
            qc.invalidateQueries({ queryKey: queryKeys.goals }),
        ]);
        return;
    }

    // proposeBudgetAdjustment
    const { payload } = action;
    const budgetUpdate: Partial<MonthlyBudget> & { id?: string } = {
        id: payload.budgetId,
        month: payload.month,
        owner_id: payload.ownerId,
    };
    if (payload.grossSalary !== undefined) {
        budgetUpdate.gross_salary = payload.grossSalary;
    }
    if (payload.bonus !== undefined) {
        budgetUpdate.bonus = payload.bonus;
    }
    if (payload.cpfDeduction !== undefined) {
        budgetUpdate.cpf_deduction = payload.cpfDeduction;
    }
    if (payload.taxesDeduction !== undefined) {
        budgetUpdate.taxes_deduction = payload.taxesDeduction;
    }
    if (payload.insuranceDeduction !== undefined) {
        budgetUpdate.insurance_deduction = payload.insuranceDeduction;
    }
    if (payload.notes !== undefined) {
        budgetUpdate.notes = payload.notes;
    }

    await financeService.updateMonthlyBudget(budgetUpdate);

    await Promise.all([
        qc.invalidateQueries({ queryKey: ["finance", "monthly-budget"] }),
        qc.invalidateQueries({ queryKey: queryKeys.householdOverview }),
    ]);
}
