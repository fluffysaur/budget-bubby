import {
    getInitial,
    getInitialColour,
    getInstitutionLogo,
} from "../../lib/institutionLogos";
import { daysSince, isStale } from "../../lib/accountTrend";
import type { Account } from "../../types/finance";
import { StaleBalanceTooltip } from "./StaleBalanceTooltip";

/** Institution logo (or coloured initial) with the stale-balance dot. */
export interface AccountAvatarProps {
    account: Account;
    /** Cards explain staleness in their footer instead. */
    showStaleDot?: boolean;
}

export function AccountAvatar({
    account,
    showStaleDot = true,
}: AccountAvatarProps) {
    const logo = getInstitutionLogo(account.institution);
    const label = account.institution || account.name;
    const days = daysSince(account.updated_at, new Date());

    return (
        <span className="relative inline-flex h-7 w-7 shrink-0">
            {logo ? (
                <img
                    src={logo}
                    alt={label}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-full border border-(--border-ink) bg-white"
                />
            ) : (
                <span
                    role="img"
                    aria-label={label}
                    className={`flex h-7 w-7 items-center justify-center rounded-full border border-(--border-ink) font-display text-xs font-black text-(--border-ink) ${getInitialColour(label)}`}
                >
                    {getInitial(label)}
                </span>
            )}
            {showStaleDot && days !== null && isStale(days) && (
                <span className="absolute -top-0.5 -right-0.5 flex">
                    <StaleBalanceTooltip
                        accountName={account.name}
                        days={days}
                        trigger="dot"
                    />
                </span>
            )}
        </span>
    );
}
