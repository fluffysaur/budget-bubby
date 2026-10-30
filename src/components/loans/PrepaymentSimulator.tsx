/**
 * PrepaymentSimulator Component
 * Interactive mortgage & loan prepayment calculator:
 * - Slider & number input for extra monthly prepayment (e.g. +$0 to +$3,000/mo)
 * - Optional lump-sum one-time prepayment input
 * - Quick preset buttons (+$100, +$250, +$500, +$1,000, Reset)
 * - Computes:
 *   - Interest Saved (SGD)
 *   - Time Saved (months & years)
 *   - New Debt-Free Date
 *   - Side-by-side baseline vs simulated comparison
 */

import { useState, useEffect, useMemo } from "react";
import {
    Sparkles,
    TrendingDown,
    Calendar,
    Clock,
    RotateCcw,
    Coins,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { calculateLoanAmortization } from "../../lib/financialFormulas";
import { Button } from "../ui/Button";
import type { Loan, AmortizationResult } from "../../types/finance";

export interface PrepaymentSimulationResult {
    extraMonthly: number;
    lumpSum: number;
    baselineAmortization: AmortizationResult;
    simulatedAmortization: AmortizationResult;
    interestSaved: number;
    monthsSaved: number;
}

export interface PrepaymentSimulatorProps {
    loan: Loan;
    extraMonthly?: number;
    lumpSum?: number;
    onChangeExtraMonthly?: (value: number) => void;
    onChangeLumpSum?: (value: number) => void;
    onSimulationChange?: (result: PrepaymentSimulationResult) => void;
    className?: string;
}

const PRESETS = [100, 250, 500, 1000];

export function PrepaymentSimulator({
    loan,
    extraMonthly: controlledExtraMonthly,
    lumpSum: controlledLumpSum,
    onChangeExtraMonthly,
    onChangeLumpSum,
    onSimulationChange,
    className = "",
}: PrepaymentSimulatorProps) {
    // Internal state if uncontrolled
    const [internalExtraMonthly, setInternalExtraMonthly] = useState<number>(0);
    const [internalLumpSum, setInternalLumpSum] = useState<number>(0);

    const isControlledExtra = controlledExtraMonthly !== undefined;
    const isControlledLump = controlledLumpSum !== undefined;

    const extraMonthly = isControlledExtra
        ? controlledExtraMonthly
        : internalExtraMonthly;
    const lumpSum = isControlledLump ? controlledLumpSum : internalLumpSum;

    const handleExtraMonthlyChange = (value: number) => {
        const sanitized = Math.max(0, Math.round(value));
        if (isControlledExtra && onChangeExtraMonthly) {
            onChangeExtraMonthly(sanitized);
        } else {
            setInternalExtraMonthly(sanitized);
        }
    };

    const handleLumpSumChange = (value: number) => {
        const sanitized = Math.max(0, Math.round(value));
        if (isControlledLump && onChangeLumpSum) {
            onChangeLumpSum(sanitized);
        } else {
            setInternalLumpSum(sanitized);
        }
    };

    // Calculate baseline amortization
    const basePrincipal = Math.max(0, loan.principal - (loan.amount_paid || 0));

    const baseline = useMemo<AmortizationResult>(() => {
        if (basePrincipal <= 0) {
            return {
                schedule: [],
                totalMonths: 0,
                totalInterest: 0,
                payoffDate: loan.start_date,
                monthlyPayment: loan.monthly_payment,
            };
        }
        try {
            return calculateLoanAmortization(
                basePrincipal,
                loan.interest_rate,
                loan.monthly_payment,
                loan.start_date,
                0,
            );
        } catch {
            return {
                schedule: [],
                totalMonths: loan.term_months,
                totalInterest: 0,
                payoffDate: loan.start_date,
                monthlyPayment: loan.monthly_payment,
            };
        }
    }, [basePrincipal, loan.interest_rate, loan.monthly_payment, loan.start_date, loan.term_months]);

    // Calculate simulated amortization with prepayment
    const simulated = useMemo<AmortizationResult>(() => {
        if (basePrincipal <= 0) {
            return {
                schedule: [],
                totalMonths: 0,
                totalInterest: 0,
                payoffDate: loan.start_date,
                monthlyPayment: loan.monthly_payment,
            };
        }

        const effectivePrincipal = Math.max(0, basePrincipal - lumpSum);
        if (effectivePrincipal <= 0) {
            return {
                schedule: [],
                totalMonths: 0,
                totalInterest: 0,
                payoffDate: loan.start_date,
                monthlyPayment: loan.monthly_payment,
            };
        }

        try {
            return calculateLoanAmortization(
                effectivePrincipal,
                loan.interest_rate,
                loan.monthly_payment,
                loan.start_date,
                extraMonthly,
            );
        } catch {
            return baseline;
        }
    }, [basePrincipal, lumpSum, loan.interest_rate, loan.monthly_payment, loan.start_date, extraMonthly, baseline]);

    // Financial & Duration savings
    const interestSaved = Math.max(0, baseline.totalInterest - simulated.totalInterest);
    const monthsSaved = Math.max(0, baseline.totalMonths - simulated.totalMonths);

    // Notify parent on change
    useEffect(() => {
        if (onSimulationChange) {
            onSimulationChange({
                extraMonthly,
                lumpSum,
                baselineAmortization: baseline,
                simulatedAmortization: simulated,
                interestSaved,
                monthsSaved,
            });
        }
    }, [extraMonthly, lumpSum, baseline, simulated, interestSaved, monthsSaved, onSimulationChange]);

    const timeSavedFormatted = useMemo(() => {
        if (monthsSaved <= 0) return "0 months";
        const years = Math.floor(monthsSaved / 12);
        const remMonths = monthsSaved % 12;

        if (years > 0 && remMonths > 0) {
            return `${years} yr${years > 1 ? "s" : ""} ${remMonths} mo${remMonths > 1 ? "s" : ""}`;
        }
        if (years > 0) {
            return `${years} year${years > 1 ? "s" : ""}`;
        }
        return `${remMonths} month${remMonths > 1 ? "s" : ""}`;
    }, [monthsSaved]);

    const baselinePayoffFormatted = useMemo(() => {
        try {
            return formatDisplayMonth(baseline.payoffDate);
        } catch {
            return baseline.payoffDate;
        }
    }, [baseline.payoffDate]);

    const simulatedPayoffFormatted = useMemo(() => {
        try {
            return formatDisplayMonth(simulated.payoffDate);
        } catch {
            return simulated.payoffDate;
        }
    }, [simulated.payoffDate]);

    const hasPrepayment = extraMonthly > 0 || lumpSum > 0;

    return (
        <div
            className={`bg-(--bg-card) rounded-2xl border-2 border-(--border-ink) p-6 shadow-(--shadow-cute) ${className}`}
        >
            {/* Title */}
            <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-(--border-subtle)">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-mint) text-(--text-ink) shadow-(--shadow-cute-sm)">
                        <Sparkles className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-display font-black text-lg text-(--text-ink)">
                            Prepayment Simulator
                        </h3>
                        <p className="text-xs text-(--text-muted)">
                            Simulate extra monthly payments or lump-sum capital reduction.
                        </p>
                    </div>
                </div>

                {hasPrepayment && (
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                            handleExtraMonthlyChange(0);
                            handleLumpSumChange(0);
                        }}
                        leftIcon={<RotateCcw className="w-3.5 h-3.5" strokeWidth={2.5} />}
                    >
                        Reset
                    </Button>
                )}
            </div>

            {/* Simulator Inputs */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                {/* Extra Monthly Payment Slider & Input */}
                <div className="space-y-3 p-4 rounded-xl bg-(--bg-canvas) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="extra-monthly-slider"
                            className="text-xs font-bold uppercase tracking-wider text-(--text-muted)"
                        >
                            Extra Monthly Payment
                        </label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-(--text-muted) font-medium">+S$</span>
                            <input
                                id="extra-monthly-input"
                                data-testid="extra-monthly-input"
                                type="number"
                                min="0"
                                max="10000"
                                step="50"
                                value={extraMonthly}
                                onChange={(e) => handleExtraMonthlyChange(parseFloat(e.target.value) || 0)}
                                className="w-24 px-2 py-1 text-right text-sm font-bold text-(--text-ink) bg-(--bg-card) border-2 border-(--border-ink) rounded-lg focus:outline-hidden focus:ring-2 focus:ring-(--pastel-mint)"
                            />
                            <span className="text-xs text-(--text-muted)">/mo</span>
                        </div>
                    </div>

                    {/* Slider */}
                    <input
                        id="extra-monthly-slider"
                        aria-label="Extra Monthly Payment"
                        type="range"
                        min="0"
                        max="3000"
                        step="50"
                        value={extraMonthly}
                        onChange={(e) => handleExtraMonthlyChange(parseFloat(e.target.value))}
                        className="w-full h-2 bg-(--border-subtle) rounded-lg appearance-none cursor-pointer accent-emerald-600 focus:outline-hidden"
                    />

                    {/* Quick Preset Buttons */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] text-(--text-muted) font-bold mr-1">Quick Add:</span>
                        {PRESETS.map((amount) => (
                            <button
                                key={amount}
                                type="button"
                                onClick={() => handleExtraMonthlyChange(amount)}
                                className={`px-2.5 py-1 text-xs font-bold rounded-lg border-2 border-(--border-ink) transition-all cursor-pointer ${
                                    extraMonthly === amount
                                        ? "bg-(--pastel-mint) text-(--text-ink) shadow-(--shadow-cute-sm)"
                                        : "bg-(--bg-card) text-(--text-ink) hover:bg-(--bg-cream)"
                                }`}
                            >
                                +S${amount}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Lump-Sum Upfront Prepayment Input */}
                <div className="space-y-3 p-4 rounded-xl bg-(--bg-canvas) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                    <div className="flex items-center justify-between">
                        <label
                            htmlFor="lump-sum-input"
                            className="text-xs font-bold uppercase tracking-wider text-(--text-muted) flex items-center gap-1"
                        >
                            <Coins className="w-3.5 h-3.5 text-amber-500" strokeWidth={2.5} />
                            <span>Lump Sum Prepayment</span>
                        </label>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-(--text-muted) font-medium">S$</span>
                            <input
                                id="lump-sum-input"
                                data-testid="lump-sum-input"
                                type="number"
                                min="0"
                                max={basePrincipal}
                                step="1000"
                                value={lumpSum}
                                onChange={(e) => handleLumpSumChange(parseFloat(e.target.value) || 0)}
                                className="w-28 px-2 py-1 text-right text-sm font-bold text-(--text-ink) bg-(--bg-card) border-2 border-(--border-ink) rounded-lg focus:outline-hidden focus:ring-2 focus:ring-(--pastel-butter)"
                            />
                        </div>
                    </div>

                    <p className="text-xs text-(--text-muted) leading-relaxed">
                        Apply bonuses or windfalls directly to reduce principal upfront.
                    </p>

                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        {[5000, 10000, 20000, 50000].map((amount) => (
                            <button
                                key={amount}
                                type="button"
                                onClick={() => handleLumpSumChange(amount)}
                                className={`px-2 py-1 text-[11px] font-bold rounded-lg border-2 border-(--border-ink) transition-all cursor-pointer ${
                                    lumpSum === amount
                                        ? "bg-(--pastel-butter) text-(--text-ink) shadow-(--shadow-cute-sm)"
                                        : "bg-(--bg-card) text-(--text-ink) hover:bg-(--bg-cream)"
                                }`}
                            >
                                +S${amount >= 1000 ? `${amount / 1000}k` : amount}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Simulator Results Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Interest Saved */}
                <div className="p-4 rounded-xl bg-(--pastel-mint-light) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">
                            Interest Saved
                        </span>
                        <div className="p-1 rounded-md border-2 border-(--border-ink) bg-(--pastel-mint) text-(--text-ink)">
                            <TrendingDown className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div
                        data-testid="interest-saved"
                        className="font-mono-num text-2xl font-black text-emerald-800 dark:text-emerald-300 tracking-tight"
                    >
                        {formatSGD(interestSaved)}
                    </div>
                    <div className="text-[11px] text-(--text-muted) mt-1 font-semibold">
                        {hasPrepayment
                            ? "Guaranteed interest savings"
                            : "Simulate prepayment to save on interest"}
                    </div>
                </div>

                {/* Time Saved */}
                <div className="p-4 rounded-xl bg-(--pastel-butter-light) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">
                            Time Shaved Off
                        </span>
                        <div className="p-1 rounded-md border-2 border-(--border-ink) bg-(--pastel-butter) text-(--text-ink)">
                            <Clock className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div
                        data-testid="time-saved"
                        className="font-mono-num text-2xl font-black text-(--text-ink) tracking-tight"
                    >
                        {monthsSaved > 0 ? `${monthsSaved} mos` : "0 mos"}
                    </div>
                    <div className="text-[11px] text-(--text-muted) mt-1 font-semibold truncate">
                        {timeSavedFormatted}
                    </div>
                </div>

                {/* New Debt-Free Date */}
                <div className="p-4 rounded-xl bg-(--pastel-lilac-light) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)">
                    <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">
                            New Debt-Free Date
                        </span>
                        <div className="p-1 rounded-md border-2 border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink)">
                            <Calendar className="w-3.5 h-3.5" strokeWidth={2.5} />
                        </div>
                    </div>
                    <div
                        data-testid="new-debt-free-date"
                        className="font-mono-num text-2xl font-black text-purple-900 dark:text-purple-300 tracking-tight"
                    >
                        {simulatedPayoffFormatted}
                    </div>
                    <div className="font-mono-num text-[11px] text-(--text-muted) mt-1 font-semibold">
                        Baseline: {baselinePayoffFormatted}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PrepaymentSimulator;
