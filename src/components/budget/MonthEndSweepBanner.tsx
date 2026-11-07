import { PiggyBank, Shield, ArrowRight } from "lucide-react";
import { Button } from "../ui";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { CurrencyText } from "../ui/CurrencyText";

export interface MonthEndSweepBannerProps {
    month: string;
    surplusAmount: number;
    onSweepClick: () => void;
    onBankSurplusClick: () => void;
    className?: string;
}

export function MonthEndSweepBanner({
    month,
    surplusAmount,
    onSweepClick,
    onBankSurplusClick,
    className = "",
}: MonthEndSweepBannerProps) {
    if (surplusAmount <= 0) return null;

    return (
        <div
            role="region"
            aria-label="Month-End Surplus Notification"
            className={`relative flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4 rounded-2xl border-2 border-(--border-ink) bg-(--accent-lilac-subtle) p-3.5 sm:p-4 shadow-cute transition-colors ${className}`}
        >
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--accent-lilac) text-(--text-ink) shadow-cute-sm">
                    <PiggyBank className="h-5 w-5" strokeWidth={2.5} />
                </div>
                <div className="min-w-0 flex-1 text-xs sm:text-sm">
                    <h2 className="font-bold text-(--text-ink) truncate">
                        <CurrencyText amount={surplusAmount} /> unspent from {formatDisplayMonth(month)}
                    </h2>
                    <p className="text-(--text-muted) text-xs mt-0.5">
                        Sweep into savings goals or bank for cushion.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center shrink-0 flex-wrap sm:flex-nowrap">
                <Button
                    variant="secondary"
                    size="sm"
                    onClick={onBankSurplusClick}
                    aria-label="Bank surplus"
                    leftIcon={<Shield className="h-3.5 w-3.5 text-(--text-muted)" />}
                >
                    Bank Surplus
                </Button>
                <Button
                    variant="primary"
                    size="sm"
                    onClick={onSweepClick}
                    aria-label="Sweep to goals"
                    rightIcon={<ArrowRight className="h-3.5 w-3.5" strokeWidth={2.5} />}
                >
                    Sweep to Goals
                </Button>
            </div>
        </div>
    );
}
