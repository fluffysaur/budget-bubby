/**
 * Supabase PostgreSQL Finance Service for Budget Bubby.
 * Directly queries Supabase tables using row-level security and schema mappings.
 */

import type {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
    AccountSnapshot,
    BaseBudgetProfile,
    BaseProfileAllocation,
    BulkBalanceUpdateItem,
    Category,
    CreateCategoryInput,
    UpdateCategoryInput,
    CreateExpenseInput,
    CreateGoalInput,
    CreateRecurringItemInput,
    Expense,
    ExpenseFilter,
    Household,
    HouseholdMember,
    HouseholdOverview,
    MonthlyBudget,
    MonthlyBudgetCategoryDetail,
    MonthlyBudgetDetail,
    Perspective,
    RecurringItem,
    SavingsGoal,
    UpdateExpenseInput,
    CreditCard,
    CreateCreditCardInput,
    CreditCardStatement,
    UpsertCreditCardStatementInput,
    DailyCheckin,
    CheckinType,
    NotificationPreferences,
    NotificationLogEntry,
    NotificationLogRef,
    PushSubscriptionInput,
    UpdateNotificationPreferencesInput,
    BonusEvent,
    SettleUpRecordInput,
    SettleUpsResult,
    BonusEventsResult,
    BonusSplitShare,
    SaveBonusEventInput,
} from "../types/finance";
import { getDefaultNotificationPreferences } from "../data/mockSeedData";
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";
import {
    calculateSharedExpenseSettlement,
    calculateGoalPacing,
    calculateCPFAndNetPay,
    calculateMemberRecurringDeductions,
    getMemberExpenseShare,
    isSpendableCategory,
} from "../lib/financialFormulas";
import {
    calculateRecurringCategorySpend,
    isSpendType,
    resolveDueDay,
} from "../lib/recurringItems";
import {
    getTodayDateString,
    addMonths,
    getCurrentSingaporeTime,
    getCurrentMonth,
} from "../lib/dateUtils";
import { isValidUuid } from "../lib/uuid";
import {
    BonusLogUnavailableError,
    isMissingRelationError,
} from "../lib/supabaseErrors";
import {
    cloneDefaultSplit,
    normalizeBonusSplit,
    summarizeBonusesForMonth,
} from "../lib/bonusFormulas";
import { PartialBulkAddError } from "./bulkAddError";
import {
    getLocalNotificationLog,
    claimLocalNotificationSend,
    markLocalNotificationsRead,
    dismissLocalNotification,
} from "./localNotificationLog";
import type { FinanceService } from "./financeService";
import { SupabaseInboxStore } from "./inbox/supabaseInboxStore";

export const PRESET_DEFAULT_CATEGORIES = [
    {
        name: "Food",
        color: "#F59E0B",
        icon: "utensils",
        group: "spendable" as const,
    },
    {
        name: "Lifestyle",
        color: "#EC4899",
        icon: "sparkles",
        group: "spendable" as const,
    },
    {
        name: "Transport",
        color: "#3B82F6",
        icon: "car",
        group: "spendable" as const,
    },
    {
        name: "Investments",
        color: "#10B981",
        icon: "trending-up",
        group: "allocation" as const,
    },
    {
        name: "Savings",
        color: "#6366F1",
        icon: "piggy-bank",
        group: "allocation" as const,
    },
    {
        name: "Tithing",
        color: "#8B5CF6",
        icon: "heart",
        group: "allocation" as const,
    },
    {
        name: "Buffer",
        color: "#64748B",
        icon: "shield",
        group: "spendable" as const,
    },
];

/**
 * Fills fields missing from older rows with defaults and trims Postgres
 * `time` values ("18:00:00") to "HH:MM".
 */
function normalizeNotificationPreferences(
    row: Record<string, unknown>,
    memberId: string,
    householdId: string,
): NotificationPreferences {
    const prefs = {
        ...getDefaultNotificationPreferences(memberId, householdId),
        ...(row as Partial<NotificationPreferences>),
    };
    for (const key of [
        "checkin_time",
        "quiet_hours_start",
        "quiet_hours_end",
    ] as const) {
        const value = prefs[key];
        if (typeof value === "string") prefs[key] = value.slice(0, 5);
    }
    return prefs;
}

/**
 * Compat for the optional categories."group" column. `undefined` = unknown,
 * `false` = known missing (skip it in writes), `true` = known present.
 */
let categoryGroupColumnSupported: boolean | undefined;

/** Test hook: forget what we learned about the categories."group" column. */
export function resetCategoryGroupColumnSupport(): void {
    categoryGroupColumnSupported = undefined;
}

/** Postgres 42703 (undefined column) or PostgREST PGRST204 (column not in schema cache). */
/** Maps a bonus_events row (with optional nested contributions) to a BonusEvent. */
function mapBonusEventRow(row: Record<string, unknown>): BonusEvent {
    const contributions = Array.isArray(row.bonus_goal_contributions)
        ? (row.bonus_goal_contributions as Array<{
              goal_id: string;
              amount: unknown;
          }>)
        : [];
    const gross = Number(row.gross) || 0;
    const cpf = Number(row.cpf) || 0;
    const split = Array.isArray(row.split)
        ? (row.split as BonusSplitShare[]).map((s) => ({
              key: s.key,
              pct: Number(s.pct) || 0,
              ...(s.amount !== undefined
                  ? { amount: Number(s.amount) || 0 }
                  : {}),
          }))
        : [];
    return {
        id: String(row.id),
        household_id: String(row.household_id ?? ""),
        recipient_id: String(row.recipient_id ?? ""),
        type: (row.type as BonusEvent["type"]) ?? "other",
        received_on: String(row.received_on ?? "").slice(0, 10),
        gross,
        cpf,
        net:
            row.net !== undefined && row.net !== null
                ? Number(row.net)
                : Math.round((gross - cpf) * 100) / 100,
        note: (row.note as string | null | undefined) ?? null,
        split,
        goal_contributions: contributions.map((c) => ({
            goal_id: c.goal_id,
            amount: Number(c.amount) || 0,
        })),
        created_by: (row.created_by as string | null | undefined) ?? null,
        created_at: row.created_at as string | undefined,
        updated_at: row.updated_at as string | undefined,
    };
}

function isMissingColumnError(
    error: { code?: string; message?: string } | null,
): boolean {
    if (!error) return false;
    return error.code === "42703" || error.code === "PGRST204";
}

/**
 * Quotes a value for a PostgREST `or()` ilike filter by wrapping `%value%` in
 * double quotes and escaping `\` and `"`.
 */
export function quotePostgrestIlikePattern(search: string): string {
    const escaped = search.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    return `"%${escaped}%"`;
}

export function buildExpenseSearchOrFilter(search: string): string {
    const quoted = quotePostgrestIlikePattern(search);
    return `item.ilike.${quoted},remarks.ilike.${quoted}`;
}

const POSTGREST_PAGE_SIZE = 1000;

type PaginatableQuery<T> = PromiseLike<{ data: T[] | null; error: unknown }> & {
    range?: (
        from: number,
        to: number,
    ) => PromiseLike<{ data: T[] | null; error: unknown }>;
};

async function fetchAllPages<T>(
    buildQuery: () => PaginatableQuery<T>,
): Promise<T[]> {
    const firstQuery = buildQuery();
    if (typeof firstQuery.range !== "function") {
        const { data, error } = await firstQuery;
        if (error) throw error;
        return (data || []) as T[];
    }

    const allRows: T[] = [];
    let offset = 0;

    while (true) {
        const query = offset === 0 ? firstQuery : buildQuery();
        const { data, error } = await query.range!(
            offset,
            offset + POSTGREST_PAGE_SIZE - 1,
        );
        if (error) throw error;
        const batch = (data || []) as T[];
        allRows.push(...batch);
        if (batch.length < POSTGREST_PAGE_SIZE) {
            break;
        }
        offset += POSTGREST_PAGE_SIZE;
    }

    return allRows;
}

export class SupabaseFinanceServiceImpl implements FinanceService {
    private readonly clientOverride?: SupabaseClient;
    private readonly localFallback: boolean;

    /**
     * @param client Supabase client to use. Defaults to the browser client,
     *   read on each call. The send-reminders function passes a service-role
     *   client.
     * @param options.localFallback When true (default), notification log calls
     *   fall back to the device-local log on errors. The server sets it false
     *   so errors surface instead of being recorded in memory.
     */
    /**
     * Whether the bonus log tables exist. `null` = not checked yet. Cached for
     * the session so budgets don't fire a failing request on every read; the
     * cache resets on reload, so the log appears once the migration is applied.
     */
    private bonusTableAvailable: boolean | null = null;
    private settleUpsTableAvailable: boolean | null = null;

    /** Test hook: forget what we learned about the bonus log tables. */
    public resetBonusLogAvailability(): void {
        this.bonusTableAvailable = null;
        this.settleUpsTableAvailable = null;
    }

    constructor(
        client?: SupabaseClient,
        options: { localFallback?: boolean } = {},
    ) {
        this.clientOverride = client;
        this.localFallback = options.localFallback ?? true;
        this.inbox = new SupabaseInboxStore(
            () => this.getClient(),
            () => this.getHouseholdId(),
        );
    }

    // Capture Inbox (implemented in ./inbox/supabaseInboxStore)
    private readonly inbox: SupabaseInboxStore;
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

