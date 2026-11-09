/**
 * MarkCardPaidModal
 * Quick "Mark Paid" flow for a credit card cycle: confirm the amount paid and
 * record the payment. Creates the statement row if it was never logged.
 */

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
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
            await financeService.upsertCreditCardStatement({
                card_id: cycle.card.id,
                month: cycle.month,
                statement_amount: Math.round(parsed * 100) / 100,
                due_date: cycle.dueDate,
                notes: cycle.statement?.notes ?? null,
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
