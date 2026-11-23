/**
 * "Where's this money from?" choice for an account's opening balance.
 *
 * - New account: money moved in from tracked accounts, so the reality check
 *   counts it from $0 and the transfer nets out.
 * - Existing account: money we weren't tracking yet, so its opening balance
 *   isn't counted as savings.
 */

const CHIP_CLASS =
    "inline-flex min-h-11 items-center justify-center rounded-xl px-2.5 py-1.5 text-xs font-bold transition-press cursor-pointer";
const CHIP_ON =
    "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm";
const CHIP_OFF =
    "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle)";

export interface AccountOriginChoiceProps {
    /** true = new account, false = existing, null = not chosen yet. */
    value: boolean | null;
    onChange: (isNew: boolean) => void;
    labelClassName?: string;
}

export function AccountOriginChoice({
    value,
    onChange,
    labelClassName = "text-[11px]",
}: AccountOriginChoiceProps) {
    return (
        <div data-testid="account-origin">
            <p
                id="account-origin-label"
                className={`block font-bold uppercase tracking-wider text-(--text-muted) mb-1 ${labelClassName}`}
            >
                Where's this money from? *
            </p>
            <div
                role="radiogroup"
                aria-labelledby="account-origin-label"
                className="grid grid-cols-2 gap-1.5"
            >
                {(
                    [
                        [true, "New account"],
                        [false, "Existing account"],
                    ] as const
                ).map(([isNew, label]) => (
                    <button
                        key={label}
                        type="button"
                        role="radio"
                        aria-checked={value === isNew}
                        onClick={() => onChange(isNew)}
                        className={`${CHIP_CLASS} ${
                            value === isNew ? CHIP_ON : CHIP_OFF
                        }`}
                    >
                        {label}
                    </button>
                ))}
            </div>
            <p className="mt-1 text-[10px] text-(--text-muted)">
                Existing = money we weren't tracking yet.
            </p>
        </div>
    );
}
