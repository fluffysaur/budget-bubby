/**
 * StatementPaidModal
 * Confirms marking a logged statement as paid. Full payment is assumed;
 * ticking "Partial payment" reveals an amount-paid input. Log only, no
 * carry-over of the remainder.
 */

import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { m, AnimatePresence } from "motion/react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Alert } from "../ui/Alert";
import { CurrencyText } from "../ui/CurrencyText";
import { collapse } from "../../lib/motion";
import { validatePartialAmount } from "../../lib/creditCardPayments";
import type { CreditCardStatement } from "../../types/finance";

export interface StatementPaidModalProps {
    /** Statement being paid; the modal is closed when null. */
    statement: CreditCardStatement | null;
    cardName: string;
    onClose: () => void;
    /** Receives null for a full payment, or the partial amount. */
    onConfirm: (amountPaid: number | null) => Promise<void> | void;
}

export function StatementPaidModal({
    statement,
    cardName,
    onClose,
    onConfirm,
}: StatementPaidModalProps) {
    return (
        <AnimatedModal
            isOpen={statement !== null}
            onClose={onClose}
            maxWidth="max-w-sm"
        >
            {statement && (
                <StatementPaidForm
                    key={statement.id}
                    statement={statement}
                    cardName={cardName}
                    onClose={onClose}
                    onConfirm={onConfirm}
                />
            )}
        </AnimatedModal>
    );
}

function StatementPaidForm({
    statement,
    cardName,
    onClose,
    onConfirm,
}: {
    statement: CreditCardStatement;
    cardName: string;
    onClose: () => void;
    onConfirm: StatementPaidModalProps["onConfirm"];
}) {
    const [partial, setPartial] = useState(false);
    const [amount, setAmount] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        let amountPaid: number | null = null;
        if (partial) {
            const result = validatePartialAmount(
                amount,
                statement.statement_amount,
            );
            if (result.error) {
                setError(result.error);
                return;
            }
            amountPaid = result.value;
        }
        setError(null);
        setSaving(true);
        try {
            await onConfirm(amountPaid);
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
                subtitle={cardName}
                icon={<CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />}
                iconBgColor="bg-(--pastel-mint)"
                onClose={onClose}
            />
            <ModalBody className="p-5 space-y-4">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-bold text-(--text-muted)">
                        Statement
                    </span>
                    <CurrencyText
                        amount={statement.statement_amount}
                        size="md"
                    />
                </div>

                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) px-3 shadow-cute-sm">
                    <input
                        type="checkbox"
                        checked={partial}
                        onChange={(e) => {
                            setPartial(e.target.checked);
                            setError(null);
                        }}
                        className="h-5 w-5 shrink-0 cursor-pointer accent-(--text-ink)"
                    />
                    <span className="min-w-0 flex-1 text-sm font-bold text-(--text-ink)">
                        Partial payment
                    </span>
                </label>

                <AnimatePresence initial={false}>
                    {partial && (
                        <m.div key="partial-amount" {...collapse}>
                            <Input
                                label="Amount Paid"
                                type="number"
                                inputMode="decimal"
                                step="0.01"
                                min="0"
                                mono
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0.00"
                                autoFocus
                            />
                        </m.div>
                    )}
                </AnimatePresence>
            </ModalBody>
            <ModalFooter>
                <Button variant="secondary" type="button" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                    {saving ? "Saving" : "Confirm"}
                </Button>
            </ModalFooter>
        </form>
    );
}
