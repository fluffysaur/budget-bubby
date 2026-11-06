/** Turns an inbox item into the expense it confirms as. Pure. */

import { SUPPORTED_CURRENCIES, buildExpenseFxFields } from "../currencyConverter";
import { toSgtDateTime } from "./sgTime";
import type { CreateExpenseInput, Expense, InboxItem } from "../../types/finance";
import type { ExpenseFormInitialValues } from "../../components/expenses/ExpenseFormModal";

/** SGD, or a currency with a cached/default rate. Others go to the full form. */
export function canQuickConfirm(item: Pick<InboxItem, "currency">): boolean {
    return item.currency === "SGD" || SUPPORTED_CURRENCIES.some((c) => c.code === item.currency);
}

export function buildInboxExpenseInput(
    item: InboxItem,
    choice: { categoryId: string | null; isShared: boolean },
): CreateExpenseInput {
    const sgt = toSgtDateTime(item.captured_at);
    return {
        household_id: item.household_id,
        payer_id: item.member_id,
        category_id: choice.categoryId,
        date: sgt?.date ?? item.captured_at.slice(0, 10),
        time: sgt?.time ?? null,
        item: item.merchant,
        ...buildExpenseFxFields(Number(item.amount), item.currency),
        is_shared: choice.isShared,
        split_ratio: choice.isShared ? 0.5 : 0,
    };
}

/** Prefill for opening the full form on an inbox item (Edit, From Inbox). */
export function inboxItemFormValues(
    item: InboxItem,
    choice: { categoryId: string | null; isShared: boolean | null },
): ExpenseFormInitialValues {
    const sgt = toSgtDateTime(item.captured_at);
    const foreign = item.currency !== "SGD";
    return {
        item: item.merchant,
        payer_id: item.member_id,
        date: sgt?.date,
        time: sgt?.time,
        ...(foreign
            ? { original_currency: item.currency, original_amount: Number(item.amount) }
            : { amount: Number(item.amount) }),
        ...(choice.categoryId ? { category_id: choice.categoryId } : {}),
        ...(choice.isShared !== null ? { is_shared: choice.isShared } : {}),
    };
}

/** The `expenseAdded` detail for an inbox confirm (listeners skip the toast). */
export function inboxExpenseEventDetail(
    expenseId: string,
    input: CreateExpenseInput,
): Expense & { source: "inbox" } {
    return {
        id: expenseId,
        household_id: input.household_id ?? "",
        payer_id: input.payer_id,
        category_id: input.category_id ?? null,
        date: input.date,
        time: input.time ?? null,
        item: input.item,
        amount: input.amount,
        remarks: input.remarks ?? null,
        is_shared: input.is_shared,
        split_ratio: input.split_ratio ?? 0.5,
        settled: false,
        tags: input.tags ?? [],
        goal_id: input.goal_id ?? null,
        original_amount: input.original_amount ?? null,
        original_currency: input.original_currency ?? "SGD",
        exchange_rate: input.exchange_rate ?? null,
        source: "inbox",
    };
}

export function dispatchInboxExpenseAdded(expenseId: string, input: CreateExpenseInput): void {
    if (typeof window === "undefined") return;
    window.dispatchEvent(
        new CustomEvent("expenseAdded", { detail: inboxExpenseEventDetail(expenseId, input) }),
    );
}
