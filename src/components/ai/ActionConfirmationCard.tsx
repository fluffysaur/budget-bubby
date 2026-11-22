/**
 * Interactive confirmation card for AI-proposed financial mutations.
 * Never mutates data automatically; requires explicit user confirmation.
 */

import { useState } from "react";
import {
    Check,
    X,
    Receipt,
    Wallet,
    SlidersHorizontal,
} from "lucide-react";
import type { ProposedAction } from "../../services/ai/aiTools";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CurrencyText } from "../ui/CurrencyText";
import { TruncatedText } from "../ui/TruncatedText";

export interface ActionConfirmationCardProps {
    action: ProposedAction;
    onConfirm: (action: ProposedAction) => Promise<void>;
    onCancel: (actionId: string) => void;
}

export function ActionConfirmationCard({
    action,
    onConfirm,
    onCancel,
}: ActionConfirmationCardProps) {
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleConfirm = async () => {
        setIsSubmitting(true);
        try {
            await onConfirm(action);
        } finally {
            setIsSubmitting(false);
        }
    };

    const IconComponent =
        action.type === "proposeExpense"
            ? Receipt
            : action.type === "proposeBalanceUpdate"
              ? Wallet
              : SlidersHorizontal;

    const iconBg =
        action.type === "proposeExpense"
            ? "bg-(--pastel-coral-light)"
            : action.type === "proposeBalanceUpdate"
              ? "bg-(--pastel-mint-light)"
              : "bg-(--pastel-butter-light)";

    const statusBadge =
        action.status === "confirmed" ? (
            <Badge variant="mint" size="sm">
                Saved
            </Badge>
        ) : action.status === "cancelled" ? (
            <Badge variant="slate" size="sm">
                Cancelled
            </Badge>
        ) : (
            <Badge variant="butter" size="sm">
                Review
            </Badge>
        );

    const canAct = action.status === "pending" || action.status === "error";

    return (
        <Card
            elevation="sm"
            padding="sm"
            className="bg-(--bg-cream) space-y-3"
            data-testid={`action-card-${action.type}`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) ${iconBg} text-(--text-ink)`}
                    >
                        <IconComponent className="h-4 w-4" strokeWidth={2.5} />
                    </div>
                    <span className="text-xs font-black uppercase tracking-wider text-(--text-ink) font-display truncate">
                        {action.title}
                    </span>
                </div>
                <div className="shrink-0">{statusBadge}</div>
            </div>

            {action.type === "proposeExpense" && (
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 font-bold text-(--text-ink)">
                            <TruncatedText text={action.payload.item} />
                        </div>
                        <CurrencyText
                            amount={action.payload.amount}
                            className="shrink-0 font-black text-sm text-(--text-ink)"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold text-(--text-muted)">
                        <span>{action.payload.date}</span>
                        {action.payload.categoryName && (
                            <Badge variant="lilac" size="sm">
                                {action.payload.categoryName}
                            </Badge>
                        )}
                        {action.payload.isShared && (
                            <Badge variant="blush" size="sm">
                                Shared ({Math.round(action.payload.splitRatio * 100)}
                                %)
                            </Badge>
                        )}
                    </div>
                    {action.payload.remarks && (
                        <p className="text-[11px] text-(--text-muted) wrap-break-word">
                            {action.payload.remarks}
                        </p>
                    )}
                </div>
            )}

            {action.type === "proposeBalanceUpdate" && (
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1 font-bold text-(--text-ink)">
                            <TruncatedText text={action.payload.accountName} />
                        </div>
                        <CurrencyText
                            amount={action.payload.newBalance}
                            className="shrink-0 font-black text-sm text-(--text-ink)"
                        />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-(--text-muted)">
                        {action.payload.previousBalance !== undefined && (
                            <span>
                                Was{" "}
                                <CurrencyText
                                    amount={action.payload.previousBalance}
                                    tone="muted"
                                />
                            </span>
                        )}
                        <span>{action.payload.date}</span>
                    </div>
                    {action.payload.notes && (
                        <p className="text-[11px] text-(--text-muted) wrap-break-word">
                            {action.payload.notes}
                        </p>
                    )}
                </div>
            )}

            {action.type === "proposeBudgetAdjustment" && (
                <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-(--text-ink)">
                            Month
                        </span>
                        <span className="font-mono-num font-bold text-(--text-ink)">
                            {action.payload.month}
                        </span>
                    </div>
                    {action.payload.grossSalary !== undefined && (
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-(--text-muted) font-semibold">
                                Gross Salary
                            </span>
                            <CurrencyText
                                amount={action.payload.grossSalary}
                                className="font-bold text-(--text-ink)"
                            />
                        </div>
                    )}
                    {action.payload.bonus !== undefined && (
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-(--text-muted) font-semibold">
                                Bonus
                            </span>
                            <CurrencyText
                                amount={action.payload.bonus}
                                className="font-bold text-(--text-ink)"
                            />
                        </div>
                    )}
                    {action.payload.cpfDeduction !== undefined && (
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-(--text-muted) font-semibold">
                                CPF Deduction
                            </span>
                            <CurrencyText
                                amount={action.payload.cpfDeduction}
                                className="font-bold text-(--text-ink)"
                            />
                        </div>
                    )}
                    {action.payload.taxesDeduction !== undefined && (
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-(--text-muted) font-semibold">
                                Taxes
                            </span>
                            <CurrencyText
                                amount={action.payload.taxesDeduction}
                                className="font-bold text-(--text-ink)"
                            />
                        </div>
                    )}
                    {action.payload.insuranceDeduction !== undefined && (
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-(--text-muted) font-semibold">
                                Insurance
                            </span>
                            <CurrencyText
                                amount={action.payload.insuranceDeduction}
                                className="font-bold text-(--text-ink)"
                            />
                        </div>
                    )}
                    {action.payload.notes && (
                        <p className="text-[11px] text-(--text-muted) wrap-break-word">
                            {action.payload.notes}
                        </p>
                    )}
                </div>
            )}

            {action.status === "error" && action.errorMessage && (
                <Alert variant="danger">{action.errorMessage}</Alert>
            )}

            {canAct && (
                <div className="flex items-center justify-end gap-2 pt-1">
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={isSubmitting}
                        onClick={() => onCancel(action.id)}
                        data-testid="action-cancel-btn"
                        leftIcon={<X className="h-3.5 w-3.5" strokeWidth={2.5} />}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        isLoading={isSubmitting}
                        onClick={handleConfirm}
                        data-testid="action-confirm-btn"
                        leftIcon={<Check className="h-3.5 w-3.5 stroke-3" />}
                    >
                        Confirm
                    </Button>
                </div>
            )}
        </Card>
    );
}

export default ActionConfirmationCard;
