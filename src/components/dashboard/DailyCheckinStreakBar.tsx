/**
 * DailyCheckinStreakBar Component
 * Gamified Daily Check-in & Streak tracker for Budget Bubby.
 * 
 * Features:
 * - Shows personal streak (e.g. 🔥 7-day streak)
 * - 7-day mini calendar dots indicating checked-in days with today highlighted
 * - Couple streak badge (👩‍❤️‍👨 X-day couple streak when both partners checked in)
 * - "Checked in today!" badge if an expense or no-spend was logged today
 * - 1-tap "🎉 No Spend Today — Check In" button when not yet checked in today
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Flame, Check, Sparkles, Heart, Loader2 } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { financeService } from '../../services/financeService';
import { getTodayDateString, formatISODate } from '../../lib/dateUtils';
import { playChaChingSound } from '../../lib/soundEffects';
import { TooltipPopover } from '../ui/TooltipPopover';
import type { DailyCheckin, StreakSummary } from '../../types/finance';

export interface DailyCheckinStreakBarProps {
  className?: string;
  memberId?: string;
  onCheckinSuccess?: () => void;
}

interface CalendarDayDot {
  isoDate: string;
  dayLabel: string;
  dayNum: number;
  isCheckedIn: boolean;
  isToday: boolean;
  checkinType?: 'expense' | 'no_spend';
}

export function DailyCheckinStreakBar({
  className = '',
  memberId,
  onCheckinSuccess,
}: DailyCheckinStreakBarProps) {
  const { activeMember, members } = useHousehold();

  // Resolve target member ID
  const resolvedMemberId = useMemo(() => {
    if (memberId) return memberId;
    if (activeMember?.id) return activeMember.id;
    return members?.[0]?.id || 'mem-00000000-0011';
  }, [memberId, activeMember, members]);

  const [streak, setStreak] = useState<StreakSummary>({
    currentStreak: 0,
    longestStreak: 0,
    checkedInToday: false,
    coupleStreak: 0,
    lastCheckinDate: null,
  });
  const [checkins, setCheckins] = useState<DailyCheckin[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const loadStreakData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [streakData, checkinList] = await Promise.all([
        financeService.getStreakSummary(resolvedMemberId),
        financeService.getDailyCheckins(resolvedMemberId),
      ]);
      setStreak(streakData);
      setCheckins(checkinList);
    } catch (err) {
      console.error('Failed to load streak summary:', err);
    } finally {
      setIsLoading(false);
    }
  }, [resolvedMemberId]);

  useEffect(() => {
    loadStreakData();
  }, [loadStreakData]);

  // Handle 1-tap "No Spend Today" check-in
  const handleNoSpendCheckin = async () => {
    if (isSubmitting || streak.checkedInToday) return;

    try {
      setIsSubmitting(true);
      const today = getTodayDateString();
      const recorded = await financeService.recordDailyCheckin(
        resolvedMemberId,
        today,
        'no_spend'
      );

      // Audio celebration
      playChaChingSound();

      // Optimistic update
      setStreak((prev) => ({
        ...prev,
        checkedInToday: true,
        currentStreak: prev.currentStreak + 1,
        longestStreak: Math.max(prev.longestStreak, prev.currentStreak + 1),
        coupleStreak: prev.coupleStreak + 1,
        lastCheckinDate: today,
      }));

      setCheckins((prev) => {
        const filtered = prev.filter((c) => c.checkin_date !== today);
        return [...filtered, recorded];
      });

      // Fetch fresh verified state from service
      const [updatedStreak, updatedCheckins] = await Promise.all([
        financeService.getStreakSummary(resolvedMemberId),
        financeService.getDailyCheckins(resolvedMemberId),
      ]);
      if (updatedStreak && typeof updatedStreak === 'object') {
        setStreak((prev) => ({
          ...updatedStreak,
          checkedInToday: true,
          currentStreak: Math.max(prev.currentStreak, updatedStreak.currentStreak || 1),
          coupleStreak: Math.max(prev.coupleStreak, updatedStreak.coupleStreak || 1),
        }));
      }
      if (updatedCheckins && Array.isArray(updatedCheckins)) {
        setCheckins(updatedCheckins);
      }

      onCheckinSuccess?.();
    } catch (err) {
      console.error('Error recording no-spend check-in:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Generate 7-day mini calendar dots (6 days ago through today)
  const miniCalendarDays = useMemo<CalendarDayDot[]>(() => {
    const today = getTodayDateString();
    const days: CalendarDayDot[] = [];
    const checkinMap = new Map<string, DailyCheckin>();
    checkins.forEach((c) => {
      checkinMap.set(c.checkin_date, c);
    });

    for (let i = 6; i >= 0; i--) {
      const cursor = new Date(today + 'T12:00:00');
      cursor.setDate(cursor.getDate() - i);
      const isoDate = formatISODate(cursor);
      const isToday = isoDate === today;
      const checkinEntry = checkinMap.get(isoDate);
      const isCheckedIn = Boolean(checkinEntry) || (isToday && streak.checkedInToday);

      const dayLabel = cursor.toLocaleDateString('en-SG', { weekday: 'narrow' });
      const dayNum = cursor.getDate();

      days.push({
        isoDate,
        dayLabel,
        dayNum,
        isCheckedIn,
        isToday,
        checkinType: checkinEntry?.type,
      });
    }

    return days;
  }, [checkins, streak.checkedInToday]);

  return (
    <div
      data-testid="daily-checkin-streak-bar"
      className={`relative overflow-hidden rounded-2xl border-[1.5px] border-(--border-ink) bg-[#fffbeb] dark:bg-[#2b2413] p-4 sm:p-5 shadow-(--shadow-cute) transition-all ${className}`}
    >
      <div className="flex flex-col gap-4">
        {/* Top Header Row: Streak Counters & Action / Checked In status */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Streaks: Personal & Couple */}
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            {/* Personal Streak Badge */}
            <div
              data-testid="personal-streak-badge"
              className="inline-flex items-center gap-2 rounded-xl bg-[#ffe999] text-[#1a1a1a] border-[1.5px] border-(--border-ink) px-3.5 py-1.5 shadow-(--shadow-cute-sm)"
            >
              <Flame className="h-4 w-4 stroke-[2.5] text-[#b45309]" />
              <div className="flex items-baseline gap-1.5 font-display">
                <span className="text-sm font-black tracking-tight text-[#1a1a1a]">
                  {streak.currentStreak}-day streak
                </span>
                <span className="text-[10px] font-bold text-[#78350f] hidden xs:inline">
                  (Best: {streak.longestStreak}d)
                </span>
              </div>
            </div>

            {/* Couple Streak Badge */}
            <div
              data-testid="couple-streak-badge"
              title="Consecutive days where both Yi Jia and Rachel checked in!"
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#fcbffa] text-[#1a1a1a] border-[1.5px] border-(--border-ink) px-3 py-1.5 text-xs font-black shadow-(--shadow-cute-sm)"
            >
              <span className="text-sm">👩‍❤️‍👨</span>
              <span className="font-display">{streak.coupleStreak}-day couple streak</span>
              <Heart className="h-3 w-3 fill-[#1a1a1a] text-[#1a1a1a] ml-0.5" />
            </div>
          </div>

          {/* Today's Check-in Status / 1-Tap Check-in Button */}
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="flex items-center gap-1.5 text-xs font-bold text-(--text-muted)">
                <Loader2 className="h-4 w-4 animate-spin text-[#b45309]" />
                <span>Checking status...</span>
              </div>
            ) : streak.checkedInToday ? (
              <div
                data-testid="checked-in-today-status"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#bbf7d0] text-[#14532d] border-2 border-(--border-ink) px-3.5 py-1.5 text-xs sm:text-sm font-black shadow-(--shadow-cute-sm)"
              >
                <Check className="h-4 w-4 text-[#14532d] stroke-3" />
                <span>Checked in today!</span>
              </div>
            ) : (
              <button
                type="button"
                data-testid="no-spend-checkin-btn"
                onClick={handleNoSpendCheckin}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#dfc2ff] hover:bg-[#1a1a1a] hover:text-[#fbf7f1] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none px-4 py-2 text-xs sm:text-sm font-black transition-all cursor-pointer disabled:opacity-50 font-display"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin stroke-[2.5]" />
                    <span>Recording...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 stroke-[2.5]" />
                    <span>🎉 No Spend Today — Check In</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* 7-Day Mini Calendar Dots */}
        <div className="pt-2 border-t-[1.5px] border-(--border-ink)/20">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-bold text-(--text-muted) uppercase tracking-wider">
              Last 7 Days
            </span>
            <TooltipPopover
              title="Daily Check-In Streak"
              ariaLabel="Streak rules"
              align="left"
            >
              Log an expense or tap &ldquo;No Spend Today&rdquo; each day to keep your personal and couple streak alive!
            </TooltipPopover>
          </div>

          <div
            data-testid="streak-calendar-dots"
            className="mt-2.5 grid grid-cols-7 gap-1.5 sm:gap-2.5"
          >
            {miniCalendarDays.map((day, idx) => (
              <div
                key={day.isoDate}
                data-testid={`checkin-dot-${idx}`}
                title={`${day.isoDate}${day.isCheckedIn ? ' (Checked in)' : ' (Not checked in)'}${day.isToday ? ' - Today' : ''}`}
                className={`flex flex-col items-center justify-center p-1.5 rounded-xl border-[1.5px] transition-all ${
                  day.isToday
                    ? 'border-(--border-ink) bg-(--bg-card) shadow-(--shadow-cute-sm) font-black'
                    : 'border-transparent bg-(--bg-card)/50'
                }`}
              >
                <span className="text-[10px] font-bold text-(--text-muted)">
                  {day.dayLabel}
                </span>

                <div
                  className={`mt-1 flex h-6 w-6 sm:h-7 sm:w-7 items-center justify-center rounded-full text-xs font-black border transition-all ${
                    day.isCheckedIn
                      ? 'bg-[#dfc2ff] text-[#1a1a1a] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) scale-105'
                      : 'border-(--border-subtle) bg-(--bg-cream) text-(--text-muted)'
                  }`}
                >
                  {day.isCheckedIn ? (
                    <Check className="h-3.5 w-3.5 stroke-3" />
                  ) : (
                    <span>{day.dayNum}</span>
                  )}
                </div>

                <span className="mt-0.5 text-[9px] font-bold text-(--text-muted) font-mono-num">
                  {day.isToday ? 'Today' : `${day.dayNum}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default DailyCheckinStreakBar;
