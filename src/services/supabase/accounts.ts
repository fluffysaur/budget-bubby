/** Supabase queries for the accounts domain. */

import type {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
    AccountSnapshot,
    BulkBalanceUpdateItem,
    HouseholdMember,
    Perspective,
} from "../../types/finance";
import { getTodayDateString } from "../../lib/dateUtils";
import { matchPartnerMember } from "../../lib/members";
import { isValidUuid } from "../../lib/uuid";
import { fetchAllPages, type PaginatableQuery } from "./shared";
import type { SupabaseContext } from "./context";

export class AccountsStore {
    constructor(private readonly ctx: SupabaseContext) {}

    async getAccounts(perspective: Perspective): Promise<Account[]> {
        const client = this.ctx.getClient();
        let query = client.from("accounts").select("*");

        if (perspective !== "household") {
            // Fetch members to find corresponding member ID
            const { data: members } = await client
                .from("household_members")
                .select("*");
            const targetMember = matchPartnerMember(
                (members || []) as HouseholdMember[],
                perspective,
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

    async createAccount(input: CreateAccountInput): Promise<Account> {
        const client = this.ctx.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.ctx.getHouseholdId();
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
                cpf_kind:
                    input.type === "CPF" ? (input.cpf_kind ?? null) : null,
                // Sent only when chosen, so a $0 account still saves before
                // the column's migration has run.
                ...(input.is_new_account != null
                    ? { is_new_account: input.is_new_account }
                    : {}),
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

    async updateAccount(
        id: string,
        updates: UpdateAccountInput,
    ): Promise<Account> {
        const client = this.ctx.getClient();
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
        if (updates.cpf_kind !== undefined) payload.cpf_kind = updates.cpf_kind;
        if (updates.is_new_account !== undefined)
            payload.is_new_account = updates.is_new_account;

        const { data, error } = await client
            .from("accounts")
            .update(payload)
            .eq("id", id)
            .select()
            .single();

        if (error) throw error;
        return data as Account;
    }

    async deleteAccount(id: string): Promise<void> {
        const client = this.ctx.getClient();
        const { error } = await client.from("accounts").delete().eq("id", id);
        if (error) throw error;
    }

    async updateAccountBalance(
        accountId: string,
        newBalance: number,
        notes?: string,
        date?: string,
    ): Promise<Account> {
        const client = this.ctx.getClient();
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

    async bulkUpdateAccountBalances(
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

    async getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("account_snapshots")
            .select("*")
            .eq("account_id", accountId)
            .order("snapshot_date", { ascending: true });
        if (error) throw error;
        return (data || []) as AccountSnapshot[];
    }

    async getAllAccountSnapshots(
        perspective?: Perspective,
    ): Promise<AccountSnapshot[]> {
        const client = this.ctx.getClient();
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
}
