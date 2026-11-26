/** Supabase queries for the accounts domain. */

import type {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
    AccountSnapshot,
    BulkBalanceUpdateItem,
    Perspective,
} from "../../types/finance";
import { getTodayDateString } from "../../lib/dateUtils";
import { isValidUuid } from "../../lib/uuid";
import {
    applySubsetOrder,
    nextSortOrder,
    sortAccounts,
} from "../../lib/accountOrder";
import { fetchAllPages, type PaginatableQuery } from "./shared";
import type { SupabaseContext } from "./context";

export class AccountsStore {
    constructor(private readonly ctx: SupabaseContext) {}

    async getAccounts(perspective: Perspective): Promise<Account[]> {
        const client = this.ctx.getClient();
        let query = client.from("accounts").select("*");

        if (perspective !== "household") {
            // A member perspective is that member's id. Anything else (e.g. a
            // legacy partner slot) matches no member, so it shows nothing.
            if (!isValidUuid(perspective)) {
                return [];
            }
            query = query.or(`owner_id.eq.${perspective},is_joint.eq.true`);
        }

        const { data, error } = await query
            .order("sort_order", { ascending: true, nullsFirst: false })
            .order("name");
        if (error) throw error;
        return (data || []) as Account[];
    }

    async createAccount(input: CreateAccountInput): Promise<Account> {
        const client = this.ctx.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.ctx.getHouseholdId();
        const balance = Math.round(input.balance * 100) / 100;

        const { data: group, error: groupError } = await client
            .from("accounts")
            .select("sort_order")
            .eq("household_id", householdId)
            .eq("type", input.type);
        if (groupError) throw groupError;

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
                sort_order: nextSortOrder(group ?? []),
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

    /**
     * Saves the order of accounts within one type group. Writes only
     * `sort_order`: touching `updated_at` would clear stale-balance warnings.
     */
    async reorderAccounts(ids: string[]): Promise<void> {
        const client = this.ctx.getClient();
        const { data, error } = await client
            .from("accounts")
            .select("id, household_id, type, name, sort_order");
        if (error) throw error;

        const rows = (data || []) as Pick<
            Account,
            "id" | "household_id" | "type" | "name" | "sort_order"
        >[];
        const first = rows.find((row) => row.id === ids[0]);
        if (!first) return;

        const group = sortAccounts(
            rows.filter(
                (row) =>
                    row.household_id === first.household_id &&
                    row.type === first.type,
            ),
        );
        const results = await Promise.all(
            applySubsetOrder(group, ids).flatMap((row, index) =>
                row.sort_order === index
                    ? []
                    : [
                          client
                              .from("accounts")
                              .update({ sort_order: index })
                              .eq("id", row.id),
                      ],
            ),
        );
        const failed = results.find((result) => result.error);
        if (failed) throw failed.error;
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
