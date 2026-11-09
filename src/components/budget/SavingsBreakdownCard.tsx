import { PiggyBank } from "lucide-react";
import { StatCard } from "../ui";
import { Badge } from "../ui/Badge";
import { CurrencyText } from "../ui/CurrencyText";
import { computeSavingsBreakdown } from "../../lib/financialFormulas";
import { formatSGD } from "../../lib/currency";

interface SavingsBreakdownCardProps {
    /** Budgeted Savings target for the month. */
    baseSavings: number;
    /** Spendable budget incl. Buffer. */
    spendableAllocated: number;
    spendableSpent: number;
    loading?: boolean;
}

/** Total actual savings = base target + unspent (or overspent) remainder. */
export function SavingsBreakdownCard({
    baseSavings,
    spendableAllocated,
    spendableSpent,
    loading,
}: SavingsBreakdownCardProps) {
    const { base, excess, total } = computeSavingsBreakdown({
        baseSavings,
        spendableAllocated,
        spendableSpent,
    });
    const money = (n: number) => formatSGD(n, { showCents: false });

    return (
        <StatCard
            title="Savings"
            loading={loading}
            value={
                <CurrencyText
                    formatted={formatSGD(Math.abs(total), {
                        showCents: false,
                    })}
                />
            }
            badge={
                excess < 0 ? (
                    <Badge variant="over">Below Base</Badge>
                ) : (
                    <Badge variant="ok">On Track</Badge>
                )
            }
            tooltip="Base savings plus whatever spendable budget (Buffer included) is left unspent. Overspending reduces it."
            icon={<PiggyBank className="h-4 w-4" />}
            iconBg="bg-(--pastel-mint-light) text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
            footer={
                <div
                    className="flex items-center justify-between gap-3 text-xs font-bold text-(--text-muted)"
                    data-testid="savings-breakdown"
                >
                    <span className="min-w-0 flex-1 truncate">
                        Base {money(base)}
                    </span>
                    <span className="shrink-0">
                        Excess {excess < 0 ? "-" : "+"}
                        {money(Math.abs(excess))}
                    </span>
                </div>
            }
        />
    );
}
