import { getTodayDateString } from "../../../lib/dateUtils";
import { formatRowDate } from "../../../lib/bulkAddRows";
import type { BulkAction, BulkRow } from "../../../lib/bulkAddRows";

interface RowDateFieldProps {
    row: BulkRow;
    index: number;
    dispatch: React.Dispatch<BulkAction>;
    disabled?: boolean;
    className?: string;
}

/** Compact date label; the native date input sits invisibly on top. */
export function RowDateField({
    row,
    index,
    dispatch,
    disabled,
    className = "",
}: RowDateFieldProps) {
    return (
        <label
            className={`relative flex min-h-11 shrink-0 items-center rounded-xl border-2 border-(--border-subtle) bg-(--bg-card) px-3 text-xs font-bold text-(--text-muted) ${className}`}
        >
            <span aria-hidden="true">{formatRowDate(row.date)}</span>
            <input
                type="date"
                aria-label={`Date for row ${index + 1}`}
                value={row.date}
                max={getTodayDateString()}
                disabled={disabled}
                onChange={(e) => {
                    if (e.target.value) {
                        dispatch({
                            type: "updateRow",
                            id: row.id,
                            patch: { date: e.target.value },
                        });
                    }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0 text-base"
            />
        </label>
    );
}
