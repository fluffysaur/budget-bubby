/**
 * MarkCardPaidModal
 * Quick "Mark Paid" flow for a credit card cycle: confirm the amount paid and
 * record the payment. Creates the statement row if it was never logged.
 */

import { useState, type FormEvent } from "react";
import { CheckCircle2, ExternalLink } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";
import { financeService } from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import { formatDisplayDate } from "../../lib/dateUtils";
import { getBankDeepLink, openBankApp } from "../../lib/bankDeepLinks";
import type { CardCycle } from "../../lib/creditCardCycles";

export interface MarkCardPaidModalProps {
    /** Cycle being paid; the modal is closed when null. */
    cycle: CardCycle | null;
    onClose: () => void;
    /** Called after the payment is saved. */
    onPaid: () => void;
}

export function MarkCardPaidModal({
    cycle,
    onClose,
    onPaid,
}: MarkCardPaidModalProps) {
    return (
        <AnimatedModal
            isOpen={cycle !== null}
            onClose={onClose}
            maxWidth="max-w-sm"
        >
            {cycle && (
                <MarkCardPaidForm
                    key={cycle.key}
                    cycle={cycle}
                    onClose={onClose}
                    onPaid={onPaid}
                />
            )}
        </AnimatedModal>
    );
}

function MarkCardPaidForm({
    cycle,
    onClose,
    onPaid,
}: {
    cycle: CardCycle;
    onClose: () => void;
    onPaid: () => void;
}) {
    const [amount, setAmount] = useState<string>(
        cycle.amount !== null ? String(cycle.amount) : "",
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const bankConfig = getBankDeepLink(cycle.card.bank);

    const handleQuickZero = () => {
        setAmount("0");
        setError(null);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const parsed = parseFloat(amount);
        if (isNaN(parsed) || parsed < 0) {
            setError("Enter an amount");
            return;
        }
        setError(null);
        setSaving(true);
        try {
            const isZero = parsed === 0;
            const defaultNotes = isZero ? "No spend" : null;
            await financeService.upsertCreditCardStatement({
                card_id: cycle.card.id,
                month: cycle.month,
                statement_amount: Math.round(parsed * 100) / 100,
                due_date: cycle.dueDate,
                notes: cycle.statement?.notes ?? defaultNotes,
                is_paid: true,
                paid_at: new Date().toISOString(),
            });
            feedback.milestone("bill-paid", {
                dedupeKey: `bill-paid:${cycle.card.id}:${cycle.month}`,
            });
            onPaid();
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to save payment",
            );
        } finally {
            setSaving(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="flex flex-col min-h-0 flex-1 overflow-hidden"
        >
            <ModalHeader
                title="Mark Paid"
                subtitle={`${cycle.card.name} • Due ${formatDisplayDate(cycle.dueDate)}`}
                icon={<CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />}
                iconBgColor="bg-(--pastel-mint)"
                onClose={onClose}
            />
            <ModalBody className="p-5 space-y-4">
                {error && <Alert variant="danger">{error}</Alert>}

                {bankConfig && (
                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm">
                        <div className="min-w-0 flex-1">
                            <span className="block text-xs font-bold text-(--text-ink)">
                                Check statement in {bankConfig.bankName}
                            </span>
                            <span className="block text-[11px] font-medium text-(--text-muted) truncate">
                                Open mobile app or portal
                            </span>
                        </div>
                        <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => openBankApp(cycle.card.bank)}
                            className="shrink-0 text-xs gap-1.5"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Open App</span>
                        </Button>
                    </div>
                )}

                <div className="space-y-2">
                    <Input
                        id="paid-amount"
                        label="Amount Paid"
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        min="0"
                        mono
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="e.g. 842.50"
                        required
                        autoFocus
                    />
                    <div className="flex items-center justify-between pt-1">
                        <span className="text-xs font-bold text-(--text-muted)">
                            Card had no activity?
                        </span>
                        <button
                            type="button"
                            onClick={handleQuickZero}
                            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-black rounded-lg border-2 border-(--border-ink) bg-(--pastel-lilac) hover:bg-(--bg-card) active:translate-x-0.5 active:translate-y-0.5 text-(--text-ink) shadow-cute-sm transition-press cursor-pointer"
                        >
                            $0 (No Spend)
                        </button>
                    </div>
                </div>
            </ModalBody>
            <ModalFooter className="justify-end gap-2">
                <Button variant="secondary" type="button" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? "Saving..." : "Mark Paid"}
                </Button>
            </ModalFooter>
        </form>
    );
}
