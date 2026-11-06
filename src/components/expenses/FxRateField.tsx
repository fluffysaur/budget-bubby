/**
 * Exchange-rate inputs for foreign-currency expenses.
 * - FxRateInput: "1 SGD = [rate] JPY" box (also used per currency in bulk add).
 * - FxRateField: linked SGD amount + rate. The rate is the anchor: changing the
 *   foreign amount or rate recalculates SGD, and typing the SGD actually charged
 *   (e.g. from a card statement) works out the rate.
 * `customRate` undefined means "use the live / cached default rate".
 */

import { useState } from "react";
import { useFxRates } from "../../hooks/useFxRates";
import {
    convertToSGD,
    getDefaultRate,
    rateFromSGD,
    roundRate,
} from "../../lib/currencyConverter";
import { MONTH_NAMES_SHORT } from "../../lib/dateUtils";

const INPUT_CLASS =
    "rounded-lg border border-(--border-ink) bg-(--bg-card) px-2 py-0.5 text-base sm:text-xs font-semibold text-center text-(--text-ink)";

interface FxRateInputProps {
    currencyCode: string;
    customRate: number | undefined;
    onCustomRateChange: (rate: number | undefined) => void;
}

/** Rate box. Keeps the typed text while focused so it can be cleared and retyped. */
export function FxRateInput({
    currencyCode,
    customRate,
    onCustomRateChange,
}: FxRateInputProps) {
    const [draft, setDraft] = useState<string | null>(null);
    const effectiveRate = customRate ?? getDefaultRate(currencyCode);

    return (
        <label className="flex items-center gap-1.5">
            <span className="text-[10px] text-(--text-muted)">1 SGD =</span>
            <input
                type="number"
                inputMode="decimal"
                step="any"
                min="0"
                aria-label={`Exchange rate ${currencyCode}`}
                value={draft ?? roundRate(effectiveRate)}
                onChange={(e) => {
                    setDraft(e.target.value);
                    const val = parseFloat(e.target.value);
                    if (val > 0) onCustomRateChange(roundRate(val));
                }}
                onBlur={() => setDraft(null)}
                className={`text-base sm:text-sm w-20 ${INPUT_CLASS}`}
            />
            <span className="text-[10px] font-semibold">{currencyCode}</span>
        </label>
    );
}

function formatAsOf(date: Date): string {
    return `${date.getDate()} ${MONTH_NAMES_SHORT[date.getMonth()]}`;
}

interface FxRateFieldProps extends FxRateInputProps {
    foreignAmount: number;
}

export function FxRateField({
    currencyCode,
    foreignAmount,
    customRate,
    onCustomRateChange,
}: FxRateFieldProps) {
    const status = useFxRates(currencyCode !== "SGD");
    const [sgdDraft, setSgdDraft] = useState<string | null>(null);

    const { amountInSGD } = convertToSGD(
        foreignAmount,
        currencyCode,
        customRate,
    );

    const statusLabel =
        customRate !== undefined
            ? "Custom rate"
            : status.source === "live" && status.asOf
              ? `Rate as of ${formatAsOf(status.asOf)}`
              : status.asOf
                ? `Offline rate · ${formatAsOf(status.asOf)}`
                : "Offline rate";

    return (
        <div className="mt-2 rounded-xl bg-(--pastel-butter-light) p-2.5 text-xs text-(--text-ink) border border-(--border-ink)">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 font-bold">
                    <span>≈ S$</span>
                    <input
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        aria-label="Converted SGD"
                        disabled={!(foreignAmount > 0)}
                        value={sgdDraft ?? amountInSGD}
                        onChange={(e) => {
                            setSgdDraft(e.target.value);
                            const rate = rateFromSGD(
                                foreignAmount,
                                parseFloat(e.target.value),
                            );
                            if (rate) onCustomRateChange(rate);
                        }}
                        onBlur={() => setSgdDraft(null)}
                        className={`text-base sm:text-sm w-24 ${INPUT_CLASS}`}
                    />
                </label>
                <FxRateInput
                    currencyCode={currencyCode}
                    customRate={customRate}
                    onCustomRateChange={onCustomRateChange}
                />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-(--text-muted)">
                <span>{statusLabel}</span>
                {customRate !== undefined && (
                    <button
                        type="button"
                        onClick={() => {
                            setSgdDraft(null);
                            onCustomRateChange(undefined);
                        }}
                        className="font-bold underline underline-offset-2 hover:text-(--text-ink)"
                    >
                        Use live rate
                    </button>
                )}
            </div>
        </div>
    );
}
