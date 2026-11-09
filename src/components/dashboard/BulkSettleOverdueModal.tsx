/**
 * BulkSettleOverdueModal
 * Allows settling multiple overdue credit card cycles simultaneously, defaulting
 * to $0 (no spend / already settled outside) while permitting per-card edits.
 */

import { useState, useId, type FormEvent } from "react";
import { CheckCircle2, CreditCard as CreditCardIcon } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { TruncatedText } from "../ui/TruncatedText";
import { financeService } from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import type { CardCycle } from "../../lib/creditCardCycles";

export interface BulkSettleOverdueModalProps {
    cycles: CardCycle[];
    isOpen: boolean;
    onClose: () => void;
    onPaid: () => void;
}

export function BulkSettleOverdueModal({
    cycles,
    isOpen,
    onClose,
    onPaid,
}: BulkSettleOverdueModalProps) {
    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            {isOpen && (
                <BulkSettleOverdueForm
                    key={cycles.map((c) => c.key).join(",")}
                    cycles={cycles}
                    onClose={onClose}
                    onPaid={onPaid}
                />
            )}
        </AnimatedModal>
    );
}

function BulkSettleOverdueForm({
    cycles,
    onClose,
    onPaid,
}: {
    cycles: CardCycle[];
    onClose: () => void;
    onPaid: () => void;
}) {
    const inputPrefixId = useId();
    const [amounts, setAmounts] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        for (const c of cycles) {
            initial[c.key] = c.amount !== null ? String(c.amount) : "0";
        }
        return initial;
    });

    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleAmountChange = (key: string, val: string) => {
        setAmounts((prev) => ({ ...prev, [key]: val }));
    };

    const handleSetAllZero = () => {
        setAmounts((prev) => {
            const next: Record<string, string> = {};
            for (const key of Object.keys(prev)) {
                next[key] = "0";
            }
            return next;
        });
        setError(null);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setError(null);

        // Validate all amounts
        const validated: Array<{ cycle: CardCycle; amount: number }> = [];
        for (const cycle of cycles) {
            const val = amounts[cycle.key] ?? "0";
            const parsed = parseFloat(val);
            if (isNaN(parsed) || parsed < 0) {
                setError(`Enter a valid amount for ${cycle.card.name}`);
                return;
            }
            validated.push({
                cycle,
                amount: Math.round(parsed * 100) / 100,
            });
        }

        setSaving(true);
        try {
            const now = new Date().toISOString();
            await Promise.all(
                validated.map(({ cycle, amount }) => {
                    const isZero = amount === 0;
                    const defaultNotes = isZero ? "No spend" : null;
                    return financeService.upsertCreditCardStatement({
                        card_id: cycle.card.id,
                        month: cycle.month,
                        statement_amount: amount,
                        due_date: cycle.dueDate,
                        notes: cycle.statement?.notes ?? defaultNotes,
                        is_paid: true,
                        paid_at: now,
                    });
                }),
            );

            feedback.milestone("bill-paid", {
                dedupeKey: `bulk-bills-paid:${cycles.map((c) => c.card.id).join("-")}`,
            });
            onPaid();
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to settle cards",
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
                title="Settle Overdue Bills"
                subtitle={`${cycles.length} cards currently marked overdue`}
                icon={<CheckCircle2 className="h-5 w-5" strokeWidth={2.5} />}
                iconBgColor="bg-(--pastel-mint)"
                onClose={onClose}
            />

            <ModalBody className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="flex items-center justify-between text-xs text-(--text-muted)">
                    <span>Amounts default to $0 (already paid or no spend).</span>
                    <button
                        type="button"
                        onClick={handleSetAllZero}
                        className="font-bold underline hover:text-(--text-ink) cursor-pointer"
                    >
                        Reset All to $0
                    </button>
                </div>

                <div className="space-y-3">
                    {cycles.map((cycle, index) => {
                        const val = amounts[cycle.key] ?? "0";
                        const inputId = `${inputPrefixId}-bulk-amount-${index}`;
                        return (
                            <div
                                key={cycle.key}
                                className="flex items-center gap-3 p-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) shadow-cute-sm"
                            >
                                <div
                                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 border-(--border-ink) text-white shadow-cute-sm"
                                    style={{
                                        backgroundColor:
                                            cycle.card.color || "#dfc2ff",
                                    }}
                                >
                                    <CreditCardIcon
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                </div>
                                <div className="min-w-0 flex-1">
                                    <TruncatedText
                                        as="div"
                                        text={cycle.card.name}
                                        className="text-xs font-bold text-(--text-ink) font-display"
                                    />
                                    <span className="block text-[11px] font-bold text-(--accent-coral-ink) dark:text-rose-400">
                                        Overdue by {Math.abs(cycle.daysUntilDue)} days
                                    </span>
                                </div>
                                <div className="w-24 shrink-0">
                                    <label htmlFor={inputId} className="sr-only">
                                        Amount for {cycle.card.name}
                                    </label>
                                    <div className="relative flex items-center">
                                        <span className="absolute left-2 text-xs font-bold text-(--text-muted)">
                                            $
                                        </span>
                                        <input
                                            id={inputId}
                                            type="number"
                                            inputMode="decimal"
                                            step="0.01"
                                            min="0"
                                            value={val}
                                            onChange={(e) =>
                                                handleAmountChange(
                                                    cycle.key,
                                                    e.target.value,
                                                )
                                            }
                                            className="w-full h-8 pl-5 pr-2 text-right text-base sm:text-xs font-mono font-bold rounded-lg border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm focus:outline-none focus:ring-2 focus:ring-(--accent-lilac)"
                                        />
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </ModalBody>

            <ModalFooter className="justify-end gap-2">
                <Button variant="secondary" type="button" onClick={onClose}>
                    Cancel
                </Button>
                <Button variant="primary" type="submit" disabled={saving}>
                    {saving
                        ? "Settling..."
                        : `Settle ${cycles.length} Cards`}
                </Button>
            </ModalFooter>
        </form>
    );
}
