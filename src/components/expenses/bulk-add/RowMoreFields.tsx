import { useState } from "react";
import { X } from "lucide-react";
import { Input } from "../../ui/Input";
import { Select } from "../../ui/Select";
import { FxRateInput } from "../FxRateField";
import { SUPPORTED_CURRENCIES } from "../../../lib/currencyConverter";
import { sanitizeAmount } from "../../../lib/bulkAddRows";
import type {
    BulkAction,
    BulkRow,
    RateOverrides,
} from "../../../lib/bulkAddRows";

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => ({
    value: c.code,
    label: c.code,
}));

interface RowMoreFieldsProps {
    row: BulkRow;
    index: number;
    rateOverrides: RateOverrides;
    dispatch: React.Dispatch<BulkAction>;
    disabled?: boolean;
}

/** Shared toggle, tags and foreign currency for one row. */
export function RowMoreFields({
    row,
    index,
    rateOverrides,
    dispatch,
    disabled,
}: RowMoreFieldsProps) {
    const [tagDraft, setTagDraft] = useState("");

    const addTag = () => {
        const clean = tagDraft.trim().replace(/^#/, "");
        setTagDraft("");
        if (!clean) return;
        const formatted = `#${clean}`;
        if (
            row.tags.some(
                (t) =>
                    t.replace(/^#/, "").toLowerCase() === clean.toLowerCase(),
            )
        ) {
            return;
        }
        dispatch({
            type: "updateRow",
            id: row.id,
            patch: { tags: [...row.tags, formatted] },
        });
    };

    return (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    disabled={disabled}
                    aria-pressed={row.isShared}
                    aria-label={`Split for row ${index + 1}: ${row.isShared ? "50/50" : "Solo"}`}
                    onClick={() =>
                        dispatch({
                            type: "updateRow",
                            id: row.id,
                            patch: { isShared: !row.isShared },
                        })
                    }
                    className={`min-h-11 shrink-0 rounded-xl border-2 px-3 text-sm font-bold text-(--text-ink) active:translate-x-0.5 active:translate-y-0.5 ${
                        row.isShared
                            ? "border-(--border-ink) bg-(--pastel-mint-light) shadow-cute-sm"
                            : "border-(--border-subtle) bg-(--bg-card)"
                    }`}
                >
                    {row.isShared ? "50/50" : "Solo"}
                </button>
                <div className="min-w-0 flex-1">
                    <Select
                        aria-label={`Currency for row ${index + 1}`}
                        value={row.currency}
                        disabled={disabled}
                        options={CURRENCY_OPTIONS}
                        className="min-h-11 text-base! sm:text-sm!"
                        onChange={(e) =>
                            dispatch({
                                type: "updateRow",
                                id: row.id,
                                patch: {
                                    currency: e.target.value,
                                    amount: sanitizeAmount(
                                        row.amount,
                                        e.target.value,
                                    ),
                                },
                            })
                        }
                    />
                </div>
            </div>

            <div className="flex min-h-11 items-center">
                {row.currency !== "SGD" && (
                    <FxRateInput
                        currencyCode={row.currency}
                        customRate={rateOverrides[row.currency]}
                        onCustomRateChange={(rate) =>
                            dispatch({
                                type: "setRate",
                                currency: row.currency,
                                rate,
                            })
                        }
                    />
                )}
            </div>

            <div className="min-w-0 space-y-2">
                <Input
                    aria-label={`Add tag for row ${index + 1}`}
                    placeholder="Add tag"
                    enterKeyHint="done"
                    autoComplete="off"
                    disabled={disabled}
                    value={tagDraft}
                    className="text-base! sm:text-sm!"
                    onChange={(e) => setTagDraft(e.target.value)}
                    onBlur={addTag}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === ",") {
                            e.preventDefault();
                            e.stopPropagation();
                            addTag();
                        }
                    }}
                />
                {row.tags.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                        {row.tags.map((tag) => (
                            <li key={tag}>
                                <button
                                    type="button"
                                    aria-label={`Remove tag ${tag}`}
                                    onClick={() =>
                                        dispatch({
                                            type: "updateRow",
                                            id: row.id,
                                            patch: {
                                                tags: row.tags.filter(
                                                    (t) => t !== tag,
                                                ),
                                            },
                                        })
                                    }
                                    className="flex min-h-8 max-w-full items-center gap-1 rounded-lg border-2 border-(--border-ink) bg-(--pastel-lilac-light) px-2 text-xs font-bold text-(--text-ink)"
                                >
                                    <span className="min-w-0 truncate">
                                        {tag}
                                    </span>
                                    <X
                                        className="h-3 w-3 shrink-0"
                                        strokeWidth={3}
                                    />
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
