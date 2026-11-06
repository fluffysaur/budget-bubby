/**
 * BudgetWaterfall Component
 * Flat list of the income flow for Singapore couple finances. The parent
 * CollapsibleSection is the only card:
 * 1. Gross (Salary, Bonus)
 * 2. Employee CPF
 * 3. Deductions (Taxes, Insurance)
 * 4. Take-home (highlighted)
 * 5. Allocations per category
 */

import type { ReactNode } from "react";
import { Settings, Sparkles } from "lucide-react";
import { formatAllocationPercent } from "../../lib/financialFormulas";
import { PRESET_COLORS } from "../../lib/categoryPresets";
import { TruncatedText } from "../ui/TruncatedText";
import { TooltipPopover } from "../ui/TooltipPopover";
import { Button } from "../ui/Button";
import { EmptyStateCard } from "../ui/EmptyStateCard";
import type { MonthlyBudget, MonthlyBudgetCategoryDetail } from "../../types/finance";
import { CurrencyText } from "../ui/CurrencyText";

export interface BudgetWaterfallProps {
    budget?: MonthlyBudget | null;
    categories?: MonthlyBudgetCategoryDetail[];
    onEditProfile?: () => void;
    className?: string;
}

type FlowTone = "default" | "negative" | "purple";

interface FlowRowProps {
    label: ReactNode;
    amount: number;
    sign?: "+" | "-" | "";
    tone?: FlowTone;
    bold?: boolean;
    sub?: boolean;
    icon?: ReactNode;
}

const TONE_CLASS: Record<FlowTone, string> = {
    default: "text-(--text-ink)",
    negative: "text-rose-600 dark:text-rose-400",
    purple: "text-purple-700 dark:text-purple-300",
};

function FlowRow({
    label,
    amount,
    sign = "",
    tone = "default",
    bold = false,
    sub = false,
    icon,
}: FlowRowProps) {
    return (
        <div
            className={`flex items-center justify-between gap-3 ${
                sub
                    ? "pl-6 text-xs text-(--text-muted)"
                    : "text-sm font-bold text-(--text-ink)"
            }`}
        >
            <div className="flex min-w-0 flex-1 items-center gap-2">
                {icon}
                {typeof label === "string" ? (
                    <TruncatedText text={label} />
                ) : (
                    label
                )}
            </div>
            <span
                className={`shrink-0 font-mono-num ${bold ? "font-black" : "font-bold"} ${TONE_CLASS[tone]}`}
            >
                {sign}
                <CurrencyText amount={amount} />
            </span>
        </div>
    );
}

export function BudgetWaterfall({
    budget,
    categories = [],
    onEditProfile,
    className = "",
}: BudgetWaterfallProps) {
    if (!budget) {
        return (
            <EmptyStateCard
                className={className}
                title="No Budget"
                description="Set up a budget to see your income flow."
                action={
                    onEditProfile ? (
                        <Button variant="primary" size="sm" onClick={onEditProfile}>
                            Set Up Budget
                        </Button>
                    ) : undefined
                }
            />
        );
    }

    const grossSalary = budget.gross_salary || 0;
    const bonus = budget.bonus || 0;
    const totalGross = grossSalary + bonus;
    const cpfDeduction = budget.cpf_deduction || 0;
    const taxesDeduction = budget.taxes_deduction || 0;
    const insuranceDeduction = budget.insurance_deduction || 0;
    const fixedDeductions = taxesDeduction + insuranceDeduction;
    const afterDeductions =
        budget.after_deductions || totalGross - cpfDeduction - fixedDeductions;

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="divide-y divide-(--border-subtle) [&>*]:py-2.5 first:[&>*]:pt-0">
                <div className="space-y-1.5">
                    <FlowRow label="Gross" amount={totalGross} bold />
                    <FlowRow label="Salary" amount={grossSalary} sub />
                    {bonus > 0 && (
                        <FlowRow
                            label="Bonus"
                            amount={bonus}
                            sign="+"
                            tone="purple"
                            sub
                            icon={<Sparkles className="h-3 w-3 shrink-0" />}
                        />
                    )}
                </div>

                <FlowRow
                    label={
                        <span className="flex min-w-0 items-center gap-1.5">
                            <span>CPF</span>
                            <TooltipPopover title="CPF">
                                Employee CPF, 20% of gross.
                            </TooltipPopover>
                        </span>
                    }
                    amount={cpfDeduction}
                    sign="-"
                    tone="negative"
                />

                <div className="space-y-1.5">
                    <FlowRow
                        label="Deductions"
                        amount={fixedDeductions}
                        sign="-"
                        tone="negative"
                    />
                    <FlowRow label="Taxes" amount={taxesDeduction} sub />
                    <FlowRow label="Insurance" amount={insuranceDeduction} sub />
                </div>
            </div>

            <div className="rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint-light) p-3 shadow-(--shadow-cute-sm)">
                <FlowRow label="Take-home" amount={afterDeductions} bold />
            </div>

            {categories.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                        <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            Allocations
                        </span>
                        <span className="shrink-0 text-xs font-bold text-(--text-muted)">
                            100%
                        </span>
                    </div>
                    <div className="divide-y divide-(--border-subtle)">
                        {categories.map((catDetail) => {
                            const name = catDetail.category?.name || "Category";
                            const color =
                                catDetail.category?.color || PRESET_COLORS[0];
                            const percentDisplay = `${formatAllocationPercent(catDetail.percentage * 100)}%`;

                            return (
                                <div
                                    key={catDetail.id || catDetail.category_id}
                                    className="flex items-center gap-2 py-2.5 text-sm font-bold text-(--text-ink)"
                                >
                                    <span
                                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                                        style={{ backgroundColor: color }}
                                    />
                                    <div className="min-w-0 flex-1">
                                        <TruncatedText text={name} />
                                    </div>
                                    <span className="shrink-0 text-xs font-bold text-(--text-muted)">
                                        {percentDisplay}
                                    </span>
                                    <span className="shrink-0 font-mono-num">
                                        <CurrencyText
                                            amount={catDetail.allocated_amount}
                                        />
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {onEditProfile && (
                <div className="flex justify-end pt-1">
                    <Button
                        variant="outline"
                        size="sm"
                        leftIcon={<Settings className="h-3.5 w-3.5" />}
                        onClick={onEditProfile}
                    >
                        Edit Budget
                    </Button>
                </div>
            )}
        </div>
    );
}

export default BudgetWaterfall;
