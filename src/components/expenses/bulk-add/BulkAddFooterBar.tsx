import { Plus } from "lucide-react";
import { ModalFooter } from "../../ui/AnimatedModal";
import { Button } from "../../ui/Button";
import { formatSGD } from "../../../lib/currency";
import type { BulkSummary } from "../../../lib/bulkAddRows";

interface BulkAddFooterBarProps {
    summary: BulkSummary;
    isSubmitting: boolean;
    canAddRow: boolean;
    onAddRow: () => void;
    onSave: () => void;
}

/** `+ Row` and `Save S$total (N)`. Lives in ModalFooter, so it never scrolls away. */
export function BulkAddFooterBar({
    summary,
    isSubmitting,
    canAddRow,
    onAddRow,
    onSave,
}: BulkAddFooterBarProps) {
    const nothingToSave = summary.count === 0 && summary.invalidCount === 0;
    const hasRows = summary.count > 0;
    const total = formatSGD(summary.totalSGD);

    return (
        <ModalFooter className="gap-2">
            <Button
                variant="secondary"
                size="md"
                aria-label="+ Row"
                className="min-h-11"
                leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                disabled={!canAddRow || isSubmitting}
                onClick={onAddRow}
            >
                Row
            </Button>
            <Button
                variant="primary"
                size="md"
                className="min-h-11 flex-1 sm:flex-none"
                aria-label={
                    hasRows ? `Save ${summary.count} for ${total}` : undefined
                }
                isLoading={isSubmitting}
                disabled={nothingToSave || isSubmitting}
                onClick={onSave}
                rightIcon={
                    hasRows ? (
                        <span
                            aria-hidden="true"
                            data-testid="bulk-save-count"
                            className="inline-flex h-5 min-w-5 items-center justify-center rounded-full border border-(--border-ink) bg-(--bg-card) px-1.5 text-2xs font-black text-(--text-ink) font-mono-num"
                        >
                            {summary.count}
                        </span>
                    ) : undefined
                }
            >
                {hasRows ? `Save ${total}` : "Save"}
            </Button>
        </ModalFooter>
    );
}
