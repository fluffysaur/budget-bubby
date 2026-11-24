/** In-memory mock of the accounts domain. */

import { matchPartnerMember } from "../../lib/members";
import type {
    Account,
    CreateAccountInput,
    UpdateAccountInput,
    AccountSnapshot,
    BulkBalanceUpdateItem,
    Perspective,
} from "../../types/finance";
import { getTodayDateString } from "../../lib/dateUtils";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class AccountsStore {
    constructor(private readonly ctx: MockContext) {}

    async getAccounts(perspective: Perspective): Promise<Account[]> {
        if (perspective === "household") {
            return cloneDeep(this.ctx.state.accounts);
        }

        const targetMember = matchPartnerMember(
            this.ctx.state.members,
            perspective,
        );

        if (!targetMember) {
            return [];
        }

        const filtered = this.ctx.state.accounts.filter(
            (a) => a.owner_id === targetMember.id || a.is_joint,
        );
        return cloneDeep(filtered);
    }

    async createAccount(input: CreateAccountInput): Promise<Account> {
        const householdId =
            input.household_id ||
            this.ctx.state.household.id ||
            "hh-00000000-0001";
        const newAccount: Account = {
            id: `acc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            household_id: householdId,
            owner_id: input.owner_id,
            name: input.name,
            type: input.type,
            balance: Math.round(input.balance * 100) / 100,
            currency: input.currency || "SGD",
            institution: input.institution || null,
            is_joint: input.is_joint || false,
            notes: input.notes || null,
            cpf_kind: input.type === "CPF" ? (input.cpf_kind ?? null) : null,
            is_new_account: input.is_new_account ?? null,
            updated_at: new Date().toISOString(),
        };

        this.ctx.state.accounts.push(newAccount);

        // Create initial snapshot for the new account
        const snapshot: AccountSnapshot = {
            id: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            account_id: newAccount.id,
            household_id: householdId,
            balance: newAccount.balance,
            snapshot_date: getTodayDateString(),
        };
        this.ctx.state.accountSnapshots.push(snapshot);

        this.ctx.persist();
        return cloneDeep(newAccount);
    }

    async updateAccount(
        id: string,
        updates: UpdateAccountInput,
    ): Promise<Account> {
        const account = this.ctx.state.accounts.find((a) => a.id === id);
        if (!account) {
            throw new Error(`Account with id "${id}" not found`);
        }

        if (updates.name !== undefined) account.name = updates.name;
        if (updates.type !== undefined) account.type = updates.type;
        if (updates.institution !== undefined)
            account.institution = updates.institution;
        if (updates.owner_id !== undefined) account.owner_id = updates.owner_id;
        if (updates.is_joint !== undefined) account.is_joint = updates.is_joint;
        if (updates.notes !== undefined) account.notes = updates.notes;
        if (updates.cpf_kind !== undefined) account.cpf_kind = updates.cpf_kind;
        if (updates.is_new_account !== undefined)
            account.is_new_account = updates.is_new_account;
        account.updated_at = new Date().toISOString();

        this.ctx.persist();
        return cloneDeep(account);
    }

    async deleteAccount(id: string): Promise<void> {
        const idx = this.ctx.state.accounts.findIndex((a) => a.id === id);
        if (idx === -1) {
            throw new Error(`Account with id "${id}" not found`);
        }

        this.ctx.state.accounts.splice(idx, 1);
        // Cascade delete snapshots
        this.ctx.state.accountSnapshots =
            this.ctx.state.accountSnapshots.filter((s) => s.account_id !== id);

        this.ctx.persist();
    }

    async updateAccountBalance(
        accountId: string,
        newBalance: number,
        notes?: string,
        date?: string,
    ): Promise<Account> {
        const account = this.ctx.state.accounts.find((a) => a.id === accountId);
        if (!account) {
            throw new Error(`Account with id "${accountId}" not found`);
        }

        const rounded = Math.round(newBalance * 100) / 100;
        account.balance = rounded;
        if (notes !== undefined) {
            account.notes = notes || null;
        }
        account.updated_at = new Date().toISOString();

        const snapDate = date || getTodayDateString();
        const snapMonth = snapDate.slice(0, 7);

        // Upsert snapshot if one already exists on the exact same date, or push new
        const existingIdx = this.ctx.state.accountSnapshots.findIndex(
            (s) => s.account_id === accountId && s.snapshot_date === snapDate,
        );
        const snapshot: AccountSnapshot = {
            id:
                existingIdx >= 0
                    ? this.ctx.state.accountSnapshots[existingIdx].id
                    : `snap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            account_id: accountId,
            household_id: account.household_id,
            balance: rounded,
            snapshot_date: snapDate,
        };

        if (existingIdx >= 0) {
            this.ctx.state.accountSnapshots[existingIdx] = snapshot;
        } else {
            // Remove any same-month synthetic snapshot if user is recording an explicit snapshot in that month
            this.ctx.state.accountSnapshots =
                this.ctx.state.accountSnapshots.filter(
                    (s) =>
                        !(
                            s.account_id === accountId &&
                            s.snapshot_date.startsWith(snapMonth) &&
                            s.id.startsWith("snap-acc-")
                        ),
                );
            this.ctx.state.accountSnapshots.push(snapshot);
        }

        this.ctx.persist();
        return cloneDeep(account);
    }

    async bulkUpdateAccountBalances(
        updates: BulkBalanceUpdateItem[],
        snapshotDate: string,
    ): Promise<Account[]> {
        const snapDate = snapshotDate || getTodayDateString();
        const snapMonth = snapDate.slice(0, 7);
        const updatedAccounts: Account[] = [];

        for (const item of updates) {
            const account = this.ctx.state.accounts.find(
                (a) => a.id === item.accountId,
            );
            if (!account) continue;

            const rounded = Math.round(Number(item.balance) * 100) / 100;
            account.balance = rounded;
            if (item.notes !== undefined) {
                account.notes = item.notes || null;
            }
            account.updated_at = new Date().toISOString();

            // Remove existing snapshots for this account in the same month so end-of-month snapshot is clean
            this.ctx.state.accountSnapshots =
                this.ctx.state.accountSnapshots.filter(
                    (s) =>
                        !(
                            s.account_id === account.id &&
                            s.snapshot_date.startsWith(snapMonth)
                        ),
                );

            this.ctx.state.accountSnapshots.push({
                id: `snap-${Date.now()}-${account.id}-${Math.random().toString(36).slice(2, 6)}`,
                account_id: account.id,
                household_id: account.household_id,
                balance: rounded,
                snapshot_date: snapDate,
            });

            updatedAccounts.push(cloneDeep(account));
        }

        this.ctx.persist();
        return updatedAccounts;
    }

    async getAccountSnapshots(accountId: string): Promise<AccountSnapshot[]> {
        const snapshots = this.ctx.state.accountSnapshots
            .filter((s) => s.account_id === accountId)
            .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
        return cloneDeep(snapshots);
    }

    async getAllAccountSnapshots(
        perspective?: Perspective,
    ): Promise<AccountSnapshot[]> {
        if (!perspective || perspective === "household") {
            return cloneDeep(
                [...this.ctx.state.accountSnapshots].sort((a, b) =>
                    a.snapshot_date.localeCompare(b.snapshot_date),
                ),
            );
        }

        const visibleAccounts = await this.getAccounts(perspective);
        const visibleIds = new Set(visibleAccounts.map((a) => a.id));
        return cloneDeep(
            this.ctx.state.accountSnapshots
                .filter((s) => visibleIds.has(s.account_id))
                .sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)),
        );
    }
}
