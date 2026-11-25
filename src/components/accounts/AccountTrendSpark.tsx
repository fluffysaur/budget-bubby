/**
 * AccountTrendSpark
 * Compact 6-month balance trend for one account.
 * - "card": sparkline + calm change chip, or a "Needs 2 updates" hint
 * - "row": sparkline only (renders nothing without enough history)
 */

import { Sparkline } from "../ui/Sparkline";
import { CurrencyText } from "../ui/CurrencyText";
import { TREND_MONTHS, type AccountTrend } from "../../lib/accountTrend";

export interface AccountTrendSparkProps {
    trend?: AccountTrend;
    variant: "card" | "row";
    accountName: string;
}

export function AccountTrendSpark({
    trend,
    variant,
    accountName,
}: AccountTrendSparkProps) {
    if (!trend) {
        if (variant === "row") return null;
        return (
            <span
                data-testid="account-trend-empty"
                className="shrink-0 text-2xs font-bold text-(--text-muted)"
            >
                Needs 2 updates
            </span>
        );
    }

    // Calm framing: green when up, neutral otherwise. Never red.
    const tone = trend.delta >= 0 ? "ok" : "neutral";
    const label = `${accountName} balance trend, last ${TREND_MONTHS} months`;

    if (variant === "row") {
        return (
            <Sparkline
                data={trend.points}
                width={56}
                height={24}
                tone={tone}
                aria-label={label}
                className="hidden min-[380px]:block"
            />
        );
    }

    return (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
            <Sparkline
                data={trend.points}
                width={80}
                height={28}
                tone={tone}
                aria-label={label}
            />
            <span
                data-testid="account-trend-chip"
                className="inline-flex items-center gap-1 text-2xs font-bold text-(--text-muted)"
            >
                <span>
                    {trend.delta > 0 ? "+" : ""}
                    <CurrencyText
                        amount={trend.delta}
                        size="inline"
                        tone={trend.delta >= 0 ? "positive" : "muted"}
                    />
                </span>
                <span>({TREND_MONTHS}m)</span>
            </span>
        </div>
    );
}

export default AccountTrendSpark;