    private getClient(): SupabaseClient {
        const client = this.clientOverride ?? supabase;
        if (!client) {
            throw new Error("Supabase client is not configured");
        }
        return client;
    }

    private async getHouseholdId(): Promise<string> {
        const client = this.getClient();
        const { data, error } = await client
            .from("households")
            .select("id")
            .limit(1)
            .maybeSingle();
        if (error) throw error;
        if (data?.id) return data.id;

        // Fallback 1: Check household_members to find household_id
        const { data: memberData } = await client
            .from("household_members")
            .select("household_id")
            .limit(1)
            .maybeSingle();
        if (memberData?.household_id) return memberData.household_id;

        // Fallback 2: Check if authenticated user needs their profile claimed
        let currentUserEmail = "unknown";
        try {
            const { data: authData } = await client.auth.getUser();
            if (authData?.user?.email) {
                currentUserEmail = authData.user.email;
                await client.rpc("claim_household_member_profile", {
                    user_email: authData.user.email,
                });

                // Retry after claiming
                const { data: retryHh } = await client
                    .from("households")
                    .select("id")
                    .limit(1)
                    .maybeSingle();
                if (retryHh?.id) return retryHh.id;

                const { data: retryMem } = await client
                    .from("household_members")
                    .select("household_id")
                    .limit(1)
                    .maybeSingle();
                if (retryMem?.household_id) return retryMem.household_id;
            }
        } catch (claimErr) {
            console.warn(
                "Auto-claim fallback in getHouseholdId encountered:",
                claimErr,
            );
        }

        throw new Error(
            `No accessible household found for authenticated user (${currentUserEmail}). Please ensure your user account is linked to a household member profile in the 'household_members' table.`,
        );
    }

    public async getHouseholdOverview(): Promise<HouseholdOverview> {
        const client = this.getClient();

        // 1. Fetch household
        const { data: householdData, error: hhError } = await client
            .from("households")
            .select("*")
            .limit(1)
            .maybeSingle();
        if (hhError) throw hhError;

        let household = householdData as Household;
        if (!household) {
            // Create or fallback
            household = {
                id: "00000000-0000-0000-0000-000000000001",
                name: "Household",
                currency: "SGD",
                created_at: new Date().toISOString(),
            };
        }

        // 2. Fetch members
        const { data: membersData, error: memError } = await client
            .from("household_members")
            .select("*")
            .eq("household_id", household.id)
            .order("created_at", { ascending: true });
        if (memError) throw memError;
        const members = (membersData || []) as HouseholdMember[];

        // 3. Fetch accounts for total assets
        const { data: accountsData, error: accError } = await client
            .from("accounts")
            .select("*")
            .eq("household_id", household.id);
        if (accError) throw accError;
        const accounts = (accountsData || []) as Account[];
        const totalAssets =
            Math.round(
                accounts.reduce((sum, a) => sum + Number(a.balance), 0) * 100,
            ) / 100;

        const trueNetWorth = totalAssets;

        // 5. Fetch unsettled shared expenses for couple settlement
        const { data: expensesData, error: expError } = await client
            .from("expenses")
            .select("*")
            .eq("household_id", household.id)
            .eq("is_shared", true)
            .eq("settled", false);
        if (expError) throw expError;
        const expenses = (expensesData || []) as Expense[];

        const m1 = members[0];
        const m2 = members[1];
        const settlementSummary =
            m1 && m2
                ? calculateSharedExpenseSettlement(
                      expenses,
                      m1.id,
                      m2.id,
                      m1.display_name,
                      m2.display_name,
                  )
                : {
                      netBalance: 0,
                      debtorId: null,
                      creditorId: null,
                      settlementText: "All settled up",
                      member1OwesMember2: 0,
                      member2OwesMember1: 0,
                  };

        // 6. Savings Goals
        const { data: goalsData, error: goalError } = await client
            .from("savings_goals")
            .select("*")
            .eq("household_id", household.id)
            .neq("status", "achieved");
        if (goalError) throw goalError;
        const activeGoals = (goalsData || []) as SavingsGoal[];

        // 7. Recurring Items
        const { data: recurringItemsData, error: polError } = await client
            .from("recurring_items")
            .select("*")
            .eq("household_id", household.id);
        if (polError) throw polError;
        const upcomingBills = (recurringItemsData || []) as RecurringItem[];

        return {
            household,
            members,
            totalAssets,
            trueNetWorth,
            settlementSummary,
            activeGoals,
            upcomingBills,
        };
    }

    public async getAccounts(perspective: Perspective): Promise<Account[]> {
        const client = this.getClient();
        let query = client.from("accounts").select("*");

        if (perspective !== "household") {
            const clean = perspective.toLowerCase();
            // Fetch members to find corresponding member ID
            const { data: members } = await client
                .from("household_members")
                .select("*");
            const targetMember = (members || []).find(
                (m: HouseholdMember) =>
                    m.id === perspective ||
                    m.display_name.toLowerCase().replace(/\s+/g, "") ===
                        clean ||
                    (clean === "yijia" &&
                        m.display_name.toLowerCase().includes("yi jia")) ||
                    (clean === "rachel" &&
                        m.display_name.toLowerCase().includes("rachel")),
            );

            if (!targetMember) {
                return [];
            }

            query = query.or(`owner_id.eq.${targetMember.id},is_joint.eq.true`);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as Account[];
    }

    public async createAccount(input: CreateAccountInput): Promise<Account> {
        const client = this.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.getHouseholdId();
        const balance = Math.round(input.balance * 100) / 100;

        const { data, error } = await client
            .from("accounts")
            .insert({
                household_id: householdId,
                owner_id: input.owner_id,
                name: input.name,
                type: input.type,
                balance,
                currency: input.currency || "SGD",
                institution: input.institution || null,
                is_joint: input.is_joint || false,
                notes: input.notes || null,
            })
            .select()
            .single();

        if (error) throw error;
        const createdAccount = data as Account;

        // Record initial snapshot
        await client.from("account_snapshots").insert({
            account_id: createdAccount.id,
            household_id: householdId,
            balance,
            snapshot_date: getTodayDateString(),
        });

        return createdAccount;
    }

    public async updateAccount(
        id: string,
        updates: UpdateAccountInput,
    ): Promise<Account> {
        const client = this.getClient();
        const payload: Record<string, unknown> = {
            updated_at: new Date().toISOString(),
        };
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.type !== undefined) payload.type = updates.type;
        if (updates.institution !== undefined)
            payload.institution = updates.institution;
        if (updates.owner_id !== undefined) payload.owner_id = updates.owner_id;
        if (updates.is_joint !== undefined) payload.is_joint = updates.is_joint;
        if (updates.notes !== undefined) payload.notes = updates.notes;

        const { data, error } = await client
            .from("accounts")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data as Account;
    }

    public async deleteAccount(id: string): Promise<void> {
        const client = this.getClient();
        const { error } = await client.from("accounts").delete().eq("id", id);
        if (error) throw error;
    }

    public async updateAccountBalance(
        accountId: string,
        newBalance: number,
        notes?: string,
        date?: string,
    ): Promise<Account> {
        const client = this.getClient();
        const rounded = Math.round(newBalance * 100) / 100;

        const updates: Record<string, unknown> = {
            balance: rounded,
            updated_at: new Date().toISOString(),
        };
        if (notes !== undefined) {
            updates.notes = notes || null;
        }

        // Update account balance
        const { data, error } = await client
            .from("accounts")
            .update(updates)
            .eq("id", accountId)
            .select()
            .single();
        if (error) throw error;

        const updatedAccount = data as Account;

        // Create snapshot
        const { error: snapError } = await client
            .from("account_snapshots")
            .insert({
                account_id: accountId,
                household_id: updatedAccount.household_id,
                balance: rounded,
                snapshot_date: date || getTodayDateString(),
            });
        if (snapError) {
            console.warn("Failed to insert account snapshot:", snapError);
        }

        return updatedAccount;
    }

    public async bulkUpdateAccountBalances(
        updates: BulkBalanceUpdateItem[],
        snapshotDate: string,
    ): Promise<Account[]> {
        const snapDate = snapshotDate || getTodayDateString();
        const results: Account[] = [];
        for (const item of updates) {
            const updated = await this.updateAccountBalance(
                item.accountId,
                item.balance,
                item.notes ?? undefined,
                snapDate,
            );
            results.push(updated);
        }
        return results;
    }

    public async getAccountSnapshots(
        accountId: string,
    ): Promise<AccountSnapshot[]> {
        const client = this.getClient();
        const { data, error } = await client
            .from("account_snapshots")
            .select("*")
            .eq("account_id", accountId)
            .order("snapshot_date", { ascending: true });
        if (error) throw error;
        return (data || []) as AccountSnapshot[];
    }

    public async getAllAccountSnapshots(
        perspective?: Perspective,
    ): Promise<AccountSnapshot[]> {
        const client = this.getClient();
        const fetchedSnaps = await fetchAllPages<AccountSnapshot>(
            () =>
                client
                    .from("account_snapshots")
                    .select("*")
                    .order("snapshot_date", {
                        ascending: false,
                    }) as unknown as PaginatableQuery<AccountSnapshot>,
        );
        const allSnaps = [...fetchedSnaps].sort((a, b) =>
            a.snapshot_date.localeCompare(b.snapshot_date),
        );

        if (!perspective || perspective === "household") {
            return allSnaps;
        }

        const visibleAccounts = await this.getAccounts(perspective);
        const visibleIds = new Set(visibleAccounts.map((a) => a.id));
        return allSnaps.filter((s) => visibleIds.has(s.account_id));
    }

