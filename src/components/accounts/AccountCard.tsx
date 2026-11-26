/**
 * AccountCard Component
 * Displays individual account details:
 * - Institution logo avatar with the stale-balance dot
 * - Tap balance or pencil to update balance
 * - 6-month balance sparkline with the change beneath
 * - Edit mode: drag handle and settings; trend and pencil hidden
 */

import type { ReactNode } from "react";
import { Users, Pencil, Clock, Settings } from "lucide-react";
import type { Account, AccountType } from "../../types/finance";
import { formatDisplayDate } from "../../lib/dateUtils";
import { TruncatedText } from "../ui/TruncatedText";
import { CurrencyText } from "../ui/CurrencyText";
import { AvatarDot } from "../ui/AvatarDot";
import { AccountAvatar } from "./AccountAvatar";
import { AccountTrendSpark } from "./AccountTrendSpark";
import { StaleBalanceTooltip } from "./StaleBalanceTooltip";
import { daysSince, isStale, type AccountTrend } from "../../lib/accountTrend";
import type { ChangeMode } from "../../lib/accountChange";

export interface AccountCardProps {
    account: Account;
    trend?: AccountTrend;
    changeMode?: ChangeMode;
    editing?: boolean;
    dragHandle?: ReactNode;
    onUpdateBalance?: (account: Account) => void;
    onEditAccount?: (account: Account) => void;
    className?: string;
}

const TYPE_BADGE_STYLES: Record<AccountType, string> = {
    Cash: "bg-(--pastel-mint-light)",
    Investment: "bg-(--pastel-butter-light)",
    CPF: "bg-(--pastel-lilac-light)",
    Other: "bg-(--bg-canvas)",
};

export function AccountCard({
    account,
    trend,
    changeMode,
    editing = false,
    dragHandle,
    onUpdateBalance,
    onEditAccount,
    className = "",
}: AccountCardProps) {
    const days = daysSince(account.updated_at, new Date());
    const stale = isStale(days);

    const balance = (
        <>
            <span className="min-w-0 text-(--text-ink)">
                <CurrencyText amount={account.balance} size="lg" />
            </span>
            {account.currency && account.currency !== "SGD" && (
                <span className="shrink-0 text-xs text-(--text-muted) font-mono-num font-bold">
                    {account.currency}
                </span>
            )}
        </>
    );

    return (
        <div
            data-testid="account-card"
            className={`flex h-full flex-col justify-between rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3.5 sm:p-4 shadow-cute-sm hover:shadow-cute transition-press ${className}`}
        >
            <div>
                {/* Header: avatar, name and badges */}
                <div className="flex items-start gap-2.5">
                    {editing && dragHandle}
                    <AccountAvatar account={account} showStaleDot={false} />
                    <div className="min-w-0 flex-1">
                        <h3 className="flex min-w-0 font-display font-black text-sm text-(--text-ink) tracking-tight">
                            <TruncatedText text={account.name} infoButton />
                        </h3>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded-md text-2xs font-bold border border-(--border-ink) text-(--text-ink) ${TYPE_BADGE_STYLES[account.type]}`}
                            >
                                {account.type}
                            </span>
                            {account.is_joint && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded-md text-2xs font-bold bg-(--pastel-pink-light) text-(--text-ink) border border-(--border-ink)">
                                    <AvatarDot
                                        name="Joint"
                                        icon={<Users className="h-2.5 w-2.5" />}
                                        size="xs"
                                        border={false}
                                        decorative
                                    />
                                    <span>Joint</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {editing && onEditAccount && (
                        <button
                            type="button"
                            onClick={() => onEditAccount(account)}
                            aria-label={`Edit ${account.name}`}
                            title="Edit"
                            className="relative inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm transition-press after:absolute after:-inset-1.5 after:content-[''] hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5"
                        >
                            <Settings className="h-3.5 w-3.5" />
                        </button>
                    )}
                </div>

                {/* Balance + trend */}
                <div className="mt-2.5 flex min-h-13 items-center justify-between gap-2">
                    {editing ? (
                        <div className="flex min-w-0 items-center gap-1.5">
                            {balance}
                        </div>
                    ) : (
                        <>
                            <button
                                type="button"
                                onClick={() => onUpdateBalance?.(account)}
                                aria-label={`Update balance for ${account.name}`}
                                className="flex min-h-11 min-w-0 cursor-pointer items-center gap-1.5 text-left"
                            >
                                {balance}
                                <Pencil
                                    className="h-3.5 w-3.5 shrink-0 text-(--text-muted)"
                                    strokeWidth={2.5}
                                    aria-hidden="true"
                                />
                            </button>
                            <AccountTrendSpark
                                trend={trend}
                                variant="card"
                                accountName={account.name}
                                changeMode={changeMode}
                            />
                        </>
                    )}
                </div>

                {/* Optional Notes */}
                {account.notes && (
                    <p className="mt-1 text-[11px] text-(--text-muted) line-clamp-1">
                        {account.notes}
                    </p>
                )}
            </div>

            {/* Footer: Last Updated (amber when stale) */}
            <div className="mt-3 pt-2.5 border-t border-(--border-subtle)">
                <div
                    data-stale={stale}
                    className={`flex items-center gap-1 text-2xs font-mono-num ${
                        stale
                            ? "text-amber-700 dark:text-amber-400"
                            : "text-(--text-muted)"
                    }`}
                >
                    <Clock className="h-3 w-3 shrink-0" />
                    <span className="min-w-0 truncate">
                        {account.updated_at
                            ? `Updated ${formatDisplayDate(account.updated_at)}`
                            : "Up to date"}
                    </span>
                    {stale && days !== null && (
                        <StaleBalanceTooltip
                            accountName={account.name}
                            days={days}
                            trigger="info"
                        />
                    )}
                </div>
            </div>
        </div>
    );
}

export default AccountCard;
