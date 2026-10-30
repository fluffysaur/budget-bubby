/**
 * LoansPage Component
 * Integrated Loans & Debt Freedom Engine:
 * - Fetches loans from financeService.getLoans()
 * - Loan selector tabs (defaulting to HDB Loan)
 * - LoanSummaryCard
 * - PrepaymentSimulator
 * - AmortizationChart
 * - AmortizationTable
 * - Supports household & individual perspective view
 */

import { useState, useMemo, useEffect } from "react";
import { CreditCard } from "lucide-react";
import { useHousehold } from "../context/HouseholdContext";
import {
    PageHeader,
    LoadingCard,
    EmptyStateCard,
    SegmentedTabs,
    type TabItem,
} from "../components/ui";
import { useLoansQuery } from "../hooks/useFinanceQueries";
import { calculateLoanAmortization } from "../lib/financialFormulas";
import { LoanSummaryCard } from "../components/loans/LoanSummaryCard";
import { PrepaymentSimulator } from "../components/loans/PrepaymentSimulator";
import { AmortizationChart } from "../components/loans/AmortizationChart";
import { AmortizationTable } from "../components/loans/AmortizationTable";
import type { AmortizationResult } from "../types/finance";

export interface LoansPageProps {
    className?: string;
    embedded?: boolean;
}

const SCHEDULE_VIEW_TABS: TabItem<"simulated" | "baseline">[] = [
    {
        id: "simulated",
        label: "Accelerated (+Prepayment)",
    },
    {
        id: "baseline",
        label: "Baseline Standard",
    },
];

