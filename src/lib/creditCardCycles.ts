/**
 * Credit card billing cycles computed from card config, so due dates exist
 * before anyone logs a statement. A logged statement overrides the computed
 * amount and due date.
 */

import type { CreditCard, CreditCardStatement } from "../types/finance";
import {
    addMonths,
    clampDueDay,
    daysBetweenISO,
    getDefaultStatementDueDate,
} from "./dateUtils";

export type CardCycleStatus = "pending" | "unpaid" | "paid";

export interface CardCycle {
    /** Stable key: `${cardId}:${month}` */
    key: string;
    card: CreditCard;
    /** Statement month, 'YYYY-MM' */
    month: string;
    /** Day the cycle closes, 'YYYY-MM-DD' */
    statementDate: string;
    dueDate: string;
    /** Logged statement, if any */
    statement: CreditCardStatement | null;
    /** Statement amount, or null while unrecorded */
    amount: number | null;
    status: CardCycleStatus;
    /** Negative when overdue */
    daysUntilDue: number;
}

/** Statement date (billing day) of a 'YYYY-MM' month, clamped to month length. */
export function getStatementDate(month: string, billingDay: number): string {
    const [year, mon] = month.split("-").map(Number);
    const day = clampDueDay(billingDay, year, mon);
    return `${month}-${String(day).padStart(2, "0")}`;
}

/** Latest month whose statement date has been reached on `today` ('YYYY-MM-DD'). */
export function getLatestClosedMonth(card: CreditCard, today: string): string {
    const month = today.slice(0, 7);
    return today >= getStatementDate(month, card.billing_day)
        ? month
        : addMonths(month, -1);
}

/** Cycle for a specific card + month; `statement` overrides computed values. */
export function getCardCycle(
    card: CreditCard,
    month: string,
    statement: CreditCardStatement | null,
    today: string,
): CardCycle {
    const dueDate =
        statement?.due_date ||
        getDefaultStatementDueDate(month, card.due_day || 5, card.billing_day);
    return {
        key: `${card.id}:${month}`,
        card,
        month,
        statementDate: getStatementDate(month, card.billing_day),
        dueDate,
        statement,
        amount: statement ? statement.statement_amount : null,
        status: statement ? (statement.is_paid ? "paid" : "unpaid") : "pending",
        daysUntilDue: daysBetweenISO(today, dueDate),
    };
}

/**
 * Every unpaid cycle, sorted by due date: the latest closed cycle of each
 * active card (computed when unlogged) plus any older logged unpaid statements.
 */
export function getUnpaidCardCycles(
    cards: CreditCard[],
    statements: CreditCardStatement[],
    today: string,
    memberId?: string,
): CardCycle[] {
    const cycles: CardCycle[] = [];

    for (const card of cards) {
        if (!card.is_active) continue;
        if (memberId && card.owner_id && card.owner_id !== memberId) continue;

        const own = statements.filter((s) => s.card_id === card.id);
        const latestMonth = getLatestClosedMonth(card, today);
        const latest = own.find((s) => s.month === latestMonth) ?? null;

        if (!latest?.is_paid) {
            cycles.push(getCardCycle(card, latestMonth, latest, today));
        }
        for (const s of own) {
            if (s.is_paid || s.month === latestMonth) continue;
            cycles.push(getCardCycle(card, s.month, s, today));
        }
    }

    return cycles.sort(
        (a, b) =>
            a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key),
    );
}
