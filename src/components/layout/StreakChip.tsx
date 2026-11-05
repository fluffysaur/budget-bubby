/**
 * StreakChip
 * Compact header chip showing the logged-in member's daily check-in streak.
 * Reads the shared household check-ins query (the same one Bubby uses), so
 * it refreshes with every log and on resume with no extra fetches.
 * Tapping it opens a popover with the full DailyCheckinStreakBar
 * (7-day dots, couple streak, and the no-spend check-in action).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Flame } from "lucide-react";
import { useHousehold } from "../../context/HouseholdContext";
import { useHouseholdCheckinsQuery, useSgtClock } from "../../hooks/useBubby";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { memberStreak } from "../../lib/bubby/growth";
import { emitAppEvent } from "../../lib/appEvents";
import { DailyCheckinStreakBar } from "../dashboard/DailyCheckinStreakBar";
import { Button } from "../ui/Button";

export interface StreakChipProps {
    className?: string;
}

export function StreakChip({ className = "" }: StreakChipProps) {
    const { refreshData } = useHousehold();
    const { me } = useLoggedInMember();
    const memberId = me?.id;
    const { today } = useSgtClock();
    const { data: checkins } = useHouseholdCheckinsQuery();

    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const { count, checkedInToday } = useMemo(() => {
        if (!memberId || !checkins) return { count: 0, checkedInToday: false };
        return {
            count: memberStreak(checkins, memberId, today),
            checkedInToday: checkins.some(
                (c) => c.member_id === memberId && c.checkin_date === today,
            ),
        };
    }, [checkins, memberId, today]);

    // Close on outside tap or Escape
    useEffect(() => {
        if (!isOpen) return;
        const handlePointer = (e: MouseEvent | TouchEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setIsOpen(false);
        };
        document.addEventListener("mousedown", handlePointer);
        document.addEventListener("touchstart", handlePointer);
        document.addEventListener("keydown", handleKey);
        return () => {
            document.removeEventListener("mousedown", handlePointer);
            document.removeEventListener("touchstart", handlePointer);
            document.removeEventListener("keydown", handleKey);
        };
    }, [isOpen]);

    if (!memberId) return null;

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            <button
                type="button"
                data-testid="streak-chip"
                onClick={() => setIsOpen((prev) => !prev)}
                aria-haspopup="dialog"
                aria-expanded={isOpen}
                aria-label={`${count}-day streak${checkedInToday ? ", checked in today" : ""}`}
                className={`flex h-9 sm:h-10 items-center gap-1 rounded-xl border-2 border-(--border-ink) px-2.5 text-xs font-black text-(--text-ink) shadow-(--shadow-cute-sm) transition-all cursor-pointer active:translate-x-0.5 active:translate-y-0.5 active:shadow-none ${
                    checkedInToday ? "bg-(--pastel-butter)" : "bg-(--bg-card)"
                }`}
            >
                <Flame
                    className={`h-4 w-4 ${checkedInToday ? "text-orange-600 fill-orange-400" : "text-(--text-muted)"}`}
                    strokeWidth={2.5}
                />
                <span className="font-mono-num">{count}</span>
            </button>

            {isOpen && (
                <div
                    role="dialog"
                    aria-label="Check-in Streak"
                    className="fixed left-4 right-4 top-16 sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-96 z-50 animate-in fade-in zoom-in-95 duration-100"
                >
                    <DailyCheckinStreakBar
                        memberId={memberId}
                        onCheckinSuccess={() => {
                            void refreshData();
                        }}
                    />
                    <div className="mt-2 flex justify-end">
                        <Button
                            variant="secondary"
                            size="sm"
                            className="min-h-11"
                            onClick={() => {
                                setIsOpen(false);
                                emitAppEvent("bubby:open-sheet", {});
                            }}
                        >
                            See Bubby
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default StreakChip;
