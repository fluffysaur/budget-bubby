import { formatAccountChange, type ChangeMode } from "../../lib/accountChange";
import { TREND_MONTHS, type AccountTrend } from "../../lib/accountTrend";
import { CurrencyText } from "../ui/CurrencyText";

export interface AccountChangeTextProps {
    trend: AccountTrend;
    mode: ChangeMode;
    className?: string;
}

/** Plain-text 6-month change: green when up, muted otherwise. Never red. */
export function AccountChangeText({
    trend,
    mode,
    className = "",
}: AccountChangeTextProps) {
    const { text, isUp } = formatAccountChange(trend, mode);

    return (
        <span
            data-testid="account-trend-change"
            data-up={isUp}
            className={`font-mono-num text-2xs font-bold whitespace-nowrap ${
                isUp
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-(--text-muted)"
            } ${className}`}
        >
            {/* $ goes through CurrencyText so privacy mode masks it */}
            {mode === "amount" ? <CurrencyText formatted={text} /> : text}{" "}
            {TREND_MONTHS}m
        </span>
    );
}
