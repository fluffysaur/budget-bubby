/**
 * capture-expense handler, bundled for the Edge Function by
 * `npm run build:functions`.
 *
 * Platform-agnostic: any phone automation that can POST JSON with a bearer
 * token can call it (iPhone Shortcuts Wallet trigger, Android MacroDroid or
 * Tasker, a manual Shortcut).
 *
 *   POST /functions/v1/capture-expense
 *   Authorization: Bearer bb_cap_<43 chars>
 *   { "amount": "S$12.50" | 12.5, "currency"?: "SGD", "merchant": "GRAB*FOOD",
 *     "card"?: "DBS Altitude", "occurred_at"? | "timestamp"?: ISO-8601,
 *     "source"?: "wallet" | "android" | ..., "raw_text"?: "<bank alert or SMS>",
 *     "title"?: "<notification title>", "sender"?: "<SMS sender>",
 *     "app"?: "<notification app>" }
 *
 * `raw_text` lets an automation forward a whole bank notification or SMS.
 * The server reads the amount, merchant and time from it (explicit fields
 * win) and ignores OTPs, declined charges and incoming money.
 *
 * The service-role client bypasses RLS, so scope is enforced here: the deps
 * only touch capture_tokens, merchant_rules, inbox_items and one expenses
 * select. Never log the token, the Authorization header or the body.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
    parseCapturedAmount,
    MAX_RAW_AMOUNT_LENGTH,
} from "../lib/capture/parseAmount";
import { cleanMerchant, normalizeMerchant } from "../lib/capture/merchant";
import { readBearerToken, sha256Hex } from "../lib/capture/token";
import { shiftIsoDate, toSgtDateTime } from "../lib/capture/sgTime";
import { isMissingRelationError } from "../lib/supabaseErrors";
import {
    parseBankAlert,
    MAX_RAW_TEXT_LENGTH,
    type BankAlert,
} from "../lib/capture/bankParsers";

export const MAX_BODY_BYTES = 4096;
export const RATE_LIMIT_MINUTE = 10;
export const RATE_LIMIT_DAY = 150;
const MAX_CARD_LENGTH = 80;
const PAST_WINDOW_MS = 7 * 86_400_000;
const FUTURE_WINDOW_MS = 10 * 60_000;
const IDEMPOTENCY_WINDOW_MS = 2 * 60_000;

export interface CaptureTokenRow {
    id: string;
    member_id: string;
    household_id: string;
}

export interface InboxInsertRow {
    household_id: string;
    member_id: string;
    token_id: string;
    source: string;
    merchant: string;
    merchant_key: string;
    amount: number;
    currency: string;
    raw_amount: string | null;
    card_name: string | null;
    captured_at: string;
    idempotency_key: string;
    suggested_category_id: string | null;
    likely_duplicate_of: string | null;
}

export interface DuplicateQuery {
    memberId: string;
    amount: number;
    currency: string;
    dateFrom: string;
    dateTo: string;
}

/** Same purchase sent by another source (Wallet and an SMS alert). */
export interface RecentCaptureQuery {
    memberId: string;
    amount: number;
    currency: string;
    fromIso: string;
    toIso: string;
    excludeSource: string;
}

/** Everything the handler may touch. Kept small on purpose (see test). */
export interface CaptureDeps {
    findToken(tokenHash: string): Promise<CaptureTokenRow | null>;
    countRecentByToken(tokenId: string, sinceIso: string): Promise<number>;
    findRule(
        householdId: string,
        merchantKey: string,
    ): Promise<{
        action: "categorise" | "ignore";
        category_id: string | null;
    } | null>;
    findLikelyDuplicate(query: DuplicateQuery): Promise<string | null>;
    /** Inbox item id from a different source within the window, if any. */
    findRecentCapture(query: RecentCaptureQuery): Promise<string | null>;
    /** Insert-or-ignore on (member_id, idempotency_key). Null on conflict. */
    insertItem(row: InboxInsertRow): Promise<{ id: string } | null>;
    findByIdempotencyKey(
        memberId: string,
        key: string,
    ): Promise<{ id: string } | null>;
    countPending(householdId: string): Promise<number>;
    touchToken(tokenId: string, nowIso: string): Promise<void>;
    now(): Date;
}

export interface CaptureRequest {
    method: string;
    authorization: string | null;
    contentLength?: number | null;
    bodyText: string;
}