export function LoansPage({ className = "", embedded = false }: LoansPageProps) {
    const { perspective, activeMember } = useHousehold();

    // Cached Loans Query
    const { data: loansData, isLoading: loansLoading } = useLoansQuery();
    const loans = useMemo(() => loansData || [], [loansData]);
    const isLoading = loansLoading && !loansData;

    const [selectedLoanId, setSelectedLoanId] = useState<string | null>(null);

    // Prepayment simulation state
    const [extraMonthly, setExtraMonthly] = useState<number>(0);
    const [lumpSum, setLumpSum] = useState<number>(0);
    const [scheduleView, setScheduleView] = useState<"simulated" | "baseline">("simulated");

    // Initialize selected loan once loans arrive
    useEffect(() => {
        if (loans.length > 0 && !selectedLoanId) {
            const hdb = loans.find((l) => l.name.toLowerCase().includes("hdb"));
            setSelectedLoanId(hdb ? hdb.id : loans[0].id);
        }
    }, [loans, selectedLoanId]);

    // Filter loans according to perspective if relevant
    const displayedLoans = useMemo(() => {
        return loans.filter((l) => {
            if (perspective === "household") return true;
            // Joint loans or loans assigned to active member
            return !l.borrower_id || l.borrower_id === activeMember?.id;
        });
    }, [loans, perspective, activeMember]);

    // Active loan object
    const activeLoan = useMemo(() => {
        if (!displayedLoans.length) return null;
        return (
            displayedLoans.find((l) => l.id === selectedLoanId) ||
            displayedLoans[0]
        );
    }, [displayedLoans, selectedLoanId]);

    // Handlers
    const handleSelectLoan = (id: string) => {
        setSelectedLoanId(id);
        // Reset prepayment inputs when switching loans
        setExtraMonthly(0);
        setLumpSum(0);
    };

    // Calculate baseline amortization for active loan
    const baselineAmortization = useMemo<AmortizationResult>(() => {
        if (!activeLoan) {
            return {
                schedule: [],
                totalMonths: 0,
                totalInterest: 0,
                payoffDate: "",
                monthlyPayment: 0,
            };
        }

        const basePrincipal = Math.max(
            0,
            activeLoan.principal - (activeLoan.amount_paid || 0),
        );
        if (basePrincipal <= 0) {
            return {
                schedule: [],
                totalMonths: 0,
                totalInterest: 0,
                payoffDate: activeLoan.start_date,
                monthlyPayment: activeLoan.monthly_payment,
            };
        }

        try {
            return calculateLoanAmortization(
                basePrincipal,
                activeLoan.interest_rate,
                activeLoan.monthly_payment,
                activeLoan.start_date,
                0,
            );
        } catch {
            return {
                schedule: [],
                totalMonths: activeLoan.term_months,
                totalInterest: 0,
                payoffDate: activeLoan.start_date,
                monthlyPayment: activeLoan.monthly_payment,
            };
        }
    }, [activeLoan]);

    // Calculate simulated amortization with prepayment
    const simulatedAmortization = useMemo<AmortizationResult>(() => {
        if (!activeLoan) return baselineAmortization;

        const basePrincipal = Math.max(
            0,
            activeLoan.principal - (activeLoan.amount_paid || 0),
        );
        const effectivePrincipal = Math.max(0, basePrincipal - lumpSum);

        if (effectivePrincipal <= 0) {
            return {
                schedule: [],
                totalMonths: 0,
                totalInterest: 0,
                payoffDate: activeLoan.start_date,
                monthlyPayment: activeLoan.monthly_payment,
            };
        }

        try {
            return calculateLoanAmortization(
                effectivePrincipal,
                activeLoan.interest_rate,
                activeLoan.monthly_payment,
                activeLoan.start_date,
                extraMonthly,
            );
        } catch {
            return baselineAmortization;
        }
    }, [activeLoan, lumpSum, extraMonthly, baselineAmortization]);

    const hasPrepayment = extraMonthly > 0 || lumpSum > 0;

    const loanSelectorTabs: TabItem[] = useMemo(() => {
        return displayedLoans.map((loan) => ({
            id: loan.id,
            label: loan.name,
        }));
    }, [displayedLoans]);

    if (isLoading) {
        return (
            <div className={`space-y-4 ${className}`}>
                <LoadingCard message="Loading loan amortization schedules & payment engine..." />
            </div>
        );
    }

    if (!activeLoan || displayedLoans.length === 0) {
        return (
            <EmptyStateCard
                icon={<CreditCard className="w-6 h-6" strokeWidth={2.5} />}
                title="No Loans"
                description="Add a mortgage or loan to track repayments."
                className={className}
            />
        );
    }

    return (
        <div className={`space-y-5 ${!embedded ? "pb-20 md:pb-12" : ""} ${className}`.trim()}>
            {/* Page Header (Hidden if embedded in Plan Hub) */}
            {!embedded && (
                <PageHeader
                    title="Loans"
                    actions={
                        displayedLoans.length > 1 ? (
                            <SegmentedTabs
                                tabs={loanSelectorTabs}
                                activeTab={activeLoan?.id || selectedLoanId || ""}
                                onChange={handleSelectLoan}
                                accent="lilac"
                                size="sm"
                            />
                        ) : undefined
                    }
                />
            )}

            {/* Embedded loan selector */}
            {embedded && displayedLoans.length > 1 && (
                <SegmentedTabs
                    tabs={loanSelectorTabs}
                    activeTab={activeLoan?.id || selectedLoanId || ""}
                    onChange={handleSelectLoan}
                    accent="lilac"
                    size="sm"
                />
            )}

            {/* 1. Loan Overview Card */}
            <LoanSummaryCard
                loan={activeLoan}
                baselineAmortization={baselineAmortization}
            />

            {/* 2. Interactive Prepayment Simulator */}
            <PrepaymentSimulator
                loan={activeLoan}
                extraMonthly={extraMonthly}
                lumpSum={lumpSum}
                onChangeExtraMonthly={setExtraMonthly}
                onChangeLumpSum={setLumpSum}
            />

            {/* 3. Amortization Trajectory Chart */}
            <AmortizationChart
                baselineSchedule={baselineAmortization.schedule}
                simulatedSchedule={simulatedAmortization.schedule}
                hasPrepayment={hasPrepayment}
            />

            {/* 4. Detailed Schedule Table with View Mode Switcher */}
            <div className="space-y-3">
                {hasPrepayment && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-1">
                        <span className="text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            Schedule View:
                        </span>
                        <SegmentedTabs
                            tabs={SCHEDULE_VIEW_TABS}
                            activeTab={scheduleView}
                            onChange={(id) => setScheduleView(id as "simulated" | "baseline")}
                            accent="mint"
                            size="sm"
                        />
                    </div>
                )}

                <AmortizationTable
                    schedule={
                        scheduleView === "simulated" && hasPrepayment
                            ? simulatedAmortization.schedule
                            : baselineAmortization.schedule
                    }
                    initialExpandedYears={[1]}
                />
            </div>
        </div>
    );
}

export default LoansPage;
