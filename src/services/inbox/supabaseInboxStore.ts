/**
 * Supabase implementation of the Capture Inbox (see InboxService).
 * Falls back to "unavailable" while the capture inbox migration is missing.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type {
    CaptureToken,
    CaptureTokensResult,
    CreateExpenseInput,
    InboxItem,
    InboxItemsResult,
    InboxItemStatus,
    InboxResolveStatus,
    InboxSummary,
    MerchantRule,
    UpsertMerchantRuleInput,
} from "../../types/finance";
import { isMissingRelationError } from "../../lib/supabaseErrors";
import { generateCaptureToken } from "../../lib/capture/token";
import type { InboxService } from "./inboxService";
import {
    CaptureTokenLimitError,
    InboxUnavailableError,
    MAX_ACTIVE_CAPTURE_TOKENS,
} from "./inboxErrors";
import { summarizeInbox, UNAVAILABLE_INBOX_SUMMARY } from "./inboxSummary";

const TOKEN_COLUMNS = "id, member_id, label, token_hint, created_at, last_used_at, revoked_at";
const INBOX_LIMIT = 200;

function rethrow(err: unknown): never {
    if (isMissingRelationError(err)) throw new InboxUnavailableError();
    throw err;
}

/** The RPC's expense payload. */
export function toConfirmPayload(input: CreateExpenseInput): Record<string, unknown> {
    return {
        payer_id: input.payer_id || null,
        category_id: input.category_id || null,
        date: input.date || null,
        time: input.time || null,
        item: input.item,
        amount: input.amount,
        remarks: input.remarks || null,
        is_shared: input.is_shared,
        split_ratio: input.is_shared ? (input.split_ratio ?? 0.5) : 0,
        tags: input.tags || [],
        goal_id: input.goal_id || null,
        original_amount: input.original_amount ?? null,
        original_currency: input.original_currency || "SGD",
        exchange_rate: input.exchange_rate ?? null,
    };
}

export class SupabaseInboxStore implements InboxService {
    constructor(
        private readonly getClient: () => SupabaseClient,
        private readonly getHouseholdId: () => Promise<string>,
    ) {}

