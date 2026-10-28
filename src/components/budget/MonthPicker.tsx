/**
 * MonthPicker Component
 * Monthly navigation component ('YYYY-MM') with:
 * - Tactile Warm Oat aesthetic with shadow-(--shadow-cute-sm) and border-2
 * - Previous / Next month step controls
 * - Interactive month display trigger opening a custom month-selection popover
 * - Year steppers and 12-month quick select grid
 * - Current month badge & jump to current month trigger
 */

import { useState, useEffect } from "react";
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    FloatingPortal,
    useDismiss,
    useRole,
    useInteractions,
} from "@floating-ui/react";
import { ChevronLeft, ChevronRight, Calendar, RotateCcw, X } from "lucide-react";
import { addMonths, formatDisplayMonth, getCurrentMonth } from "../../lib/dateUtils";

export interface MonthPickerProps {
    selectedMonth: string; // 'YYYY-MM'
    onChangeMonth: (month: string) => void;
    className?: string;
}

const MONTH_NAMES = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
];

export function MonthPicker({
    selectedMonth,
    onChangeMonth,
    className = "",
}: MonthPickerProps) {
    const currentMonth = getCurrentMonth();

    const [isOpen, setIsOpen] = useState(false);
    const [navYear, setNavYear] = useState<number>(() => {
        const parts = selectedMonth.split("-");
        return parts.length > 0 && !isNaN(parseInt(parts[0], 10))
            ? parseInt(parts[0], 10)
            : new Date().getFullYear();
    });

    // Synchronize navYear when selectedMonth prop changes externally
    useEffect(() => {
        const parts = selectedMonth.split("-");
        if (parts.length > 0) {
            const y = parseInt(parts[0], 10);
            if (!isNaN(y)) {
                setNavYear(y);
            }
        }
    }, [selectedMonth]);

    const {
        refs: { setReference, setFloating },
        floatingStyles,
        context,
        isPositioned,
    } = useFloating({
        open: isOpen,
        onOpenChange: setIsOpen,
        placement: "bottom-start",
        whileElementsMounted: autoUpdate,
        middleware: [
            offset(8),
            flip({ fallbackAxisSideDirection: "start" }),
            shift({ padding: 8 }),
        ],
    });

    const dismiss = useDismiss(context, {
        escapeKey: true,
        outsidePress: true,
        outsidePressEvent: "mousedown",
    });
    const role = useRole(context, { role: "dialog" });

    const { getReferenceProps, getFloatingProps } = useInteractions([
        dismiss,
        role,
    ]);

    const handlePrevMonth = () => {
        onChangeMonth(addMonths(selectedMonth, -1));
    };

    const handleNextMonth = () => {
        onChangeMonth(addMonths(selectedMonth, 1));
    };

    const handleSelectMonth = (monthIndex: number) => {
        const monthNumStr = String(monthIndex + 1).padStart(2, "0");
        onChangeMonth(`${navYear}-${monthNumStr}`);
        setIsOpen(false);
    };

    const handleJumpFromPopover = () => {
        onChangeMonth(currentMonth);
        const currYear = parseInt(currentMonth.split("-")[0], 10);
        if (!isNaN(currYear)) {
            setNavYear(currYear);
        }
        setIsOpen(false);
    };

    return (
        <div
            className={`inline-flex items-center justify-between gap-1.5 sm:gap-2 p-1.5 bg-(--bg-card) border-2 border-(--border-ink) rounded-2xl shadow-(--shadow-cute-sm) transition-colors w-full sm:w-auto ${className}`}
        >
            {/* Previous Month Button */}
            <button
                type="button"
                onClick={handlePrevMonth}
                aria-label="Previous month"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>

            {/* Interactive Month Display Pill (Tap to open month popover) */}
            <button
                ref={setReference}
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-label={`Choose month: ${formatDisplayMonth(selectedMonth)}`}
                aria-expanded={isOpen}
                className={`h-9 flex-1 sm:flex-initial flex items-center justify-center sm:justify-start gap-2 px-3 rounded-xl border transition-all cursor-pointer select-none active:translate-x-0.5 active:translate-y-0.5 ${
                    isOpen
                        ? "bg-(--bg-cream) border-(--border-ink)"
                        : "border-(--border-subtle) hover:border-(--border-ink) hover:bg-(--bg-cream)"
                }`}
                {...getReferenceProps()}
            >
                <div className="flex h-6 w-6 items-center justify-center rounded-lg border border-(--border-ink) bg-(--pastel-lilac-light) text-(--text-ink) shrink-0">
                    <Calendar className="h-3.5 w-3.5" />
                </div>
                <span className="font-display font-black text-sm tracking-tight text-(--text-ink)">
                    {formatDisplayMonth(selectedMonth)}
                </span>
            </button>

            {/* Next Month Button */}
            <button
                type="button"
                onClick={handleNextMonth}
                aria-label="Next month"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer shrink-0"
            >
                <ChevronRight className="h-4 w-4" />
            </button>

            {/* Month Selection Popover */}
            {isOpen && (
                <FloatingPortal>
                    <div
                        ref={setFloating}
                        style={{
                            ...floatingStyles,
                            opacity: isPositioned ? 1 : 0,
                        }}
                        {...getFloatingProps()}
                        className="z-9999 w-72 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3.5 shadow-(--shadow-cute) select-none transition-opacity duration-150 animate-in fade-in"
                    >
                        {/* Popover Header: Year Stepper & Close Button */}
                        <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-(--border-subtle)">
                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    onClick={() => setNavYear((y) => y - 1)}
                                    aria-label="Previous year"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                >
                                    <ChevronLeft className="h-3.5 w-3.5" />
                                </button>
                                <span className="font-display font-black text-sm tracking-tight text-(--text-ink) px-1 font-mono-num">
                                    {navYear}
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setNavYear((y) => y + 1)}
                                    aria-label="Next year"
                                    className="flex h-7 w-7 items-center justify-center rounded-lg border border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                >
                                    <ChevronRight className="h-3.5 w-3.5" />
                                </button>
                            </div>

                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                aria-label="Close month picker"
                                className="p-1 rounded-lg text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) cursor-pointer"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {/* 12-Month Grid (4 rows x 3 cols) */}
                        <div className="grid grid-cols-3 gap-1.5">
                            {MONTH_NAMES.map((monthName, index) => {
                                const monthNumStr = String(index + 1).padStart(2, "0");
                                const monthKey = `${navYear}-${monthNumStr}`;
                                const isSelected = selectedMonth === monthKey;
                                const isTodayMonth = currentMonth === monthKey;

                                return (
                                    <button
                                        key={monthKey}
                                        type="button"
                                        onClick={() => handleSelectMonth(index)}
                                        aria-label={`Select ${monthName} ${navYear}`}
                                        className={`h-10 flex items-center justify-center rounded-xl text-xs font-bold transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 ${
                                            isSelected
                                                ? "bg-[#dfc2ff] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm)"
                                                : isTodayMonth
                                                  ? "bg-(--pastel-mint) text-(--text-ink) border border-(--border-ink) hover:bg-(--pastel-mint-dark)"
                                                  : "bg-(--bg-canvas) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink) hover:bg-(--pastel-butter-light)"
                                        }`}
                                    >
                                        <span>{monthName}</span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Quick Jump to Current Month */}
                        <div className="mt-2.5 pt-2 border-t border-(--border-subtle)">
                            <button
                                type="button"
                                onClick={handleJumpFromPopover}
                                aria-label="Jump to current month from picker"
                                className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold border border-(--border-ink) bg-(--pastel-butter-light) text-(--text-ink) hover:bg-(--pastel-butter) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                            >
                                <RotateCcw className="h-3 w-3 shrink-0" />
                                <span>Jump to Current Month</span>
                            </button>
                        </div>
                    </div>
                </FloatingPortal>
            )}
        </div>
    );
}

export default MonthPicker;
