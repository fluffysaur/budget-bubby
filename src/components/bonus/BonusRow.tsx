/**
 * BonusRow Component
 * One logged bonus: type, recipient, note and date on the left; net and gross
 * on the right; edit and delete actions.
 */

import { Pencil, Trash2 } from "lucide-react";
import { Badge, Button, CurrencyText, TruncatedText } from "../ui";
import { BONUS_TYPE_LABELS, bonusGoalTotal } from "../../lib/bonusFormulas";
import { MONTH_NAMES_SHORT } from "../../lib/dateUtils";
import type { BonusEvent } from "../../types/finance";

export interface BonusRowProps {
    event: BonusEvent;
    recipientName: string;
    onEdit: (event: BonusEvent) => void;
    onDelete: (event: BonusEvent) => void;
}

function formatShortDay(date: string): string {
    const month = Number(date.slice(5, 7));
    const day = Number(date.slice(8, 10));
    if (!month || !day) return date;
    return `${day} ${MONTH_NAMES_SHORT[month - 1]}`;
}

export function BonusRow({ event, recipientName, onEdit, onDelete }: BonusRowProps) {
    const typeLabel = BONUS_TYPE_LABELS[event.type] ?? "Other";
    const goalTotal = bonusGoalTotal(event);

    return (
        <div
            data-testid="bonus-row"
            // Tapping the row opens Edit. It is not a role="button": it holds
            // the Edit and Delete buttons, which serve keyboard and screen readers.
            onClick={() => onEdit(event)}
            className="flex min-h-11 cursor-pointer items-center gap-3 py-2.5 transition-colors hover:bg-(--bg-cream) rounded-xl px-1"
        >
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <Badge variant="lilac" size="sm" className="shrink-0">
                        {typeLabel}
                    </Badge>
                    <span className="shrink-0 text-sm font-bold text-(--text-ink)">
                        {recipientName}
                    </span>
                </div>
                <div className="flex min-w-0 items-center gap-1.5 text-xs text-(--text-muted)">
                    <div className="min-w-0 flex-1">
                        <TruncatedText text={event.note || typeLabel} />
                    </div>
                    <span className="shrink-0">{formatShortDay(event.received_on)}</span>
                </div>
                {goalTotal > 0 && (
                    <Badge variant="mint" size="sm">
                        <CurrencyText amount={goalTotal} /> to goals
                    </Badge>
                )}
            </div>

            <div className="shrink-0 text-right">
                <div className="font-mono-num text-sm font-black text-(--text-ink)">
                    <CurrencyText amount={event.net} />
                </div>
                <div className="font-mono-num text-xs text-(--text-muted)">
                    <CurrencyText amount={event.gross} /> gross
                </div>
            </div>

            <div className="flex shrink-0 items-center">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit bonus"
                    className="min-h-11 min-w-11"
                    onClick={(e) => {
                        e.stopPropagation();
                        onEdit(event);
                    }}
                >
                    <Pencil className="h-4 w-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete bonus"
                    className="min-h-11 min-w-11"
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete(event);
                    }}
                >
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    );
}

export default BonusRow;
