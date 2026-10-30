/**
 * AmortizationTable Component
 * Month-by-month amortization schedule organized with annual rollup accordions:
 * - Year header displays Annual Payment, Principal Paid, Interest Paid, and Year-End Balance
 * - Expand/collapse individual years or all years at once
 * - Detailed table per year showing:
 *   - Month / Payment Date
 *   - Starting Balance
 *   - Payment Amount
 *   - Principal Portion
 *   - Interest Portion
 *   - Ending / Remaining Balance
 */

import { useState, useMemo } from "react";
import {
    ChevronDown,
    ChevronRight,
    ChevronsUpDown,
    Table,
    Layers,
} from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { Button } from "../ui/Button";
import type { AmortizationScheduleRow } from "../../types/finance";

export interface AmortizationTableProps {
    schedule: AmortizationScheduleRow[];
    initialExpandedYears?: number[];
    className?: string;
}

interface YearGroup {
    yearNumber: number;
    calendarYears: string;
    rows: (AmortizationScheduleRow & { startingBalance: number })[];
    totalPayments: number;
    totalPrincipal: number;
    totalInterest: number;
    startingBalance: number;
    endingBalance: number;
}

export function AmortizationTable({
    schedule,
    initialExpandedYears = [1],
    className = "",
}: AmortizationTableProps) {
    const [expandedYears, setExpandedYears] = useState<Set<number>>(
        new Set(initialExpandedYears),
    );

    // Group schedule into annual blocks (12 months each)
    const yearGroups = useMemo<YearGroup[]>(() => {
        if (!schedule || schedule.length === 0) return [];

        const groups: YearGroup[] = [];
        let currentYear = 1;

        for (let i = 0; i < schedule.length; i += 12) {
            const chunk = schedule.slice(i, i + 12);
            if (chunk.length === 0) continue;

            const rowsWithStarting = chunk.map((r) => ({
                ...r,
                startingBalance: r.remainingBalance + r.principalPayment,
            }));

            const totalPayments = chunk.reduce(
                (sum, r) => sum + r.payment,
                0,
            );
            const totalPrincipal = chunk.reduce(
                (sum, r) => sum + r.principalPayment,
                0,
            );
            const totalInterest = chunk.reduce(
                (sum, r) => sum + r.interestPayment,
                0,
            );
            const startingBalance = rowsWithStarting[0].startingBalance;
            const endingBalance = chunk[chunk.length - 1].remainingBalance;

            // Calendar years spanned
            const startYearStr = chunk[0].paymentDate.slice(0, 4);
            const endYearStr = chunk[chunk.length - 1].paymentDate.slice(0, 4);
            const calendarYears =
                startYearStr === endYearStr
                    ? startYearStr
                    : `${startYearStr} - ${endYearStr}`;

            groups.push({
                yearNumber: currentYear,
                calendarYears,
                rows: rowsWithStarting,
                totalPayments,
                totalPrincipal,
                totalInterest,
                startingBalance,
                endingBalance,
            });

            currentYear += 1;
        }

        return groups;
    }, [schedule]);

    const isAllExpanded =
        yearGroups.length > 0 && expandedYears.size === yearGroups.length;

    const toggleYear = (yearNum: number) => {
        setExpandedYears((prev) => {
            const next = new Set(prev);
            if (next.has(yearNum)) {
                next.delete(yearNum);
            } else {
                next.add(yearNum);
            }
            return next;
        });
    };

    const toggleAll = () => {
        if (isAllExpanded) {
            setExpandedYears(new Set());
        } else {
            setExpandedYears(new Set(yearGroups.map((g) => g.yearNumber)));
        }
    };

    if (!schedule || schedule.length === 0) {
        return (
            <div
                className={`p-8 text-center bg-(--bg-card) rounded-2xl border-2 border-(--border-ink) shadow-(--shadow-cute) ${className}`}
            >
                <Table className="w-8 h-8 mx-auto text-(--text-muted) mb-2" strokeWidth={2.5} />
                <p className="text-sm font-bold text-(--text-ink) font-display">
                    No amortization schedule available
                </p>
            </div>
        );
    }

    return (
        <div
            className={`bg-(--bg-card) rounded-2xl border-2 border-(--border-ink) p-6 shadow-(--shadow-cute) ${className}`}
        >
            {/* Header & Controls */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6 pb-4 border-b border-(--border-subtle)">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink) shadow-(--shadow-cute-sm)">
                        <Layers className="w-5 h-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <h3 className="font-display font-black text-lg text-(--text-ink)">
                            Amortization Schedule
                        </h3>
                        <p className="text-xs text-(--text-muted)">
                            {yearGroups.length} annual rollup{yearGroups.length !== 1 ? "s" : ""} ({schedule.length} total monthly payments).
                        </p>
                    </div>
                </div>

                <Button
                    variant="secondary"
                    size="sm"
                    onClick={toggleAll}
                    leftIcon={<ChevronsUpDown className="w-3.5 h-3.5" strokeWidth={2.5} />}
                    className="self-start sm:self-auto"
                >
                    {isAllExpanded ? "Collapse All" : "Expand All"}
                </Button>
            </div>

            {/* Accordions */}
            <div className="space-y-3">
                {yearGroups.map((group) => {
                    const isExpanded = expandedYears.has(group.yearNumber);

                    return (
                        <div
                            key={group.yearNumber}
                            className="border-2 border-(--border-ink) rounded-xl overflow-hidden transition-all shadow-(--shadow-cute-sm)"
                        >
                            {/* Year Accordion Trigger */}
                            <button
                                type="button"
                                onClick={() => toggleYear(group.yearNumber)}
                                aria-expanded={isExpanded}
                                className="w-full px-4 py-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-(--bg-cream) hover:bg-(--bg-card) transition-colors text-left cursor-pointer"
                            >
                                <div className="flex items-center gap-2.5">
                                    <div className="p-1 rounded-md text-(--text-muted)">
                                        {isExpanded ? (
                                            <ChevronDown className="w-4 h-4 text-(--text-ink)" strokeWidth={2.5} />
                                        ) : (
                                            <ChevronRight className="w-4 h-4 text-(--text-ink)" strokeWidth={2.5} />
                                        )}
                                    </div>
                                    <div>
                                        <span className="font-display font-bold text-sm text-(--text-ink)">
                                            Year {group.yearNumber}
                                        </span>
                                        <span className="ml-2 text-xs font-mono-num font-bold text-(--text-muted)">
                                            ({group.calendarYears} • {group.rows.length} mo{group.rows.length !== 1 ? "s" : ""})
                                        </span>
                                    </div>
                                </div>

                                {/* Annual Rollup Summary Metrics */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs pl-7 md:pl-0 font-mono-num">
                                    <span className="text-(--text-muted)">
                                        Paid:{" "}
                                        <strong className="text-(--text-ink) font-extrabold">
                                            {formatSGD(group.totalPayments)}
                                        </strong>
                                    </span>
                                    <span className="text-(--text-muted)">
                                        Principal:{" "}
                                        <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold">
                                            {formatSGD(group.totalPrincipal)}
                                        </strong>
                                    </span>
                                    <span className="text-(--text-muted)">
                                        Interest:{" "}
                                        <strong className="text-amber-700 dark:text-amber-400 font-extrabold">
                                            {formatSGD(group.totalInterest)}
                                        </strong>
                                    </span>
                                    <span className="text-(--text-muted)">
                                        Ending Bal:{" "}
                                        <strong className="text-(--text-ink) font-black">
                                            {formatSGD(group.endingBalance)}
                                        </strong>
                                    </span>
                                </div>
                            </button>

                            {/* Collapsible Month-by-Month Table */}
                            {isExpanded && (
                                <div className="overflow-x-auto border-t-2 border-(--border-ink) bg-(--bg-card)">
                                    <table className="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr className="bg-(--bg-cream) text-(--text-muted) font-bold border-b border-(--border-subtle) uppercase tracking-wider text-[11px]">
                                                <th scope="col" className="px-4 py-2.5">Month</th>
                                                <th scope="col" className="px-4 py-2.5 text-right">Starting Balance</th>
                                                <th scope="col" className="px-4 py-2.5 text-right">Payment</th>
                                                <th scope="col" className="px-4 py-2.5 text-right">Principal</th>
                                                <th scope="col" className="px-4 py-2.5 text-right">Interest</th>
                                                <th scope="col" className="px-4 py-2.5 text-right">Ending Balance</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-(--border-subtle) font-mono-num">
                                            {group.rows.map((row) => {
                                                let monthLabel: string;
                                                try {
                                                    monthLabel = formatDisplayMonth(row.paymentDate);
                                                } catch {
                                                    monthLabel = row.paymentDate;
                                                }

                                                return (
                                                    <tr
                                                        key={row.month}
                                                        className="hover:bg-(--bg-cream)/60 transition-colors"
                                                    >
                                                        <td className="px-4 py-2.5 font-bold text-(--text-ink)">
                                                            {monthLabel}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-(--text-muted)">
                                                            {formatSGD(row.startingBalance)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-(--text-ink)">
                                                            {formatSGD(row.payment)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400">
                                                            {formatSGD(row.principalPayment)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right text-amber-700 dark:text-amber-400">
                                                            {formatSGD(row.interestPayment)}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-right font-extrabold text-(--text-ink)">
                                                            {formatSGD(row.remainingBalance)}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default AmortizationTable;