export interface CaptureResponse {
    status: number;
    body: Record<string, unknown>;
}

const reply = (
    status: number,
    body: Record<string, unknown>,
): CaptureResponse => ({ status, body });
const UNAUTHORIZED = () => reply(401, { error: "unauthorized" });

function pickString(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const cleaned = value
        // eslint-disable-next-line no-control-regex
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return cleaned ? cleaned.slice(0, max) : null;
}

function normalizeSource(value: unknown): string {
    if (typeof value !== "string") return "api";
    const s = value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, "-")
        .slice(0, 24);
    return /^[a-z0-9_-]{1,24}$/.test(s) ? s : "api";
}

/**
 * MacroDroid injects `[sms_message]` / `[notification]` straight into a JSON
 * body, so multi-line alerts introduce raw newlines/tabs inside string
 * literals. Escape control chars only inside strings on fallback.
 */
function escapeRawControlCharsInJsonStrings(raw: string): string {
    let out = "";
    let inString = false;
    let escaped = false;
    for (let i = 0; i < raw.length; i++) {
        const ch = raw[i];
        if (!inString) {
            if (ch === "\"") inString = true;
            out += ch;
            continue;
        }
        if (escaped) {
            out += ch;
            escaped = false;
            continue;
        }
        if (ch === "\\") {
            out += ch;
            escaped = true;
            continue;
        }
        if (ch === "\"") {
            inString = false;
            out += ch;
            continue;
        }
        const code = ch.charCodeAt(0);
        if (code < 0x20 || code === 0x7f) {
            if (ch === "\n") out += "\\n";
            else if (ch === "\r") out += "\\r";
            else if (ch === "\t") out += "\\t";
            else out += " ";
            continue;
        }
        out += ch;
    }
    return out;
}

function parseCaptureBody(bodyText: string): Record<string, unknown> | null {
    let parsed: unknown;
    try {
        parsed = JSON.parse(bodyText);
    } catch {
        try {
            parsed = JSON.parse(escapeRawControlCharsInJsonStrings(bodyText));
        } catch {
            return null;
        }
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
    }
    return parsed as Record<string, unknown>;
}

/** The capture time: the sent one if plausible, otherwise now. */
export function resolveCapturedAt(raw: unknown, now: Date): Date {
    if (typeof raw !== "string" || raw.length > 64) return now;
    const t = new Date(raw);
    const ms = t.getTime();
    if (Number.isNaN(ms)) return now;
    if (
        ms < now.getTime() - PAST_WINDOW_MS ||
        ms > now.getTime() + FUTURE_WINDOW_MS
    )
        return now;
    return t;
}

export async function buildIdempotencyKey(
    memberId: string,
    amount: number,
    currency: string,
    merchantKey: string,
    capturedAt: Date,
): Promise<string> {
    const bucket = Math.floor(capturedAt.getTime() / IDEMPOTENCY_WINDOW_MS);
    return sha256Hex(
        `${memberId}|${amount.toFixed(2)}|${currency}|${merchantKey}|${bucket}`,
    );
}

