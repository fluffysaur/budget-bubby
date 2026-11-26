/**
 * AccountTrendSpark
 * Compact 6-month balance trend for one account.
 * - "card": sparkline + change text, or a "Needs 2 updates" hint
 * - "row": sparkline filling its grid track, or a dashed placeholder
 */

import { Sparkline } from "../ui/Sparkline";
import { TREND_MONTHS, type AccountTrend } from "../../lib/accountTrend";
import type { ChangeMode } from "../../lib/accountChange";
import { AccountChangeText } from "./AccountChangeText";

export interface AccountTrendSparkProps {
    trend?: AccountTrend;
    variant: "card" | "row";
    accountName: string;
    /** Card only: rows print the change beneath the balance instead. */
    changeMode?: ChangeMode;
}

export function AccountTrendSpark({
    trend,
    variant,
    accountName,
    changeMode = "amount",
}: AccountTrendSparkProps) {
    if (!trend) {
        if (variant === "row") {
            return (
                <span
                    role="img"
                    aria-label={`${accountName} has no balance trend yet`}
                    data-testid="account-trend-empty"
                    className="block w-full border-t-2 border-dashed border-(--text-faint) opacity-50"
                />
            );
        }
        return (
            <span
                data-testid="account-trend-empty"
                className="shrink-0 text-2xs font-bold text-(--text-muted)"
            >
                Needs 2 updates
            </span>
        );
    }

    const isUp = trend.delta >= 0;
    const sparkline = (
        <Sparkline
            data={trend.points}
            width={variant === "row" ? 100 : 120}
            height={variant === "row" ? 30 : 32}
            // Calm framing: green when up, neutral otherwise. Never red.
            tone={isUp ? "ok" : "neutral"}
            aria-label={`${accountName} balance trend, last ${TREND_MONTHS} months`}
            // The shared "ok" tone is too pale for a thin line on a card
            className={`${variant === "row" ? "h-auto w-full" : ""} ${
                isUp
                    ? "[&_circle]:fill-emerald-600 [&_polyline]:stroke-emerald-600 dark:[&_circle]:fill-emerald-400 dark:[&_polyline]:stroke-emerald-400"
                    : ""
            }`}
        />
    );

    if (variant === "row") return sparkline;

    return (
        <div className="flex shrink-0 flex-col items-end gap-0.5">
            {sparkline}
            <AccountChangeText trend={trend} mode={changeMode} />
        </div>
    );
}

export default AccountTrendSpark;