    /** household_members row of the signed-in user. */
    private async getOwnMemberId(): Promise<string | null> {
        const client = this.getClient();
        const { data } = await client.auth.getUser();
        const userId = data?.user?.id;
        if (!userId) return null;
        const { data: member } = await client
            .from("household_members")
            .select("id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
        return (member?.id as string | undefined) ?? null;
    }

    public async getInboxItems(status: InboxItemStatus = "pending"): Promise<InboxItemsResult> {
        const { data, error } = await this.getClient()
            .from("inbox_items")
            .select("*")
            .eq("status", status)
            .order("captured_at", { ascending: false })
            .limit(INBOX_LIMIT);
        if (error) {
            if (isMissingRelationError(error)) return { available: false, items: [] };
            throw error;
        }
        const items = (data || []).map((row) => ({
            ...row,
            amount: Number(row.amount),
        })) as InboxItem[];
        return { available: true, items };
    }

    public async getInboxSummary(memberId?: string): Promise<InboxSummary> {
        let query = this.getClient()
            .from("inbox_items")
            .select("amount, currency, captured_at")
            .eq("status", "pending");
        if (memberId) query = query.eq("member_id", memberId);
        const { data, error } = await query.limit(INBOX_LIMIT);
        if (error) {
            if (isMissingRelationError(error)) return UNAVAILABLE_INBOX_SUMMARY;
            throw error;
        }
        return summarizeInbox(
            (data || []).map((row) => ({
                amount: Number(row.amount),
                currency: row.currency as string,
                captured_at: row.captured_at as string,
            })),
        );
    }

    public async confirmInboxItem(itemId: string, expense: CreateExpenseInput): Promise<string> {
        const { data, error } = await this.getClient().rpc("confirm_inbox_item", {
            p_item_id: itemId,
            p_expense: toConfirmPayload(expense),
        });
        if (error) rethrow(error);
        return data as string;
    }

    public async resolveInboxItem(itemId: string, status: InboxResolveStatus): Promise<void> {
        const resolvedBy = status === "pending" ? null : await this.getOwnMemberId().catch(() => null);
        const { error } = await this.getClient()
            .from("inbox_items")
            .update({
                status,
                resolved_at: status === "pending" ? null : new Date().toISOString(),
                resolved_by: resolvedBy,
            })
            .eq("id", itemId)
            // Never reopen or re-resolve a confirmed item
            .neq("status", "confirmed");
        if (error) rethrow(error);
    }

    public async getMerchantRules(): Promise<MerchantRule[]> {
        const { data, error } = await this.getClient().from("merchant_rules").select("*");
        if (error) {
            if (isMissingRelationError(error)) return [];
            throw error;
        }
        return (data || []) as MerchantRule[];
    }

    public async upsertMerchantRule(rule: UpsertMerchantRuleInput): Promise<MerchantRule> {
        const client = this.getClient();
        const householdId = await this.getHouseholdId();
        const { data: existing, error: readError } = await client
            .from("merchant_rules")
            .select("hit_count")
            .eq("household_id", householdId)
            .eq("merchant_key", rule.merchant_key)
            .maybeSingle();
        if (readError) rethrow(readError);

        const { data, error } = await client
            .from("merchant_rules")
            .upsert(
                {
                    household_id: householdId,
                    merchant_key: rule.merchant_key,
                    action: rule.action ?? "categorise",
                    category_id: rule.category_id ?? null,
                    is_shared: rule.is_shared ?? null,
                    hit_count: (existing?.hit_count ?? 0) + (rule.hit_increment ?? 1),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "household_id,merchant_key" },
            )
            .select()
            .single();
        if (error) rethrow(error);
        return data as MerchantRule;
    }

    public async deleteMerchantRule(id: string): Promise<void> {
        const { error } = await this.getClient().from("merchant_rules").delete().eq("id", id);
        if (error) rethrow(error);
    }

    public async listCaptureTokens(): Promise<CaptureTokensResult> {
        // RLS returns only the signed-in member's tokens
        const { data, error } = await this.getClient()
            .from("capture_tokens")
            .select(TOKEN_COLUMNS)
            .is("revoked_at", null)
            .order("created_at", { ascending: true });
        if (error) {
            if (isMissingRelationError(error)) return { available: false, tokens: [] };
            throw error;
        }
        return { available: true, tokens: (data || []) as CaptureToken[] };
    }

    public async createCaptureToken(
        label: string,
        memberIdHint?: string,
    ): Promise<{ token: string; row: CaptureToken }> {
        const existing = await this.listCaptureTokens();
        if (!existing.available) throw new InboxUnavailableError();
        if (existing.tokens.length >= MAX_ACTIVE_CAPTURE_TOKENS) {
            throw new CaptureTokenLimitError();
        }

        // RLS only lets a member mint tokens for themselves
        const memberId = (await this.getOwnMemberId()) ?? memberIdHint;
        if (!memberId) throw new Error("Sign in to create a token.");
        const householdId = await this.getHouseholdId();
        const generated = await generateCaptureToken();

        const { data, error } = await this.getClient()
            .from("capture_tokens")
            .insert({
                household_id: householdId,
                member_id: memberId,
                label: label.trim().slice(0, 40) || "Phone",
                token_hash: generated.hash,
                token_hint: generated.hint,
            })
            .select(TOKEN_COLUMNS)
            .single();
        if (error) rethrow(error);
        return { token: generated.token, row: data as CaptureToken };
    }

    public async revokeCaptureToken(id: string): Promise<void> {
        const { error } = await this.getClient()
            .from("capture_tokens")
            .update({ revoked_at: new Date().toISOString() })
            .eq("id", id);
        if (error) rethrow(error);
    }
}