export async function handleCapture(
    deps: CaptureDeps,
    req: CaptureRequest,
): Promise<CaptureResponse> {
    if (req.method !== "POST")
        return reply(405, { error: "method_not_allowed" });

    const token = readBearerToken(req.authorization);
    if (!token) return UNAUTHORIZED();

    if (
        (req.contentLength ?? 0) > MAX_BODY_BYTES ||
        new TextEncoder().encode(req.bodyText).length > MAX_BODY_BYTES
    ) {
        return reply(413, { error: "payload_too_large" });
    }

    try {
        const tokenRow = await deps.findToken(await sha256Hex(token));
        if (!tokenRow) return UNAUTHORIZED();

        const now = deps.now();
        const minuteCount = await deps.countRecentByToken(
            tokenRow.id,
            new Date(now.getTime() - 60_000).toISOString(),
        );
        if (minuteCount >= RATE_LIMIT_MINUTE) {
            return reply(429, { error: "rate_limited", retry_after: 60 });
        }
        const dayCount = await deps.countRecentByToken(
            tokenRow.id,
            new Date(now.getTime() - 86_400_000).toISOString(),
        );
        if (dayCount >= RATE_LIMIT_DAY) {
            return reply(429, { error: "rate_limited", retry_after: 3600 });
        }

        const body = parseCaptureBody(req.bodyText);
        if (!body) return reply(400, { error: "invalid_json" });

        const rawAlertText =
            typeof body.raw_text === "string" ? body.raw_text.trim() : "";
        const alertTitle =
            typeof body.title === "string" ? body.title.trim() : "";
        const alertSender =
            typeof body.sender === "string" ? body.sender.trim() : "";
        const alertApp = typeof body.app === "string" ? body.app.trim() : "";

        let alert: Extract<BankAlert, { kind: "charge" }> | null = null;
        if (rawAlertText || alertTitle) {
            const parsedAlert = parseBankAlert(
                rawAlertText.slice(0, MAX_RAW_TEXT_LENGTH),
                now,
                {
                    title: alertTitle.slice(0, MAX_RAW_TEXT_LENGTH),
                    sender: alertSender.slice(0, MAX_CARD_LENGTH),
                    app: alertApp.slice(0, MAX_CARD_LENGTH),
                },
            );
            if (parsedAlert.kind === "ignore") {
                return reply(200, {
                    status: "ignored",
                    reason: parsedAlert.reason,
                });
            }
            alert = parsedAlert;
        }

        const currencyField =
            typeof body.currency === "string" ? body.currency : null;
        const amount =
            body.amount === undefined && alert
                ? parseCapturedAmount(alert.rawAmount, currencyField)
                : parseCapturedAmount(body.amount, currencyField);
        if (!amount.ok) {
            if (amount.reason === "ignored")
                return reply(200, { status: "ignored" });
            return reply(400, { error: "invalid_amount" });
        }

        const merchant =
            cleanMerchant(body.merchant) ??
            (alert
                ? (cleanMerchant(alert.merchant ?? "") ??
                  `${alert.bank ?? "Bank"} alert`)
                : null);
        if (!merchant) return reply(400, { error: "invalid_merchant" });
        const merchantKey = normalizeMerchant(merchant);

        const rule = await deps.findRule(tokenRow.household_id, merchantKey);
        if (rule?.action === "ignore") return reply(200, { status: "ignored" });

        const capturedAt = resolveCapturedAt(
            body.occurred_at ??
                body.timestamp ??
                alert?.occurredAt?.toISOString(),
            now,
        );
        const source = normalizeSource(body.source);

        const crossSource = await deps.findRecentCapture({
            memberId: tokenRow.member_id,
            amount: amount.amount,
            currency: amount.currency,
            fromIso: new Date(
                capturedAt.getTime() - IDEMPOTENCY_WINDOW_MS,
            ).toISOString(),
            toIso: new Date(
                capturedAt.getTime() + IDEMPOTENCY_WINDOW_MS,
            ).toISOString(),
            excludeSource: source,
        });
        if (crossSource) {
            await deps.touchToken(tokenRow.id, now.toISOString());
            return reply(200, { status: "duplicate", id: crossSource });
        }
        const idempotencyKey = await buildIdempotencyKey(
            tokenRow.member_id,
            amount.amount,
            amount.currency,
            merchantKey,
            capturedAt,
        );

        const sgtDate =
            toSgtDateTime(capturedAt)?.date ??
            capturedAt.toISOString().slice(0, 10);
        const duplicateOf = await deps.findLikelyDuplicate({
            memberId: tokenRow.member_id,
            amount: amount.amount,
            currency: amount.currency,
            dateFrom: shiftIsoDate(sgtDate, -1),
            dateTo: shiftIsoDate(sgtDate, 1),
        });

        const rawAmount =
            typeof body.amount === "string"
                ? body.amount.slice(0, MAX_RAW_AMOUNT_LENGTH)
                : body.amount === undefined && alert
                  ? alert.rawAmount.slice(0, MAX_RAW_AMOUNT_LENGTH)
                  : null;

        const inserted = await deps.insertItem({
            household_id: tokenRow.household_id,
            member_id: tokenRow.member_id,
            token_id: tokenRow.id,
            source,
            merchant,
            merchant_key: merchantKey,
            amount: amount.amount,
            currency: amount.currency,
            raw_amount: rawAmount,
            card_name: pickString(body.card ?? alert?.bank, MAX_CARD_LENGTH),
            captured_at: capturedAt.toISOString(),
            idempotency_key: idempotencyKey,
            suggested_category_id:
                rule?.action === "categorise" ? rule.category_id : null,
            likely_duplicate_of: duplicateOf,
        });

        await deps.touchToken(tokenRow.id, now.toISOString());

        if (!inserted) {
            const existing = await deps.findByIdempotencyKey(
                tokenRow.member_id,
                idempotencyKey,
            );
            return reply(200, {
                status: "duplicate",
                id: existing?.id ?? null,
            });
        }

        const inboxCount = await deps.countPending(tokenRow.household_id);
        return reply(201, { status: "captured", id: inserted.id, inboxCount });
    } catch (err) {
        if (isMissingRelationError(err))
            return reply(503, { error: "not_ready" });
        const code = (err as { code?: unknown })?.code;
        console.error(
            "capture-expense failed",
            typeof code === "string" ? code : "unknown",
        );
        return reply(500, { error: "server_error" });
    }
}

