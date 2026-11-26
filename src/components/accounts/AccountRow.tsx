/**
 * AccountRow
 * One compact, brokerage-style account row. All rows share the same grid and
 * the amount track width from `--acct-amount`, so columns line up.
 */

import type { ReactNode } from "react";
import { Pencil, Settings } from "lucide-react";
import type { Account } from "../../types/finance";
import type { AmountSize, ChangeMode } from "../../lib/accountChange";
import type { AccountTrend } from "../../lib/accountTrend";
import { TruncatedText } from "../ui/TruncatedText";
import { CurrencyText } from "../ui/CurrencyText";
import { AccountAvatar } from "./AccountAvatar";
import { AccountChangeText } from "./AccountChangeText";
import { AccountTrendSpark } from "./AccountTrendSpark";

export interface AccountRowProps {
    account: Account;
    trend?: AccountTrend;
    changeMode: ChangeMode;
    /** Smaller figures when the widest balance is long. */
    amountSize: AmountSize;
    editing: boolean;
    dragHandle?: ReactNode;
    onUpdateBalance?: (account: Account) => void;
    onEditAccount?: (account: Account) => void;
}

/** Phone sizes keep the name readable at 360px. */
const AMOUNT_TEXT: Record<AmountSize, string> = {
    regular: "text-[13px] sm:text-base",
    small: "text-xs sm:text-sm",
    smallest: "text-[11px] sm:text-sm",
};

const NORMAL_COLUMNS =
    "grid-cols-[1.75rem_minmax(0,1fr)_clamp(4rem,18vw,7.5rem)_var(--acct-amount)]";
const EDIT_COLUMNS =
    "grid-cols-[1.5rem_1.75rem_minmax(0,1fr)_var(--acct-amount-plain)_2rem]";

export function AccountRow({
    account,
    trend,
    changeMode,
    amountSize,
    editing,
    dragHandle,
    onUpdateBalance,
    onEditAccount,
}: AccountRowProps) {
    const balance = (
        <CurrencyText amount={account.balance} className="font-extrabold" />
    );

    return (
        // The mono font sits on the grid so the `ch` tracks match the figures.
        <div
            data-testid="account-row"
            className={`grid min-h-14 items-center gap-x-1.5 px-3 py-2 font-mono-num sm:gap-x-3 sm:px-3.5 ${AMOUNT_TEXT[amountSize]} ${editing ? EDIT_COLUMNS : NORMAL_COLUMNS}`}
        >
            {editing && <span className="flex">{dragHandle}</span>}
            <AccountAvatar account={account} />

            <div className="min-w-0 font-sans">
                <div className="flex min-w-0 text-sm font-bold text-(--text-ink)">
                    <TruncatedText text={account.name} infoButton />
                </div>
                {(account.is_joint || account.notes) && (
                    <div className="mt-0.5 flex min-w-0 items-center gap-1.5">
                        {account.is_joint && (
                            <span className="shrink-0 rounded-md border border-(--border-ink) bg-(--pastel-pink-light) px-1.5 py-0.5 text-2xs font-bold text-(--text-ink)">
                                Joint
                            </span>
                        )}
                        {account.notes && (
                            <p className="truncate text-[11px] text-(--text-muted)">
                                {account.notes}
                            </p>
                        )}
                    </div>
                )}
            </div>

            {editing ? (
                <>
                    <span className="text-right text-(--text-ink)">
                        {balance}
                    </span>
                    {onEditAccount ? (
                        <button
                            type="button"
                            onClick={() => onEditAccount(account)}
                            aria-label={`Edit ${account.name}`}
                            title="Edit"
                            className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-colors after:absolute after:-inset-1.5 after:content-[''] hover:bg-(--pastel-butter-light)"
                        >
                            <Settings className="h-3.5 w-3.5" />
                        </button>
                    ) : (
                        <span />
                    )}
                </>
            ) : (
                <>
                    <AccountTrendSpark
                        trend={trend}
                        variant="row"
                        accountName={account.name}
                    />
                    <button
                        type="button"
                        onClick={() => onUpdateBalance?.(account)}
                        aria-label={`Update balance for ${account.name}`}
                        title="Update balance"
                        className="flex min-h-11 min-w-0 cursor-pointer flex-col items-end justify-center text-(--text-ink) transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
                    >
                        <span className="flex items-center gap-1">
                            {balance}
                            <Pencil
                                className="h-3.5 w-3.5 shrink-0 text-(--text-muted)"
                                strokeWidth={2.5}
                                aria-hidden="true"
                            />
                        </span>
                        {trend && (
                            <AccountChangeText
                                trend={trend}
                                mode={changeMode}
                                className="pr-4.5"
                            />
                        )}
                    </button>
                </>
            )}
        </div>
    );
}
