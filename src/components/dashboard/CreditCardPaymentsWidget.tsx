/**
 * CreditCardPaymentsWidget
 * Upcoming credit card bills computed from card config (no pre-logged
 * statement needed), each with a direct "Mark Paid" action.
 */

import React, { useMemo, useState } from "react";
import { CreditCard as CreditCardIcon, ChevronRight, ExternalLink } from "lucide-react";
import {
    formatDueInDays,
    formatISODate,
    getSingaporeDate,
} from "../../lib/dateUtils";
import {
    getUnpaidCardCycles,
    type CardCycle,
} from "../../lib/creditCardCycles";
import { getBankDeepLink, openBankApp } from "../../lib/bankDeepLinks";
import { TruncatedText } from "../ui/TruncatedText";
import { CurrencyText } from "../ui/CurrencyText";
import { Button } from "../ui/Button";
import { MarkCardPaidModal } from "../accounts/MarkCardPaidModal";
import { BulkSettleOverdueModal } from "./BulkSettleOverdueModal";
import type { CreditCard, CreditCardStatement } from "../../types/finance";

export interface CreditCardPaymentsWidgetProps {
    cards: CreditCard[];
    statements: CreditCardStatement[];
    /** Restrict to one member's cards (personal view). */
    memberId?: string;
    onViewAll?: () => void;
    /** Called after a payment is saved, to refresh queries. */
    onPaid: () => void;
    className?: string;
    /** Overrides "today" ('YYYY-MM-DD', Singapore time). */
    today?: string;
}

function dueLabel(days: number): string {
    if (days < 0) return `Overdue by ${-days} day${days === -1 ? "" : "s"}`;
    return formatDueInDays(days);
}

const CycleRow = React.memo(function CycleRow({
    cycle,
    onMarkPaid,
}: {
    cycle: CardCycle;
    onMarkPaid: (cycle: CardCycle) => void;
}) {
    const overdue = cycle.daysUntilDue < 0;
    const bankConfig = getBankDeepLink(cycle.card.bank);

    return (
        <div
            data-testid={`cc-cycle-${cycle.key}`}
            className="space-y-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3 sm:p-3.5 shadow-cute-sm"
        >
            <div className="flex items-center gap-3">
                <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) text-white shadow-cute-sm"
                    style={{ backgroundColor: cycle.card.color || "#dfc2ff" }}
                >
                    <CreditCardIcon className="h-4 w-4" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                        <TruncatedText
                            as="div"
                            text={cycle.card.name}
                            className="text-sm font-bold text-(--text-ink) font-display min-w-0"
                        />
                        {bankConfig && (
                            <button
                                type="button"
                                onClick={() => openBankApp(cycle.card.bank)}
                                title={`Open ${bankConfig.bankName} app`}
                                aria-label={`Open ${bankConfig.bankName} app for ${cycle.card.name}`}
                                className="inline-flex shrink-0 items-center gap-1 rounded-lg border-2 border-(--border-ink) bg-(--bg-card) px-2 py-0.5 text-[11px] font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                            >
                                <ExternalLink className="h-3 w-3" />
                                <span>Open App</span>
                            </button>
                        )}
                    </div>
                    <span
                        className={`block text-xs font-bold ${
                            overdue
                                ? "text-(--accent-coral-ink) dark:text-rose-400"
                                : cycle.daysUntilDue <= 7
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-(--text-muted)"
                        }`}
                    >
                        {dueLabel(cycle.daysUntilDue)}
                    </span>
                </div>
                <div className="shrink-0 text-right text-(--text-ink)">
                    {cycle.amount !== null ? (
                        <CurrencyText amount={cycle.amount} size="md" />
                    ) : (
                        <span className="text-xs font-bold text-(--text-muted)">
                            Pending
                        </span>
                    )}
                </div>
            </div>
            <Button
                variant="secondary"
                size="sm"
                type="button"
                className="w-full min-h-11 justify-center"
                aria-label={`Mark ${cycle.card.name} paid`}
                onClick={() => onMarkPaid(cycle)}
            >
                Mark Paid
            </Button>
        </div>
    );
});

export const CreditCardPaymentsWidget = React.memo(
    function CreditCardPaymentsWidget({
        cards,
        statements,
        memberId,
        onViewAll,
        onPaid,
        className = "",
        today,
    }: CreditCardPaymentsWidgetProps) {
        const [payingCycle, setPayingCycle] = useState<CardCycle | null>(null);
        const [isBulkSettleOpen, setIsBulkSettleOpen] = useState(false);

        const cycles = useMemo(
            () =>
                getUnpaidCardCycles(
                    cards,
                    statements,
                    today ?? formatISODate(getSingaporeDate()),
                    memberId,
                ),
            [cards, statements, today, memberId],
        );

        const overdueCycles = useMemo(
            () => cycles.filter((c) => c.daysUntilDue < 0),
            [cycles],
        );

        if (cycles.length === 0) return null;

        return (
            <div
                role="region"
                aria-label="Card Payments"
                className={`rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-5 sm:p-6 shadow-cute transition-colors ${className}`}
            >
                <div className="flex items-center justify-between gap-3 pb-4 border-b-2 border-(--border-ink)">
                    <div className="flex items-center gap-2.5 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm">
                            <CreditCardIcon
                                className="h-5 w-5"
                                strokeWidth={2.5}
                            />
                        </div>
                        <h3 className="min-w-0 text-sm sm:text-base font-black text-(--text-ink) font-display">
                            Card Payments
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {overdueCycles.length >= 2 && (
                            <button
                                type="button"
                                onClick={() => setIsBulkSettleOpen(true)}
                                className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-xl border-2 border-(--border-ink) bg-(--pastel-coral) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--bg-card) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                            >
                                <span>
                                    Settle Overdue ({overdueCycles.length})
                                </span>
                            </button>
                        )}
                        {onViewAll && (
                            <button
                                type="button"
                                onClick={onViewAll}
                                className="inline-flex shrink-0 whitespace-nowrap items-center gap-1 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--bg-card) active:translate-x-0.5 active:translate-y-0.5 transition-press cursor-pointer"
                            >
                                <span>View All</span>
                                <ChevronRight
                                    className="h-3.5 w-3.5"
                                    strokeWidth={2.5}
                                />
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-4 space-y-2.5">
                    {cycles.map((cycle) => (
                        <CycleRow
                            key={cycle.key}
                            cycle={cycle}
                            onMarkPaid={setPayingCycle}
                        />
                    ))}
                </div>

                <MarkCardPaidModal
                    cycle={payingCycle}
                    onClose={() => setPayingCycle(null)}
                    onPaid={onPaid}
                />

                <BulkSettleOverdueModal
                    cycles={overdueCycles}
                    isOpen={isBulkSettleOpen}
                    onClose={() => setIsBulkSettleOpen(false)}
                    onPaid={onPaid}
                />
            </div>
        );
    },
);
CreditCardPaymentsWidget.displayName = "CreditCardPaymentsWidget";

export default CreditCardPaymentsWidget;
