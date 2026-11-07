import { useMemo } from "react";
import {
    formatISODate,
    getSingaporeDate,
    getTodayDateString,
} from "../../../lib/dateUtils";
import { formatRowDate } from "../../../lib/bulkAddRows";

interface DayChipsProps {
    value: string;
    onChange: (date: string) => void;
    disabled?: boolean;
}

const CHIP =
    "inline-flex min-h-11 items-center rounded-full border-2 border-(--border-ink) px-3 text-sm font-bold text-(--text-ink) active:translate-x-0.5 active:translate-y-0.5";

/** Today / Yesterday / pick date. Sets the date for newly added rows. */
export function DayChips({ value, onChange, disabled }: DayChipsProps) {
    const today = getTodayDateString();
    const yesterday = useMemo(() => {
        const d = getSingaporeDate();
        d.setDate(d.getDate() - 1);
        return formatISODate(d);
    }, []);

    const isCustom = value !== today && value !== yesterday;

    const chipClass = (selected: boolean) =>
        `${CHIP} ${
            selected
                ? "bg-(--pastel-lilac-light) shadow-cute-sm"
                : "bg-(--bg-card)"
        }`;

    return (
        <div
            role="radiogroup"
            aria-label="Day for new rows"
            className="flex flex-wrap items-center gap-2"
        >
            <button
                type="button"
                role="radio"
                aria-checked={value === today}
                disabled={disabled}
                onClick={() => onChange(today)}
                className={chipClass(value === today)}
            >
                Today
            </button>
            <button
                type="button"
                role="radio"
                aria-checked={value === yesterday}
                disabled={disabled}
                onClick={() => onChange(yesterday)}
                className={chipClass(value === yesterday)}
            >
                Yesterday
            </button>
            <label className={`relative ${chipClass(isCustom)}`}>
                <span>{isCustom ? formatRowDate(value) : "Pick date"}</span>
                <input
                    type="date"
                    aria-label="Pick date"
                    value={value}
                    max={today}
                    disabled={disabled}
                    onChange={(e) => {
                        if (e.target.value) onChange(e.target.value);
                    }}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 text-base"
                />
            </label>
        </div>
    );
}
