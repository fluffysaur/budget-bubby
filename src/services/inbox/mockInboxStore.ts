/**
 * Demo-mode Capture Inbox, kept in localStorage and seeded with three
 * purchases so the triage flow can be tried without Supabase. Tokens can be
 * created here too, but capture itself only works with Supabase.
 */

import type {
    CaptureToken,
    CaptureTokensResult,
    CreateExpenseInput,
    Expense,
    InboxItem,
    InboxItemsResult,
    InboxItemStatus,
    InboxResolveStatus,
    InboxSummary,
    MerchantRule,
    UpsertMerchantRuleInput,
} from "../../types/finance";
import { generateCaptureToken } from "../../lib/capture/token";
import { normalizeMerchant } from "../../lib/capture/merchant";
import { generateUuid } from "../../lib/uuid";
import type { InboxService } from "./inboxService";
import { CaptureTokenLimitError, MAX_ACTIVE_CAPTURE_TOKENS } from "./inboxErrors";
import { summarizeInbox } from "./inboxSummary";

export const MOCK_INBOX_STORAGE_KEY = "budget_bubby_mock_inbox_v1";

interface MockTokenRow extends CaptureToken {
    household_id: string;
    token_hash: string;
}

interface MockInboxState {
    items: InboxItem[];
    rules: MerchantRule[];
    tokens: MockTokenRow[];
}

const HOUSEHOLD_ID = "hh-00000000-0001";
const MEMBER_A = "mem-00000000-0011";
const MEMBER_B = "mem-00000000-0012";

function seedItem(
    id: string,
    memberId: string,
    merchant: string,
    amount: number,
    currency: string,
    minutesAgo: number,
    card: string,
): InboxItem {
    return {
        id,
        household_id: HOUSEHOLD_ID,
        member_id: memberId,
        source: "wallet",
        merchant,
        merchant_key: normalizeMerchant(merchant),
        amount,
        currency,
        raw_amount: null,
        card_name: card,
        captured_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
        status: "pending",
        suggested_category_id: null,
        likely_duplicate_of: null,
        expense_id: null,
        created_at: new Date(Date.now() - minutesAgo * 60_000).toISOString(),
    };
}

function seedState(): MockInboxState {
    return {
        items: [
            seedItem("inbox-demo-1", MEMBER_A, "Grab Food", 18.4, "SGD", 45, "DBS Altitude"),
            seedItem("inbox-demo-2", MEMBER_B, "Ntuc Fairprice", 42.15, "SGD", 180, "UOB One"),
            seedItem("inbox-demo-3", MEMBER_A, "Starbucks", 7.9, "SGD", 26 * 60, "DBS Altitude"),
        ],
        rules: [],
        tokens: [],
    };
}

function load(): MockInboxState {
    try {
        const raw = window.localStorage.getItem(MOCK_INBOX_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw) as MockInboxState;
            if (Array.isArray(parsed.items)) return parsed;
        }
    } catch {
        // Fall through to the seed
    }
    return seedState();
}

export class MockInboxStore implements InboxService {
    private state: MockInboxState | null = null;

    constructor(private readonly addExpense: (input: CreateExpenseInput) => Promise<Expense>) {}

    private get data(): MockInboxState {
        if (!this.state) this.state = load();
        return this.state;
    }

    private persist() {
        try {
            window.localStorage.setItem(MOCK_INBOX_STORAGE_KEY, JSON.stringify(this.data));
        } catch {
            // Ignore storage errors
        }
    }

    /** Back to the three seeded items (tests and demo reset). */
    public reset(): void {
        this.state = seedState();
        try {
            window.localStorage.removeItem(MOCK_INBOX_STORAGE_KEY);
        } catch {
            // Ignore storage errors
        }
    }

    /** Test/demo helper: replace the inbox contents. */
    public setItems(items: InboxItem[]): void {
        this.data.items = items.map((i) => ({ ...i }));
        this.persist();
    }

    public async getInboxItems(status: InboxItemStatus = "pending"): Promise<InboxItemsResult> {
        const items = this.data.items
            .filter((i) => i.status === status)
            .sort((a, b) => b.captured_at.localeCompare(a.captured_at))
            .map((i) => ({ ...i }));
        return { available: true, items };
    }