/** Builds the deps from a service-role Supabase client. */
export function createSupabaseCaptureDeps(client: SupabaseClient): CaptureDeps {
    const raise = (error: unknown) => {
        if (error) throw error;
    };
    return {
        async findToken(tokenHash) {
            const { data, error } = await client
                .from("capture_tokens")
                .select("id, member_id, household_id")
                .eq("token_hash", tokenHash)
                .is("revoked_at", null)
                .maybeSingle();
            raise(error);
            return (data as CaptureTokenRow | null) ?? null;
        },
        async countRecentByToken(tokenId, sinceIso) {
            const { count, error } = await client
                .from("inbox_items")
                .select("id", { count: "exact", head: true })
                .eq("token_id", tokenId)
                .gte("created_at", sinceIso);
            raise(error);
            return count ?? 0;
        },
        async findRule(householdId, merchantKey) {
            const { data, error } = await client
                .from("merchant_rules")
                .select("action, category_id")
                .eq("household_id", householdId)
                .eq("merchant_key", merchantKey)
                .maybeSingle();
            raise(error);
            return (
                (data as {
                    action: "categorise" | "ignore";
                    category_id: string | null;
                } | null) ?? null
            );
        },
        async findLikelyDuplicate({
            memberId,
            amount,
            currency,
            dateFrom,
            dateTo,
        }) {
            let query = client
                .from("expenses")
                .select("id")
                .eq("payer_id", memberId)
                .gte("date", dateFrom)
                .lte("date", dateTo);
            query =
                currency === "SGD"
                    ? query.eq("amount", amount)
                    : query
                          .eq("original_amount", amount)
                          .eq("original_currency", currency);
            const { data, error } = await query.limit(1);
            raise(error);
            return (data?.[0]?.id as string | undefined) ?? null;
        },
        async findRecentCapture({
            memberId,
            amount,
            currency,
            fromIso,
            toIso,
            excludeSource,
        }) {
            const { data, error } = await client
                .from("inbox_items")
                .select("id")
                .eq("member_id", memberId)
                .eq("amount", amount)
                .eq("currency", currency)
                .neq("source", excludeSource)
                .gte("captured_at", fromIso)
                .lte("captured_at", toIso)
                .limit(1);
            raise(error);
            return (data?.[0]?.id as string | undefined) ?? null;
        },
        async insertItem(row) {
            const { data, error } = await client
                .from("inbox_items")
                .upsert(row, {
                    onConflict: "member_id,idempotency_key",
                    ignoreDuplicates: true,
                })
                .select("id");
            raise(error);
            const id = data?.[0]?.id as string | undefined;
            return id ? { id } : null;
        },
        async findByIdempotencyKey(memberId, key) {
            const { data, error } = await client
                .from("inbox_items")
                .select("id")
                .eq("member_id", memberId)
                .eq("idempotency_key", key)
                .maybeSingle();
            raise(error);
            return (data as { id: string } | null) ?? null;
        },
        async countPending(householdId) {
            const { count, error } = await client
                .from("inbox_items")
                .select("id", { count: "exact", head: true })
                .eq("household_id", householdId)
                .eq("status", "pending");
            raise(error);
            return count ?? 0;
        },
        async touchToken(tokenId, nowIso) {
            const { error } = await client
                .from("capture_tokens")
                .update({ last_used_at: nowIso })
                .eq("id", tokenId);
            raise(error);
        },
        now: () => new Date(),
    };
}
