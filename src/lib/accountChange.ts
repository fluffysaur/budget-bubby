import { TREND_MONTHS, type AccountTrend } from "./accountTrend";
import { formatSGD } from "./currency";
import { PRIVACY_MASK } from "../context/PrivacyContext";

export type ChangeMode = "amount" | "percent";

export interface AccountChange {
    text: string;
    /** True only for a visible rise, which is shown in green. */
    isUp: boolean;
}

/** The 6-month change of a trend as dollars or as a % of the starting balance. */
export function formatAccountChange(
    trend: AccountTrend,
    mode: ChangeMode,
): AccountChange {
    if (mode === "amount") {
        const rounded = Math.round(trend.delta) || 0;
        const text = formatSGD(rounded, { showCents: false });
        return { text: rounded > 0 ? `+${text}` : text, isUp: rounded > 0 };
    }
    const start = trend.points[0];
    if (start === 0) return { text: "—", isUp: false };
    const rounded =
        Math.round((trend.delta / Math.abs(start)) * 1000) / 10 || 0;
    const text = `${rounded.toFixed(1)}%`;
    return { text: rounded > 0 ? `+${text}` : text, isUp: rounded > 0 };
}

/** Figure size for the rows: the longer the widest balance, the smaller. */
export type AmountSize = "regular" | "small" | "smallest";

/** Width of a change-line character relative to a balance one, per size. */
const CHANGE_TEXT_SCALE: Record<AmountSize, number> = {
    regular: 0.82,
    small: 0.88,
    smallest: 0.96,
};

function amountSize(ch: number): AmountSize {
    if (ch <= 11) return "regular";
    return ch <= 13 ? "small" : "smallest";
}

/**
 * Width of the shared amount column, in characters of the balance font: wide
 * enough for the longest balance or change line in either mode, so switching
 * modes doesn't move the other columns.
 */
export function getAmountColumn(
    accounts: { id: string; balance: number }[],
    trends: Map<string, AccountTrend>,
    isPrivacyMode: boolean,
): { ch: number; size: AmountSize } {
    let balanceChars = 1;
    let changeChars = 0;
    for (const account of accounts) {
        const balance = isPrivacyMode
            ? PRIVACY_MASK
            : formatSGD(account.balance);
        balanceChars = Math.max(balanceChars, balance.length);

        const trend = trends.get(account.id);
        if (!trend) continue;
        for (const mode of ["amount", "percent"] as const) {
            const text =
                mode === "amount" && isPrivacyMode
                    ? PRIVACY_MASK
                    : formatAccountChange(trend, mode).text;
            changeChars = Math.max(
                changeChars,
                `${text} ${TREND_MONTHS}m`.length,
            );
        }
    }
    const size = amountSize(
        Math.max(
            balanceChars,
            Math.ceil(changeChars * CHANGE_TEXT_SCALE.regular),
        ),
    );
    return {
        ch: Math.max(
            balanceChars,
            Math.ceil(changeChars * CHANGE_TEXT_SCALE[size]),
        ),
        size,
    };
}
