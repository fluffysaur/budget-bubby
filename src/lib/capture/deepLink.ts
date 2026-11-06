/**
 * Reads `/expenses?action=new&amount=…&merchant=…&card=…&at=…` (the PWA
 * "Add Expense" shortcut and the capture Shortcut's fallback) into Add
 * Expense prefill values. Params are only prefill: nothing saves until the
 * user taps Save.
 */

import type { ExpenseFormInitialValues } from "../../components/expenses/ExpenseFormModal";
import { cleanMerchant } from "./merchant";
import { parseCapturedAmount } from "./parseAmount";
import { toSgtDateTime } from "./sgTime";

export const DEEP_LINK_PARAMS = ["action", "amount", "merchant", "card", "at", "currency"] as const;

const MAX_PARAM_LENGTH = 200;

function param(params: URLSearchParams, key: string): string | null {
    const value = params.get(key);
    if (value === null) return null;
    return value.slice(0, MAX_PARAM_LENGTH);
}

/** Null when the URL is not an Add Expense deep link. */
export function parseQuickAddDeepLink(search: string): ExpenseFormInitialValues | null {
    const params = new URLSearchParams(search);
    if (params.get("action") !== "new") return null;

    const values: ExpenseFormInitialValues = {};

    const rawAmount = param(params, "amount");
    if (rawAmount) {
        const parsed = parseCapturedAmount(rawAmount, param(params, "currency"));
        if (parsed.ok) {
            if (parsed.currency === "SGD") {
                values.amount = parsed.amount;
            } else {
                values.original_currency = parsed.currency;
                values.original_amount = parsed.amount;
            }
        }
    }

    const merchant = cleanMerchant(param(params, "merchant"));
    if (merchant) values.item = merchant;

    const at = param(params, "at");
    if (at) {
        const sgt = toSgtDateTime(at);
        const ms = new Date(at).getTime();
        // Only the last week: older or future stamps are probably wrong
        if (sgt && ms <= Date.now() + 10 * 60_000 && ms >= Date.now() - 7 * 86_400_000) {
            values.date = sgt.date;
            values.time = sgt.time;
        }
    }

    return values;
}

/** The search string with the deep-link params removed. */
export function stripQuickAddParams(search: string): string {
    const params = new URLSearchParams(search);
    for (const key of DEEP_LINK_PARAMS) params.delete(key);
    const rest = params.toString();
    return rest ? `?${rest}` : "";
}