    public async getBaseProfiles(): Promise<BaseBudgetProfile[]> {
        const client = this.getClient();
        const { data, error } = await client
            .from("base_budget_profiles")
            .select("*");
        if (error) throw error;
        return (data || []) as BaseBudgetProfile[];
    }

    public async getBaseAllocations(
        profileId?: string,
    ): Promise<BaseProfileAllocation[]> {
        const client = this.getClient();
        let query = client.from("base_profile_allocations").select("*");
        if (profileId) {
            query = query.eq("profile_id", profileId);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as BaseProfileAllocation[];
    }

    public async getCategories(): Promise<Category[]> {
        const client = this.getClient();
        const { data, error } = await client.from("categories").select("*");
        if (error) throw error;
        const cats = (data || []) as Category[];
        if (cats.length > 0) {
            return cats.map((row) => ({
                ...row,
                group:
                    row.group ??
                    (isSpendableCategory(row.name)
                        ? "spendable"
                        : "allocation"),
            }));
        }

        // Auto-seed recommended default categories if household has no categories in Supabase
        try {
            const householdId = await this.getHouseholdId();
            return await this.seedDefaultCategories(householdId);
        } catch (seedErr) {
            console.warn("Auto-seed default categories encountered:", seedErr);
            return [];
        }
    }

    public async seedDefaultCategories(
        explicitHouseholdId?: string,
    ): Promise<Category[]> {
        const client = this.getClient();
        const householdId =
            explicitHouseholdId || (await this.getHouseholdId());

        const rowsToInsert = PRESET_DEFAULT_CATEGORIES.map((preset) => ({
            household_id: householdId,
            name: preset.name,
            color: preset.color,
            icon: preset.icon,
            is_system: false,
        }));

        const { data, error } = await client
            .from("categories")
            .upsert(rowsToInsert, { onConflict: "household_id,name" })
            .select();

        if (error) throw error;
        return ((data || []) as Category[]).map((row) => ({
            ...row,
            group:
                row.group ??
                (isSpendableCategory(row.name) ? "spendable" : "allocation"),
        }));
    }

    public async addCategory(input: CreateCategoryInput): Promise<Category> {
        const client = this.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.getHouseholdId();

        const insertPayload: Record<string, unknown> = {
            household_id: householdId,
            name: input.name.trim(),
            color: input.color || "#64748B",
            icon: input.icon || "tag",
            is_system: input.is_system || false,
        };

        const wantsGroup =
            input.group !== undefined && categoryGroupColumnSupported !== false;
        if (wantsGroup) insertPayload.group = input.group;

        let { data, error } = await client
            .from("categories")
            .insert(insertPayload)
            .select()
            .single();

        if (error && wantsGroup && isMissingColumnError(error)) {
            // categories.group migration not applied yet: retry once without it.
            categoryGroupColumnSupported = false;
            delete insertPayload.group;
            ({ data, error } = await client
                .from("categories")
                .insert(insertPayload)
                .select()
                .single());
        } else if (!error && wantsGroup) {
            categoryGroupColumnSupported = true;
        }

        if (error) throw error;
        const row = data as Category;
        return {
            ...row,
            group:
                input.group ??
                row.group ??
                (isSpendableCategory(row.name) ? "spendable" : "allocation"),
        };
    }

    public async updateCategory(
        id: string,
        updates: UpdateCategoryInput,
    ): Promise<Category> {
        const client = this.getClient();
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name.trim();
        if (updates.color !== undefined) payload.color = updates.color;
        if (updates.icon !== undefined) payload.icon = updates.icon;

        const wantsGroup =
            updates.group !== undefined &&
            categoryGroupColumnSupported !== false;
        if (wantsGroup) payload.group = updates.group;

        const run = (body: Record<string, unknown>) =>
            Object.keys(body).length > 0
                ? client
                      .from("categories")
                      .update(body)
                      .eq("id", id)
                      .select()
                      .single()
                : client.from("categories").select("*").eq("id", id).single();

        let { data, error } = await run(payload);

        if (error && wantsGroup && isMissingColumnError(error)) {
            // categories.group migration not applied yet: retry once without it.
            categoryGroupColumnSupported = false;
            delete payload.group;
            ({ data, error } = await run(payload));
        } else if (!error && wantsGroup) {
            categoryGroupColumnSupported = true;
        }

        if (error) throw error;
        const row = data as Category;
        return {
            ...row,
            group:
                updates.group ??
                row.group ??
                (isSpendableCategory(row.name) ? "spendable" : "allocation"),
        };
    }

    public async deleteCategory(id: string): Promise<void> {
        const client = this.getClient();
        const { error } = await client.from("categories").delete().eq("id", id);

        if (error) throw error;
    }

    public async updateBaseProfile(
        profile: BaseBudgetProfile,
        allocations: BaseProfileAllocation[],
    ): Promise<void> {
        const client = this.getClient();

        // 1. Resolve household_id safely (prevent invalid syntax for type uuid like "hh-00000000-0001")
        let householdId = profile.household_id;
        if (!isValidUuid(householdId)) {
            householdId = await this.getHouseholdId();
        }

        // 2. Reject non-UUID owner_id in Supabase mode
        const ownerId = profile.owner_id;
        if (!isValidUuid(ownerId)) {
            throw new Error(`Invalid member ID for base profile: "${ownerId}"`);
        }

        // Validate all allocation category IDs upfront before mutating anything
        for (const alloc of allocations) {
            if (!isValidUuid(alloc.category_id)) {
                throw new Error(
                    `Invalid category ID in base profile allocation: "${alloc.category_id}"`,
                );
            }
        }

        // 3. Resolve profile.id: reuse existing row ID for (household_id, owner_id) if one exists
        const { data: existingProf } = await client
            .from("base_budget_profiles")
            .select("id")
            .eq("household_id", householdId)
            .eq("owner_id", ownerId)
            .maybeSingle();

        let profileId: string | undefined;
        if (existingProf?.id) {
            profileId = existingProf.id;
        } else if (isValidUuid(profile.id)) {
            profileId = profile.id;
        } else if (typeof crypto !== "undefined" && crypto.randomUUID) {
            profileId = crypto.randomUUID();
        }

        const parsedCpfRate = Number(profile.cpf_employee_rate);
        const cpfEmployeeRate = Number.isFinite(parsedCpfRate)
            ? parsedCpfRate
            : 0.2;

        const profileUpsertPayload: Record<string, unknown> = {
            household_id: householdId,
            owner_id: ownerId,
            gross_salary: Number(profile.gross_salary) || 0,
            cpf_employee_rate: cpfEmployeeRate,
            tithing_enabled: profile.tithing_enabled ?? true,
            updated_at: new Date().toISOString(),
        };
        if (profileId) {
            profileUpsertPayload.id = profileId;
        }

        const { data: savedProfile, error: profError } = await client
            .from("base_budget_profiles")
            .upsert(profileUpsertPayload, {
                onConflict: "household_id,owner_id",
            })
            .select("id")
            .single();
        if (profError) throw profError;

        const finalProfileId = savedProfile?.id || profileId;
        if (!finalProfileId) {
            throw new Error("Failed to resolve base budget profile ID");
        }

        // 4. Upsert new allocations first, then delete stale rows so a failed write never wipes existing allocations
        if (allocations.length > 0) {
            const sanitizedAllocations = allocations.map((alloc) => {
                const catId = alloc.category_id;
                const allocRow: Record<string, unknown> = {
                    profile_id: finalProfileId,
                    category_id: catId,
                    target_percentage: Number(alloc.target_percentage) || 0,
                };

                if (isValidUuid(alloc.id)) {
                    allocRow.id = alloc.id;
                } else if (typeof crypto !== "undefined" && crypto.randomUUID) {
                    allocRow.id = crypto.randomUUID();
                }

                return allocRow;
            });

            const { error: upsertError } = await client
                .from("base_profile_allocations")
                .upsert(sanitizedAllocations, {
                    onConflict: "profile_id,category_id",
                });
            if (upsertError) throw upsertError;

            const keepCategoryIds = sanitizedAllocations.map(
                (a) => a.category_id as string,
            );
            const deleteChain = client
                .from("base_profile_allocations")
                .delete()
                .eq("profile_id", finalProfileId) as unknown as {
                not?: (
                    column: string,
                    operator: string,
                    value: string,
                ) => PromiseLike<{ error: unknown }>;
            } & PromiseLike<{ error: unknown }>;

            const { error: delError } =
                typeof deleteChain.not === "function"
                    ? await deleteChain.not(
                          "category_id",
                          "in",
                          `(${keepCategoryIds.join(",")})`,
                      )
                    : await deleteChain;
            if (delError) throw delError;
        } else {
            const { error: delError } = await client
                .from("base_profile_allocations")
                .delete()
                .eq("profile_id", finalProfileId);
            if (delError) throw delError;
        }

        // 5. Synchronize unlocked monthly budgets for current and future months for this member.
        // Past months (month < currentMonth) and locked months are frozen and never modified.
        const currentMonth = getCurrentMonth();
        const { data: unlockedBudgets, error: fetchBudgetError } = await client
            .from("monthly_budgets")
            .select("*")
            .eq("owner_id", ownerId)
            .gte("month", currentMonth)
            .eq("is_locked", false);

        if (
            !fetchBudgetError &&
            unlockedBudgets &&
            unlockedBudgets.length > 0
        ) {
            const recurringItems = await this.getRecurringItems();
            const newGross = Number(profile.gross_salary) || 0;
            const newCpf = calculateCPFAndNetPay(
                newGross,
                cpfEmployeeRate,
            ).cpfDeduction;

            for (const mb of unlockedBudgets) {
                const { taxesMonthly, insuranceMonthly } =
                    calculateMemberRecurringDeductions(
                        recurringItems,
                        ownerId,
                        mb.month,
                    );
                const newAfterDeductions =
                    Math.round(
                        (newGross - newCpf - taxesMonthly - insuranceMonthly) *
                            100,
                    ) / 100;

                const { error: updateBudgetError } = await client
                    .from("monthly_budgets")
                    .update({
                        gross_salary: newGross,
                        cpf_deduction: newCpf,
                        taxes_deduction: taxesMonthly,
                        insurance_deduction: insuranceMonthly,
                        after_deductions: newAfterDeductions,
                    })
                    .eq("id", mb.id);
                if (updateBudgetError) throw updateBudgetError;

                // Re-sync monthly_budget_categories for this unlocked budget
                const { error: delCatError } = await client
                    .from("monthly_budget_categories")
                    .delete()
                    .eq("monthly_budget_id", mb.id);
                if (delCatError) throw delCatError;

                if (allocations.length > 0) {
                    const catAllocInserts = allocations.map((alloc) => {
                        const allocId =
                            typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : undefined;
                        const targetPct = Number(alloc.target_percentage) || 0;
                        return {
                            ...(allocId ? { id: allocId } : {}),
                            monthly_budget_id: mb.id,
                            category_id: alloc.category_id,
                            percentage: targetPct,
                            allocated_amount:
                                Math.round(
                                    newAfterDeductions * targetPct * 100,
                                ) / 100,
                        };
                    });
                    const { error: insertCatError } = await client
                        .from("monthly_budget_categories")
                        .insert(catAllocInserts);
                    if (insertCatError) throw insertCatError;
                }
            }
        }
    }

    public async getMonthlyBudget(
        month: string,
        memberId?: string,
    ): Promise<MonthlyBudgetDetail> {
        const client = this.getClient();
        const currentMonth = getCurrentMonth();
        const isPastMonth = month < currentMonth;

        let targetMemberId = memberId;
        if (!targetMemberId) {
            const { data: membersData } = await client
                .from("household_members")
                .select("id")
                .limit(1);
            if (membersData && membersData.length > 0) {
                targetMemberId = membersData[0].id;
            }
        }

        let query = client
            .from("monthly_budgets")
            .select("*")
            .eq("month", month);
        if (targetMemberId) {
            query = query.eq("owner_id", targetMemberId);
        }

        const { data: budgetData, error: budgetError } = await query
            .limit(1)
            .maybeSingle();
        if (budgetError) throw budgetError;

        type CategoryAllocRow = {
            id: string;
            monthly_budget_id: string;
            category_id: string;
            percentage: number;
            allocated_amount: number;
            categories?: Category;
        };

        let budget: MonthlyBudget;
        let catAllocData: CategoryAllocRow[];

        if (budgetData) {
            budget = budgetData as MonthlyBudget;
            if (isPastMonth && !budget.is_locked) {
                const { error: lockError } = await client
                    .from("monthly_budgets")
                    .update({ is_locked: true })
                    .eq("id", budget.id);
                if (!lockError) {
                    budget = { ...budget, is_locked: true };
                }
            }
            const { data: allocRows, error: catAllocError } = await client
                .from("monthly_budget_categories")
                .select("*, categories(*)")
                .eq("monthly_budget_id", budget.id);
            if (catAllocError) throw catAllocError;
            catAllocData = (allocRows as unknown as CategoryAllocRow[]) || [];
        } else {
            const [profs, _allCats, recurringItems, householdId] =
                await Promise.all([
                    this.getBaseProfiles(),
                    this.getCategories(),
                    this.getRecurringItems(),
                    this.getHouseholdId(),
                ]);

            const baseProfile = profs.find(
                (p) => p.owner_id === targetMemberId,
            );
            const ownerId = targetMemberId || "";

            if (!baseProfile) {
                // Partner with no base profile gets an empty "no profile" budget, not the other partner's profile
                budget = {
                    id: `mb-dyn-${month}-${ownerId || "empty"}`,
                    household_id: householdId || "",
                    owner_id: ownerId,
                    month,
                    gross_salary: 0,
                    bonus: 0,
                    cpf_deduction: 0,
                    taxes_deduction: 0,
                    insurance_deduction: 0,
                    after_deductions: 0,
                    notes: "No base budget profile configured",
                    is_locked: isPastMonth,
                };
                catAllocData = [];
            } else {
                const gross = Number(baseProfile.gross_salary) || 0;
                const rate = Number(baseProfile.cpf_employee_rate) || 0.2;
                const cpf = calculateCPFAndNetPay(gross, rate).cpfDeduction;

                const {
                    taxesMonthly: taxesDeduction,
                    insuranceMonthly: insuranceDeduction,
                } = calculateMemberRecurringDeductions(
                    recurringItems,
                    ownerId,
                    month,
                );
                const afterDeductions =
                    Math.round(
                        (gross - cpf - taxesDeduction - insuranceDeduction) *
                            100,
                    ) / 100;

                const newBudgetId =
                    typeof crypto !== "undefined" && crypto.randomUUID
                        ? crypto.randomUUID()
                        : undefined;

                const budgetInsertPayload: Record<string, unknown> = {
                    household_id: baseProfile.household_id || householdId,
                    owner_id: ownerId,
                    month,
                    gross_salary: gross,
                    bonus: 0,
                    cpf_deduction: cpf,
                    taxes_deduction: taxesDeduction,
                    insurance_deduction: insuranceDeduction,
                    after_deductions: afterDeductions,
                    notes: "Generated monthly budget",
                    is_locked: isPastMonth,
                };
                if (newBudgetId) {
                    budgetInsertPayload.id = newBudgetId;
                }

                const { data: insertedBudget, error: insertError } =
                    await client
                        .from("monthly_budgets")
                        .insert(budgetInsertPayload)
                        .select("*")
                        .single();

                if (insertError) {
                    // If conflict (e.g. concurrent creation), retry select
                    const { data: existingData, error: selectError } =
                        await client
                            .from("monthly_budgets")
                            .select("*")
                            .eq("month", month)
                            .eq("owner_id", ownerId)
                            .maybeSingle();
                    if (selectError || !existingData) {
                        throw insertError;
                    }
                    budget = existingData as MonthlyBudget;
                } else {
                    budget = insertedBudget as MonthlyBudget;
                }

                const baseAllocs = await this.getBaseAllocations(
                    baseProfile.id,
                );
                if (baseAllocs.length > 0) {
                    const catAllocInserts = baseAllocs.map((alloc) => {
                        const allocId =
                            typeof crypto !== "undefined" && crypto.randomUUID
                                ? crypto.randomUUID()
                                : undefined;
                        const targetPct = Number(alloc.target_percentage) || 0;
                        return {
                            ...(allocId ? { id: allocId } : {}),
                            monthly_budget_id: budget.id,
                            category_id: alloc.category_id,
                            percentage: targetPct,
                            allocated_amount:
                                Math.round(afterDeductions * targetPct * 100) /
                                100,
                        };
                    });

                    const { error: catInsertError } = await client
                        .from("monthly_budget_categories")
                        .insert(catAllocInserts);
                    if (catInsertError) {
                        console.warn(
                            "Failed to insert monthly_budget_categories:",
                            catInsertError,
                        );
                    }
                }

                const { data: allocRows, error: catAllocError } = await client
                    .from("monthly_budget_categories")
                    .select("*, categories(*)")
                    .eq("monthly_budget_id", budget.id);
                if (catAllocError) throw catAllocError;
                catAllocData =
                    (allocRows as unknown as CategoryAllocRow[]) || [];
            }
        }

        const nextMonth = addMonths(month, 1);
        const [
            { data: expensesData, error: expError },
            recurringItems,
            monthBonusEvents,
        ] = await Promise.all([
            client
                .from("expenses")
                .select("*")
                .gte("date", `${month}-01`)
                .lt("date", `${nextMonth}-01`),
            this.getRecurringItems(),
            this.getMonthBonusEvents(month, budget.owner_id),
        ]);
        if (expError) throw expError;

        // Bonus is income, not budget: it never feeds after_deductions or category caps.
        const legacyBonus = Number(budgetData?.bonus || 0);
        const bonusSummary = summarizeBonusesForMonth(
            monthBonusEvents ?? [],
            month,
            budget.owner_id,
            legacyBonus,
        );

        const expenses = (expensesData || []) as Expense[];
        if (
            budgetData &&
            !budget.is_locked &&
            recurringItems &&
            recurringItems.length > 0
        ) {
            const hasTaxOrInsItems = recurringItems.some(
                (p) =>
                    (p.type === "tax" || p.type === "insurance") &&
                    (!budget.owner_id ||
                        p.owner_id === budget.owner_id ||
                        p.owner_id === "joint"),
            );
            if (hasTaxOrInsItems) {
                const { taxesMonthly, insuranceMonthly } =
                    calculateMemberRecurringDeductions(
                        recurringItems,
                        budget.owner_id,
                        month,
                    );
                budget = {
                    ...budget,
                    taxes_deduction: taxesMonthly,
                    insurance_deduction: insuranceMonthly,
                    after_deductions:
                        Math.round(
                            (Number(budget.gross_salary) -
                                Number(budget.cpf_deduction) -
                                taxesMonthly -
                                insuranceMonthly) *
                                100,
                        ) / 100,
                };
                catAllocData = catAllocData.map((row) => ({
                    ...row,
                    allocated_amount:
                        Math.round(
                            budget.after_deductions *
                                Number(row.percentage) *
                                100,
                        ) / 100,
                }));
            }
        }
        // Legacy rows stored after_deductions with the hand-entered bonus added.
        // Unlocked months are normalized to salary take-home; locked months stay frozen.
        if (budgetData && !budget.is_locked && legacyBonus > 0) {
            budget = {
                ...budget,
                after_deductions:
                    Math.round(
                        (Number(budget.gross_salary) -
                            Number(budget.cpf_deduction) -
                            Number(budget.taxes_deduction || 0) -
                            Number(budget.insurance_deduction || 0)) *
                            100,
                    ) / 100,
            };
            catAllocData = catAllocData.map((row) => ({
                ...row,
                allocated_amount:
                    Math.round(
                        budget.after_deductions * Number(row.percentage) * 100,
                    ) / 100,
            }));
        }
        budget = { ...budget, bonus: bonusSummary.gross };

        // Recurring subscription/bill/other spend for this member and month, by category
        const recurringSpend = calculateRecurringCategorySpend(
            recurringItems || [],
            month,
            {
                ownerId: budget.owner_id,
                knownCategoryIds: (catAllocData || []).map(
                    (row) => row.category_id,
                ),
            },
        );

        const categories: MonthlyBudgetCategoryDetail[] = (
            catAllocData || []
        ).map((row) => {
            const catObj: Category | undefined = row.categories;

            // Exclude goal-funded expenses from normal monthly spendable category caps
            const expenseShareSum = expenses
                .filter((e) => e.category_id === row.category_id && !e.goal_id)
                .reduce(
                    (sum, e) =>
                        sum +
                        getMemberExpenseShare(e, budget.owner_id, "personal"),
                    0,
                );

            const recurring = recurringSpend.byCategory[row.category_id];
            const recurringSpent = recurring?.total ?? 0;
            const roundedSpent =
                Math.round((expenseShareSum + recurringSpent) * 100) / 100;
            const remaining =
                Math.round(
                    (Number(row.allocated_amount) - roundedSpent) * 100,
                ) / 100;

            return {
                id: row.id,
                monthly_budget_id: row.monthly_budget_id,
                category_id: row.category_id,
                percentage: Number(row.percentage),
                allocated_amount: Number(row.allocated_amount),
                category: catObj,
                actualSpent: roundedSpent,
                remaining,
                recurringSpent,
                recurringItems: recurring?.items,
            };
        });

        const uncategorizedRecurringSpent = recurringSpend.uncategorized.total;

        const totalSpent =
            Math.round(
                (categories.reduce((sum, c) => sum + (c.actualSpent || 0), 0) +
                    uncategorizedRecurringSpent) *
                    100,
            ) / 100;
        const disposablePool = Number(budget.after_deductions);
        const totalRemaining =
            Math.round((disposablePool - totalSpent) * 100) / 100;

        const spendableCats = categories.filter((c) =>
            isSpendableCategory(c.category),
        );
        const allocationCats = categories.filter(
            (c) => !isSpendableCategory(c.category),
        );

        const spendableAllocated =
            Math.round(
                spendableCats.reduce((sum, c) => sum + c.allocated_amount, 0) *
                    100,
            ) / 100;
        const spendableSpent =
            Math.round(
                spendableCats.reduce(
                    (sum, c) => sum + (c.actualSpent || 0),
                    0,
                ) * 100,
            ) / 100;
        const spendableRemaining =
            Math.round((spendableAllocated - spendableSpent) * 100) / 100;
        const allocationTotal =
            Math.round(
                allocationCats.reduce((sum, c) => sum + c.allocated_amount, 0) *
                    100,
            ) / 100;

        return {
            budget,
            categories,
            disposablePool,
            totalSpent,
            totalRemaining,
            spendableAllocated,
            spendableSpent,
            spendableRemaining,
            allocationTotal,
            uncategorizedRecurringSpent,
            uncategorizedRecurringItems: recurringSpend.uncategorized.items,
            bonusSummary,
        };
    }

    public async updateMonthlyBudget(
        budgetUpdates: Partial<MonthlyBudget> & { id?: string },
    ): Promise<void> {
        const client = this.getClient();
        if (!budgetUpdates.id) {
            throw new Error("Monthly budget ID is required for update");
        }
        // Dynamic synthetic budget IDs (e.g. mb-dyn-*) are not yet persisted in monthly_budgets
        if (!isValidUuid(budgetUpdates.id)) {
            throw new Error(
                `Invalid monthly budget ID: "${budgetUpdates.id}". Budget must be persisted with a valid UUID before update.`,
            );
        }

        // bonus is derived from bonus_events at read time; never write it back.
        const { bonus: _derivedBonus, ...writable } = budgetUpdates;
        void _derivedBonus;
        const { error } = await client
            .from("monthly_budgets")
            .update(writable)
            .eq("id", budgetUpdates.id);
        if (error) throw error;
    }

    public async getExpenses(filter?: ExpenseFilter): Promise<Expense[]> {
        const client = this.getClient();
        const sortBy = filter?.sortBy || "date";
        const ascending = filter?.sortOrder === "asc";

        const buildQuery = () => {
            let query = client.from("expenses").select("*");

            if (sortBy === "amount") {
                query = query.order("amount", { ascending });
            } else {
                query = query
                    .order("date", { ascending })
                    .order("time", { ascending, nullsFirst: false })
                    .order("created_at", { ascending });
            }

            if (filter?.month) {
                const nextMonth = addMonths(filter.month, 1);
                query = query
                    .gte("date", `${filter.month}-01`)
                    .lt("date", `${nextMonth}-01`);
            }
            if (filter?.categoryId) {
                query = query.eq("category_id", filter.categoryId);
            }
            if (filter?.payerId) {
                query = query.eq("payer_id", filter.payerId);
            }
            if (filter?.isShared !== undefined) {
                query = query.eq("is_shared", filter.isShared);
            }
            if (filter?.settled !== undefined) {
                query = query.eq("settled", filter.settled);
            }
            if (filter?.goalId) {
                query = query.eq("goal_id", filter.goalId);
            }
            if (filter?.tag) {
                query = query.contains("tags", [filter.tag]);
            }
            if (filter?.search) {
                query = query.or(buildExpenseSearchOrFilter(filter.search));
            }

            return query;
        };

        if (filter?.page && filter?.pageSize) {
            const from = (filter.page - 1) * filter.pageSize;
            const to = from + filter.pageSize - 1;
            const { data, error } = await buildQuery().range(from, to);
            if (error) throw error;
            return (data || []) as Expense[];
        }

        return fetchAllPages<Expense>(
            () => buildQuery() as unknown as PaginatableQuery<Expense>,
        );
    }

    public async addExpense(input: CreateExpenseInput): Promise<Expense> {
        const client = this.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id!
            : await this.getHouseholdId();

        if (!isValidUuid(input.payer_id)) {
            throw new Error(`Invalid payer member ID: "${input.payer_id}"`);
        }
        const resolvedPayerId = input.payer_id;

        const resolvedCategoryId: string | null = input.category_id || null;
        if (resolvedCategoryId && !isValidUuid(resolvedCategoryId)) {
            throw new Error(`Invalid category ID: "${resolvedCategoryId}"`);
        }

        const insertPayload: Record<string, unknown> = {
            ...(input.id ? { id: input.id } : {}),
            payer_id: resolvedPayerId,
            household_id: householdId,
            category_id: resolvedCategoryId,
            date: input.date,
            time: input.time || getCurrentSingaporeTime(),
            item: input.item,
            amount: input.amount,
            remarks: input.remarks || null,
            is_shared: input.is_shared,
            split_ratio: input.split_ratio ?? 0.5,
            settled: false,
            tags: input.tags || [],
            goal_id: input.goal_id || null,
            original_amount:
                input.original_amount !== undefined
                    ? input.original_amount
                    : null,
            original_currency: input.original_currency || "SGD",
            exchange_rate:
                input.exchange_rate !== undefined ? input.exchange_rate : null,
        };

        const { data, error } = await client
            .from("expenses")
            .insert(insertPayload)
            .select();

        if (error) {
            const code = (error as { code?: string }).code;
            const message = (error as { message?: string }).message || "";
            const isDuplicateKey =
                code === "23505" || /duplicate key/i.test(message);
            if (!isDuplicateKey) {
                throw error;
            }
        }

        // Auto-record daily checkin
        try {
            await this.recordDailyCheckin(
                resolvedPayerId,
                input.date,
                "expense",
            );
        } catch {
            // Non-fatal
        }

        if (!data || data.length === 0) {
            return {
                id: input.id || `exp-${Date.now()}`,
                household_id: householdId,
                payer_id: resolvedPayerId,
                category_id: resolvedCategoryId,
                date: input.date,
                time: input.time || getCurrentSingaporeTime(),
                item: input.item,
                amount: input.amount,
                remarks: input.remarks || null,
                is_shared: input.is_shared,
                split_ratio: input.split_ratio ?? 0.5,
                settled: false,
                tags: input.tags || [],
                goal_id: input.goal_id || null,
                original_amount:
                    input.original_amount !== undefined
                        ? input.original_amount
                        : null,
                original_currency: input.original_currency || "SGD",
                exchange_rate:
                    input.exchange_rate !== undefined
                        ? input.exchange_rate
                        : null,
                created_at: new Date().toISOString(),
            };
        }
        return data[0] as Expense;
    }

    public async updateExpense(
        id: string,
        updates: UpdateExpenseInput,
    ): Promise<Expense> {
        const client = this.getClient();
        const { data, error } = await client
            .from("expenses")
            .update(updates)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data as Expense;
    }

    public async bulkAddExpenses(
        expenses: CreateExpenseInput[],
    ): Promise<Expense[]> {
        const created: Expense[] = [];
        for (const item of expenses) {
            try {
                created.push(await this.addExpense(item));
            } catch (err) {
                // Report what was saved so callers do not re-send those rows
                if (created.length > 0)
                    throw new PartialBulkAddError(created, err);
                throw err;
            }
        }
        return created;
    }

    public async deleteExpense(id: string): Promise<void> {
        const client = this.getClient();
        const { error } = await client.from("expenses").delete().eq("id", id);
        if (error) throw error;
    }

    public async settleSharedExpenses(
        member1Id: string,
        member2Id: string,
        expenseIds?: string[],
        record?: SettleUpRecordInput,
    ): Promise<void> {
        if (expenseIds !== undefined && expenseIds.length === 0) {
            return;
        }
        const client = this.getClient();
        let query = client
            .from("expenses")
            .update({ settled: true })
            .eq("is_shared", true)
            .eq("settled", false);

        if (expenseIds && expenseIds.length > 0) {
            query = query.in("id", expenseIds);
        }

        const { error } = await query.or(
            `payer_id.eq.${member1Id},payer_id.eq.${member2Id}`,
        );
        if (error) throw error;

        if (record && expenseIds && record.amount > 0) {
            await this.recordSettleUp(record, expenseIds);
        }
    }

    /**
     * Best-effort history row. The expenses are already settled, so a missing
     * table (migration not applied) must not fail the settle-up itself.
     */
    private async recordSettleUp(
        record: SettleUpRecordInput,
        expenseIds: string[],
    ): Promise<void> {
        if (this.settleUpsTableAvailable === false) return;
        const client = this.getClient();
        const { error } = await client.from("settle_ups").insert({
            household_id: await this.getHouseholdId(),
            payer_id: record.payerId,
            payee_id: record.payeeId,
            amount: record.amount,
            settled_on: getTodayDateString(),
            expense_ids: expenseIds,
        });
        if (error) {
            if (isMissingRelationError(error)) {
                this.settleUpsTableAvailable = false;
                return;
            }
            throw error;
        }
        this.settleUpsTableAvailable = true;
    }

    public async getSettleUps(): Promise<SettleUpsResult> {
        if (this.settleUpsTableAvailable === false)
            return { available: false, settleUps: [] };
        const { data, error } = await this.getClient()
            .from("settle_ups")
            .select("*")
            .order("settled_on", { ascending: false })
            .order("created_at", { ascending: false });
        if (error) {
            if (isMissingRelationError(error)) {
                this.settleUpsTableAvailable = false;
                return { available: false, settleUps: [] };
            }
            throw error;
        }
        this.settleUpsTableAvailable = true;
        return {
            available: true,
            settleUps: ((data || []) as Record<string, unknown>[]).map(
                (row) => ({
                    id: String(row.id),
                    household_id: String(row.household_id ?? ""),
                    payer_id: String(row.payer_id),
                    payee_id: String(row.payee_id),
                    amount: Number(row.amount),
                    settled_on: String(row.settled_on),
                    expense_ids: Array.isArray(row.expense_ids)
                        ? (row.expense_ids as string[])
                        : [],
                    created_at: row.created_at
                        ? String(row.created_at)
                        : undefined,
                }),
            ),
        };
    }

    public async getGoals(): Promise<SavingsGoal[]> {
        const client = this.getClient();
        const { data, error } = await client.from("savings_goals").select("*");
        if (error) throw error;
        return (data || []) as SavingsGoal[];
    }

    public async getGoal(id: string): Promise<SavingsGoal | null> {
        const client = this.getClient();
        const { data, error } = await client
            .from("savings_goals")
            .select("*")
            .eq("id", id)
            .maybeSingle();
        if (error) throw error;
        return (data as SavingsGoal | null) ?? null;
    }

    public async addGoal(input: CreateGoalInput): Promise<SavingsGoal> {
        const client = this.getClient();
        const savedSoFar = input.saved_so_far ?? 0;
        const monthlyContribution = input.monthly_contribution ?? 0;
        const pacing = calculateGoalPacing(
            input.target_amount,
            savedSoFar,
            input.target_date,
            monthlyContribution,
        );

        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.getHouseholdId();
        const { data, error } = await client
            .from("savings_goals")
            .insert({
                household_id: householdId,
                owner_id: input.owner_id || null,
                title: input.title,
                target_amount: input.target_amount,
                saved_so_far: savedSoFar,
                target_date: input.target_date,
                monthly_contribution: monthlyContribution,
                emoji: input.emoji || "🎯",
                status: pacing.status,
            })
            .select()
            .single();
        if (error) throw error;
        return data as SavingsGoal;
    }

    public async updateGoal(
        id: string,
        updates: Partial<SavingsGoal>,
    ): Promise<SavingsGoal> {
        const client = this.getClient();
        // Fetch existing goal to recalculate pacing if amounts/dates change
        const { data: existing, error: fetchError } = await client
            .from("savings_goals")
            .select("*")
            .eq("id", id)
            .single();
        if (fetchError) throw fetchError;

        const merged = { ...existing, ...updates };
        const pacing = calculateGoalPacing(
            merged.target_amount,
            merged.saved_so_far,
            merged.target_date,
            merged.monthly_contribution,
        );

        const savedSoFarBefore = Number(existing.saved_so_far ?? 0);
        const savedSoFarRequested =
            updates.saved_so_far !== undefined
                ? Number(updates.saved_so_far)
                : undefined;
        const hasAtomicSaveDelta =
            savedSoFarRequested !== undefined &&
            Number.isFinite(savedSoFarRequested) &&
            savedSoFarRequested !== savedSoFarBefore;

        const finalUpdates: Record<string, unknown> = { ...updates };
        if (hasAtomicSaveDelta) {
            const delta =
                Math.round((savedSoFarRequested - savedSoFarBefore) * 100) /
                100;
            const { error: incrementError } = await client.rpc(
                "increment_goal_saved",
                {
                    p_goal_id: id,
                    p_amount: delta,
                },
            );
            if (incrementError) throw incrementError;
            delete finalUpdates.saved_so_far;
        }

        if (Object.keys(finalUpdates).length > 0 || hasAtomicSaveDelta) {
            finalUpdates.status = pacing.status;
            const { data, error } = await client
                .from("savings_goals")
                .update(finalUpdates)
                .eq("id", id)
                .select()
                .single();
            if (error) throw error;
            return data as SavingsGoal;
        }

        return existing as SavingsGoal;
    }

    public async getRecurringItems(): Promise<RecurringItem[]> {
        const client = this.getClient();
        const { data, error } = await client
            .from("recurring_items")
            .select("*");
        if (error) throw error;
        return (data || []) as RecurringItem[];
    }

    public async addRecurringItem(
        input: CreateRecurringItemInput,
    ): Promise<RecurringItem> {
        const client = this.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.getHouseholdId();
        const monthlyAmortized =
            input.frequency === "annually"
                ? Math.round((input.amount / 12) * 100) / 100
                : Math.round(input.amount * 100) / 100;

        const { data, error } = await client
            .from("recurring_items")
            .insert({
                household_id: householdId,
                owner_id:
                    input.owner_id === "joint" || !input.owner_id
                        ? null
                        : input.owner_id,
                type: input.type,
                name: input.name,
                amount: input.amount,
                frequency: input.frequency,
                payment_month: input.payment_month ?? null,
                start_date: input.start_date || null,
                end_date: input.end_date || null,
                notes: input.notes || null,
                monthly_amortized_amount: monthlyAmortized,
                due_day: resolveDueDay(input.frequency, input.due_day),
                category_id: isSpendType(input.type)
                    ? (input.category_id ?? null)
                    : null,
            })
            .select()
            .single();
        if (error) throw error;
        return data as RecurringItem;
    }

    public async updateRecurringItem(
        id: string,
        updates: Partial<RecurringItem>,
    ): Promise<RecurringItem> {
        const client = this.getClient();

        const finalUpdates: Partial<RecurringItem> = { ...updates };
        delete finalUpdates.id;
        // Insurance/tax reduce take-home pay and never count toward a spend category
        if (updates.type && !isSpendType(updates.type)) {
            finalUpdates.category_id = null;
        }
        if (updates.amount !== undefined || updates.frequency !== undefined) {
            const { data: existing, error: fetchErr } = await client
                .from("recurring_items")
                .select("*")
                .eq("id", id)
                .single();
            if (fetchErr) throw fetchErr;

            const newAmount =
                updates.amount !== undefined ? updates.amount : existing.amount;
            const newFrequency =
                updates.frequency !== undefined
                    ? updates.frequency
                    : existing.frequency;
            const monthlyAmortized =
                newFrequency === "annually"
                    ? Math.round((newAmount / 12) * 100) / 100
                    : Math.round(newAmount * 100) / 100;

            finalUpdates.monthly_amortized_amount = monthlyAmortized;
        }

        const { data, error } = await client
            .from("recurring_items")
            .update(finalUpdates)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data as RecurringItem;
    }

    public async deleteRecurringItem(id: string): Promise<void> {
        const client = this.getClient();
        const { error } = await client
            .from("recurring_items")
            .delete()
            .eq("id", id);
        if (error) throw error;
    }

    // Credit Cards
    public async getCreditCards(): Promise<CreditCard[]> {
        const client = this.getClient();
        const { data, error } = await client
            .from("credit_cards")
            .select("*")
            .order("created_at", { ascending: true });
        if (error) throw error;
        return (data || []) as CreditCard[];
    }

    public async addCreditCard(
        input: CreateCreditCardInput,
    ): Promise<CreditCard> {
        const client = this.getClient();
        const householdId = input.household_id || (await this.getHouseholdId());
        const { data, error } = await client
            .from("credit_cards")
            .insert({
                household_id: householdId,
                owner_id: input.owner_id,
                name: input.name,
                bank: input.bank,
                last4: input.last4 || null,
                billing_day: input.billing_day,
                due_day: input.due_day,
                credit_limit: input.credit_limit || null,
                color: input.color || "#059669",
                is_active: true,
            })
            .select()
            .single();
        if (error) throw error;
        return data as CreditCard;
    }

    public async updateCreditCard(
        id: string,
        updates: Partial<CreditCard>,
    ): Promise<CreditCard> {
        const client = this.getClient();
        const { data, error } = await client
            .from("credit_cards")
            .update(updates)
            .eq("id", id)
            .select()
            .single();
        if (error) throw error;
        return data as CreditCard;
    }

    public async deleteCreditCard(id: string): Promise<void> {
        const client = this.getClient();
        const { error } = await client
            .from("credit_cards")
            .delete()
            .eq("id", id);
        if (error) throw error;
    }

    public async getCreditCardStatements(
        month?: string,
    ): Promise<CreditCardStatement[]> {
        const client = this.getClient();
        let query = client
            .from("credit_card_statements")
            .select("*, card:credit_cards(*)");
        if (month) {
            query = query.eq("month", month);
        }
        const { data, error } = await query;
        if (error) throw error;
        return (data || []) as CreditCardStatement[];
    }

    public async upsertCreditCardStatement(
        input: UpsertCreditCardStatementInput,
    ): Promise<CreditCardStatement> {
        const client = this.getClient();
        const householdId = input.household_id || (await this.getHouseholdId());
        const { data, error } = await client
            .from("credit_card_statements")
            .upsert(
                {
                    ...(input.id ? { id: input.id } : {}),
                    card_id: input.card_id,
                    household_id: householdId,
                    month: input.month,
                    statement_amount: input.statement_amount,
                    due_date: input.due_date,
                    is_paid: input.is_paid || false,
                    paid_at: input.paid_at || null,
                    notes: input.notes || null,
                },
                { onConflict: "card_id,month" },
            )
            .select("*, card:credit_cards(*)")
            .single();
        if (error) throw error;
        return data as CreditCardStatement;
    }

    // Daily Check-ins
    public async getDailyCheckins(memberId?: string): Promise<DailyCheckin[]> {
        const client = this.getClient();
        const buildQuery = () => {
            let query = client
                .from("daily_checkins")
                .select("*")
                .order("checkin_date", { ascending: false });
            if (memberId) {
                query = query.eq("member_id", memberId);
            }
            return query;
        };
        return fetchAllPages<DailyCheckin>(
            () => buildQuery() as unknown as PaginatableQuery<DailyCheckin>,
        );
    }

    public async recordDailyCheckin(
        memberId: string,
        date: string,
        type: CheckinType,
    ): Promise<DailyCheckin> {
        const client = this.getClient();
        const householdId = await this.getHouseholdId();
        const { data, error } = await client
            .from("daily_checkins")
            .upsert(
                {
                    household_id: householdId,
                    member_id: memberId,
                    checkin_date: date,
                    type,
                },
                { onConflict: "member_id,checkin_date" },
            )
            .select()
            .single();
        if (error) throw error;
        return data as DailyCheckin;
    }

    // Notification Preferences
    public async getNotificationPreferences(
        memberId: string,
    ): Promise<NotificationPreferences> {
        const cacheKey = `bb_notif_prefs_${memberId}`;
        try {
            const client = this.getClient();
            const householdId = await this.getHouseholdId();
            const { data, error } = await client
                .from("notification_preferences")
                .select("*")
                .eq("member_id", memberId)
                .maybeSingle();

            if (!error && data) {
                const prefs = normalizeNotificationPreferences(
                    data,
                    memberId,
                    householdId,
                );
                if (typeof window !== "undefined" && window.localStorage) {
                    window.localStorage.setItem(
                        cacheKey,
                        JSON.stringify(prefs),
                    );
                }
                return prefs;
            }

            // If no row exists yet, insert defaults
            const defaults = getDefaultNotificationPreferences(
                memberId,
                householdId,
            );
            const { data: inserted, error: insertError } = await client
                .from("notification_preferences")
                .upsert(defaults, { onConflict: "member_id" })
                .select()
                .single();

            if (!insertError && inserted) {
                const prefs = normalizeNotificationPreferences(
                    inserted,
                    memberId,
                    householdId,
                );
                if (typeof window !== "undefined" && window.localStorage) {
                    window.localStorage.setItem(
                        cacheKey,
                        JSON.stringify(prefs),
                    );
                }
                return prefs;
            }
            if (insertError) {
                console.warn(
                    "Failed to create notification preferences:",
                    insertError.message,
                );
            }
        } catch (err) {
            console.debug(
                "Failed to fetch notification preferences from Supabase, checking cache:",
                err,
            );
        }

        // Cache fallback
        if (typeof window !== "undefined" && window.localStorage) {
            const cached = window.localStorage.getItem(cacheKey);
            if (cached) {
                try {
                    return JSON.parse(cached);
                } catch {
                    // ignore parsing error
                }
            }
        }
        return getDefaultNotificationPreferences(memberId);
    }

    public async updateNotificationPreferences(
        memberId: string,
        updates: UpdateNotificationPreferencesInput,
    ): Promise<NotificationPreferences> {
        const cacheKey = `bb_notif_prefs_${memberId}`;
        const householdId = await this.getHouseholdId().catch(
            () => "hh-00000000-0001",
        );
        const existing = await this.getNotificationPreferences(memberId);
        const updated: NotificationPreferences = {
            ...existing,
            ...updates,
            updated_at: new Date().toISOString(),
        };

        try {
            const client = this.getClient();
            const { error } = await client
                .from("notification_preferences")
                .upsert(
                    {
                        ...updated,
                        household_id: householdId,
                        member_id: memberId,
                    },
                    { onConflict: "member_id" },
                );
            if (error) throw error;
        } catch (err) {
            console.debug(
                "Failed to update notification preferences in Supabase:",
                err,
            );
        }

        if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(cacheKey, JSON.stringify(updated));
            window.dispatchEvent(
                new CustomEvent("notificationPreferencesUpdated", {
                    detail: { memberId, preferences: updated },
                }),
            );
        }
        return updated;
    }