    public async getInboxSummary(memberId?: string): Promise<InboxSummary> {
        return summarizeInbox(
            this.data.items.filter(
                (i) => i.status === "pending" && (!memberId || i.member_id === memberId),
            ),
        );
    }

    public async confirmInboxItem(itemId: string, expense: CreateExpenseInput): Promise<string> {
        const item = this.data.items.find((i) => i.id === itemId);
        if (!item) throw new Error("inbox_item_not_found");
        if (item.status === "confirmed" && item.expense_id) return item.expense_id;
        if (item.status !== "pending") throw new Error("inbox_item_resolved");

        const created = await this.addExpense({
            ...expense,
            payer_id: expense.payer_id || item.member_id,
            item: expense.item || item.merchant,
        });
        item.status = "confirmed";
        item.expense_id = created.id;
        item.resolved_at = new Date().toISOString();
        this.persist();
        return created.id;
    }

    public async resolveInboxItem(itemId: string, status: InboxResolveStatus): Promise<void> {
        const item = this.data.items.find((i) => i.id === itemId);
        if (!item || item.status === "confirmed") return;
        item.status = status;
        item.resolved_at = status === "pending" ? null : new Date().toISOString();
        this.persist();
    }

    public async getMerchantRules(): Promise<MerchantRule[]> {
        return this.data.rules.map((r) => ({ ...r }));
    }

    public async upsertMerchantRule(rule: UpsertMerchantRuleInput): Promise<MerchantRule> {
        let existing = this.data.rules.find((r) => r.merchant_key === rule.merchant_key);
        if (!existing) {
            existing = {
                id: generateUuid(),
                merchant_key: rule.merchant_key,
                action: "categorise",
                hit_count: 0,
            };
            this.data.rules.push(existing);
        }
        existing.action = rule.action ?? "categorise";
        existing.category_id = rule.category_id ?? null;
        existing.is_shared = rule.is_shared ?? null;
        existing.hit_count += rule.hit_increment ?? 1;
        existing.updated_at = new Date().toISOString();
        this.persist();
        return { ...existing };
    }

    public async deleteMerchantRule(id: string): Promise<void> {
        this.data.rules = this.data.rules.filter((r) => r.id !== id);
        this.persist();
    }

    public async listCaptureTokens(memberId?: string): Promise<CaptureTokensResult> {
        const tokens = this.data.tokens
            .filter((t) => !t.revoked_at && (!memberId || t.member_id === memberId))
            .map((t) => ({
                id: t.id,
                member_id: t.member_id,
                label: t.label,
                token_hint: t.token_hint,
                created_at: t.created_at,
                last_used_at: t.last_used_at ?? null,
                revoked_at: t.revoked_at ?? null,
            }));
        return { available: true, tokens };
    }

    public async createCaptureToken(
        label: string,
        memberId: string = MEMBER_A,
    ): Promise<{ token: string; row: CaptureToken }> {
        const { tokens } = await this.listCaptureTokens(memberId);
        if (tokens.length >= MAX_ACTIVE_CAPTURE_TOKENS) throw new CaptureTokenLimitError();
        const generated = await generateCaptureToken();
        const row: MockTokenRow = {
            id: generateUuid(),
            household_id: HOUSEHOLD_ID,
            member_id: memberId,
            label: label.trim().slice(0, 40) || "Phone",
            token_hint: generated.hint,
            // Like the database, only the hash is kept
            token_hash: generated.hash,
            created_at: new Date().toISOString(),
            last_used_at: null,
            revoked_at: null,
        };
        this.data.tokens.push(row);
        this.persist();
        const [publicRow] = (await this.listCaptureTokens(memberId)).tokens.filter(
            (t) => t.id === row.id,
        );
        return { token: generated.token, row: publicRow };
    }

    /** Test helper: the stored rows, hashes included. */
    public getStoredTokenRows(): readonly MockTokenRow[] {
        return this.data.tokens;
    }

    public async revokeCaptureToken(id: string): Promise<void> {
        const token = this.data.tokens.find((t) => t.id === id);
        if (token) token.revoked_at = new Date().toISOString();
        this.persist();
    }
}
