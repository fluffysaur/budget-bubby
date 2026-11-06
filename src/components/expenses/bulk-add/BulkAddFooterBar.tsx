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

/** `+ Row` and `Save N · S$total`. Lives in ModalFooter, so it never scrolls away. */
export function BulkAddFooterBar({
    summary,
    isSubmitting,
    canAddRow,
    onAddRow,
    onSave,
}: BulkAddFooterBarProps) {
    const nothingToSave = summary.count === 0 && summary.invalidCount === 0;
    const label =
        summary.count > 0
            ? `Save ${summary.count} · ${formatSGD(summary.totalSGD)}`
            : "Save";

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
                isLoading={isSubmitting}
                disabled={nothingToSave || isSubmitting}
                onClick={onSave}
            >
                {label}
            </Button>
        </ModalFooter>
    );
}