    // Notification Log
    // Falls back to the device-local log if the table can't be reached
    // (for example, before the notification_log migration is applied).
    public async getNotificationLog(
        memberId: string,
    ): Promise<NotificationLogEntry[]> {
        try {
            const since = new Date(
                Date.now() - 90 * 24 * 60 * 60 * 1000,
            ).toISOString();
            const { data, error } = await this.getClient()
                .from("notification_log")
                .select(
                    "reminder_key, type, sent_at, read_at, dismissed_at, created_at",
                )
                .eq("member_id", memberId)
                .gte("created_at", since);
            if (error) throw error;
            return (data || []) as NotificationLogEntry[];
        } catch (err) {
            if (!this.localFallback) throw err;
            console.debug(
                "Failed to fetch notification log, using local log:",
                err,
            );
            return getLocalNotificationLog(memberId);
        }
    }

    public async claimNotificationSend(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<boolean> {
        try {
            const householdId = await this.getHouseholdId();
            // Insert-or-ignore: a returned row means this caller owns the send
            const { data, error } = await this.getClient()
                .from("notification_log")
                .upsert(
                    {
                        household_id: householdId,
                        member_id: memberId,
                        reminder_key: ref.key,
                        type: ref.type,
                        sent_at: new Date().toISOString(),
                    },
                    {
                        onConflict: "member_id,reminder_key",
                        ignoreDuplicates: true,
                    },
                )
                .select("id");
            if (error) throw error;
            return (data || []).length > 0;
        } catch (err) {
            if (!this.localFallback) throw err;
            console.debug(
                "Failed to claim notification send, using local log:",
                err,
            );
            return claimLocalNotificationSend(memberId, ref);
        }
    }

    public async markNotificationsRead(
        memberId: string,
        refs: NotificationLogRef[],
    ): Promise<void> {
        if (refs.length === 0) return;
        const readAt = new Date().toISOString();
        try {
            // Update existing rows first so their type (set when pushed) is kept
            const { data, error } = await this.getClient()
                .from("notification_log")
                .update({ read_at: readAt })
                .eq("member_id", memberId)
                .in(
                    "reminder_key",
                    refs.map((ref) => ref.key),
                )
                .select("reminder_key");
            if (error) throw error;
            const updated = new Set(
                (data || []).map((row) => row.reminder_key as string),
            );
            const missing = refs.filter((ref) => !updated.has(ref.key));
            if (missing.length === 0) return;
            await this.upsertNotificationLog(
                memberId,
                missing,
                { read_at: readAt },
                () => markLocalNotificationsRead(memberId, missing),
            );
        } catch (err) {
            if (!this.localFallback) throw err;
            console.debug(
                "Failed to mark notifications read, using local log:",
                err,
            );
            markLocalNotificationsRead(memberId, refs);
        }
    }

    public async dismissNotification(
        memberId: string,
        ref: NotificationLogRef,
    ): Promise<void> {
        await this.upsertNotificationLog(
            memberId,
            [ref],
            { dismissed_at: new Date().toISOString() },
            () => dismissLocalNotification(memberId, ref),
        );
    }

    // Push Subscriptions
    public async savePushSubscription(
        memberId: string,
        subscription: PushSubscriptionInput,
    ): Promise<void> {
        const householdId = await this.getHouseholdId();
        // Upsert by endpoint: a device follows whichever member last subscribed on it
        const { error } = await this.getClient()
            .from("push_subscriptions")
            .upsert(
                {
                    household_id: householdId,
                    member_id: memberId,
                    endpoint: subscription.endpoint,
                    p256dh: subscription.p256dh,
                    auth: subscription.auth,
                    user_agent: subscription.user_agent ?? null,
                    last_seen_at: new Date().toISOString(),
                },
                { onConflict: "endpoint" },
            );
        if (error) throw error;
    }

    public async deletePushSubscription(endpoint: string): Promise<void> {
        const { error } = await this.getClient()
            .from("push_subscriptions")
            .delete()
            .eq("endpoint", endpoint);
        if (error) throw error;
    }

    // Bonus Log
    public async getBonusEvents(): Promise<BonusEventsResult> {
        if (this.bonusTableAvailable === false)
            return { available: false, events: [] };
        const { data, error } = await this.getClient()
            .from("bonus_events")
            .select("*, bonus_goal_contributions(goal_id, amount)")
            .order("received_on", { ascending: false });
        if (error) {
            if (isMissingRelationError(error)) {
                this.bonusTableAvailable = false;
                return { available: false, events: [] };
            }
            throw error;
        }
        this.bonusTableAvailable = true;
        return {
            available: true,
            events: ((data || []) as Record<string, unknown>[]).map(
                mapBonusEventRow,
            ),
        };
    }

    /**
     * One member's bonuses received in a month, or null when the bonus log is
     * unavailable. Never throws: the monthly budget must load without it.
     */
    private async getMonthBonusEvents(
        month: string,
        ownerId: string,
    ): Promise<BonusEvent[] | null> {
        if (this.bonusTableAvailable === false || !ownerId) return null;
        try {
            const nextMonth = addMonths(month, 1);
            const { data, error } = await this.getClient()
                .from("bonus_events")
                .select("*")
                .eq("recipient_id", ownerId)
                .gte("received_on", `${month}-01`)
                .lt("received_on", `${nextMonth}-01`);
            if (error) {
                if (isMissingRelationError(error)) {
                    this.bonusTableAvailable = false;
                } else {
                    console.warn(
                        "Failed to load bonus events for budget:",
                        error,
                    );
                }
                return null;
            }
            this.bonusTableAvailable = true;
            return ((data || []) as Record<string, unknown>[]).map(
                mapBonusEventRow,
            );
        } catch (err) {
            console.warn("Failed to load bonus events for budget:", err);
            return null;
        }
    }

    private async getCurrentMemberId(): Promise<string | null> {
        try {
            const client = this.getClient();
            const { data: authData } = await client.auth.getUser();
            const userId = authData?.user?.id;
            if (!userId) return null;
            const { data } = await client
                .from("household_members")
                .select("id")
                .eq("user_id", userId)
                .maybeSingle();
            return (data?.id as string | undefined) ?? null;
        } catch {
            return null;
        }
    }

    private async getBonusContributionGoalIds(
        eventId: string,
    ): Promise<string[]> {
        try {
            const { data } = await this.getClient()
                .from("bonus_goal_contributions")
                .select("goal_id")
                .eq("bonus_event_id", eventId);
            return ((data || []) as { goal_id: string }[]).map(
                (r) => r.goal_id,
            );
        } catch {
            return [];
        }
    }

    /** Re-derives pacing status for goals whose saved amount an RPC changed. */
    private async refreshGoalStatuses(goalIds: string[]): Promise<void> {
        for (const id of new Set(goalIds)) {
            try {
                await this.updateGoal(id, {});
            } catch (err) {
                console.warn(
                    "Failed to refresh goal status after bonus change:",
                    err,
                );
            }
        }
    }

    private throwBonusError(error: unknown): never {
        if (isMissingRelationError(error)) {
            this.bonusTableAvailable = false;
            throw new BonusLogUnavailableError();
        }
        throw error;
    }

    public async saveBonusEvent(
        input: SaveBonusEventInput,
    ): Promise<BonusEvent> {
        const client = this.getClient();
        const householdId = await this.getHouseholdId();
        const previousGoalIds = input.id
            ? await this.getBonusContributionGoalIds(input.id)
            : [];
        const createdBy = input.id ? null : await this.getCurrentMemberId();
        const contributions = input.goal_contributions
            .filter((c) => c.amount > 0)
            .map((c) => ({
                goal_id: c.goal_id,
                amount: Math.round(c.amount * 100) / 100,
            }));

        const pEvent: Record<string, unknown> = {
            household_id: householdId,
            recipient_id: input.recipient_id,
            type: input.type,
            received_on: input.received_on,
            gross: Math.round(input.gross * 100) / 100,
            cpf: Math.round(input.cpf * 100) / 100,
            note: input.note ?? "",
            split: input.split,
        };
        if (input.id) pEvent.id = input.id;
        if (createdBy) pEvent.created_by = createdBy;

        const { data, error } = await client.rpc("save_bonus_event", {
            p_event: pEvent,
            p_contributions: contributions,
        });
        if (error) this.throwBonusError(error);
        this.bonusTableAvailable = true;

        await this.refreshGoalStatuses([
            ...previousGoalIds,
            ...contributions.map((c) => c.goal_id),
        ]);

        const row = (Array.isArray(data) ? data[0] : data) as Record<
            string,
            unknown
        > | null;
        return mapBonusEventRow({
            ...(row ?? { id: input.id ?? "", ...pEvent }),
            bonus_goal_contributions: contributions,
        });
    }

    public async deleteBonusEvent(id: string): Promise<void> {
        const goalIds = await this.getBonusContributionGoalIds(id);
        const { error } = await this.getClient().rpc("delete_bonus_event", {
            p_event_id: id,
        });
        if (error) this.throwBonusError(error);
        await this.refreshGoalStatuses(goalIds);
    }

    public async getBonusSplitDefault(
        memberId: string,
    ): Promise<BonusSplitShare[]> {
        if (this.bonusTableAvailable === false) return cloneDefaultSplit();
        try {
            const { data, error } = await this.getClient()
                .from("bonus_split_defaults")
                .select("split")
                .eq("member_id", memberId)
                .maybeSingle();
            if (error) {
                if (!isMissingRelationError(error)) {
                    console.warn("Failed to load bonus split default:", error);
                }
                return cloneDefaultSplit();
            }
            return data?.split
                ? normalizeBonusSplit(data.split)
                : cloneDefaultSplit();
        } catch (err) {
            console.warn("Failed to load bonus split default:", err);
            return cloneDefaultSplit();
        }
    }

    public async saveBonusSplitDefault(
        memberId: string,
        split: BonusSplitShare[],
    ): Promise<void> {
        const householdId = await this.getHouseholdId();
        const clean = normalizeBonusSplit(split).map(({ key, pct }) => ({
            key,
            pct,
        }));
        const { error } = await this.getClient()
            .from("bonus_split_defaults")
            .upsert(
                {
                    household_id: householdId,
                    member_id: memberId,
                    split: clean,
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "member_id" },
            );
        if (error) this.throwBonusError(error);
    }

    private async upsertNotificationLog(
        memberId: string,
        refs: NotificationLogRef[],
        patch: { read_at?: string; dismissed_at?: string },
        fallback: () => void,
    ): Promise<void> {
        try {
            const householdId = await this.getHouseholdId();
            const { error } = await this.getClient()
                .from("notification_log")
                .upsert(
                    refs.map((ref) => ({
                        household_id: householdId,
                        member_id: memberId,
                        reminder_key: ref.key,
                        type: ref.type,
                        ...patch,
                    })),
                    { onConflict: "member_id,reminder_key" },
                );
            if (error) throw error;
        } catch (err) {
            if (!this.localFallback) throw err;
            console.debug(
                "Failed to update notification log, using local log:",
                err,
            );
            fallback();
        }
    }
}

export const supabaseFinanceService = new SupabaseFinanceServiceImpl();
