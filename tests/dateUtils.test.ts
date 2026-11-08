import { describe, it, expect } from 'vitest';
import {
  getCurrentMonth,
  getTodayDateString,
  formatMonth,
  formatISODate,
  formatDisplayMonth,
  formatDisplayDate,
  addMonths,
  monthsBetween,
  formatTime12h,
  extractTimeFromISO,
  getDefaultStatementDueDate,
} from '../src/lib/dateUtils';

describe('dateUtils', () => {
  it('formats month and dates to standard format', () => {
    const d = new Date(2026, 8, 15); // Month 8 is September
    expect(formatMonth(d)).toBe('2026-09');
    expect(formatISODate(d)).toBe('2026-09-15');
  });

  it('formats month string into human-readable label', () => {
    expect(formatDisplayMonth('2026-09')).toBe('September 2026');
    expect(formatDisplayMonth('2027-01')).toBe('January 2027');
  });

  it('formats date string into human-readable label', () => {
    expect(formatDisplayDate('2026-09-15')).toMatch(/15 Sep(t)? 2026/);
  });

  it('adds months correctly for both month string and date string', () => {
    expect(addMonths('2026-09', 1)).toBe('2026-10');
    expect(addMonths('2026-09', 12)).toBe('2027-09');
    expect(addMonths('2026-09-01', 242)).toBe('2046-11-01');
    expect(addMonths('2026-09-01', 0)).toBe('2026-09-01');
  });

  it('calculates calendar months between dates', () => {
    expect(monthsBetween('2026-09-15', '2027-09-15')).toBe(12);
    expect(monthsBetween('2026-09-15', '2026-12-15')).toBe(3);
    expect(monthsBetween('2027-01-01', '2026-12-01')).toBe(-1);
    expect(monthsBetween('2026-09-15', '2026-09-01')).toBe(0);
  });

  it('returns valid current month and today string', () => {
    expect(getCurrentMonth()).toMatch(/^\d{4}-\d{2}$/);
    expect(getTodayDateString()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('formats time to 12-hour am/pm strings correctly', () => {
    expect(formatTime12h('14:30')).toBe('2:30 PM');
    expect(formatTime12h('14:30:00')).toBe('2:30 PM');
    expect(formatTime12h('09:05')).toBe('9:05 AM');
    expect(formatTime12h('00:00')).toBe('12:00 AM');
    expect(formatTime12h('12:00')).toBe('12:00 PM');
    expect(formatTime12h('23:59')).toBe('11:59 PM');
    expect(formatTime12h(null)).toBe('');
    expect(formatTime12h(undefined)).toBe('');
  });

  it('extracts time from ISO timestamp in Singapore context', () => {
    // 2026-10-29T06:30:00.000Z in UTC is 14:30:00 in UTC+8
    const isoUtc = '2026-10-29T06:30:00.000Z';
    expect(extractTimeFromISO(isoUtc)).toBe('14:30');
    expect(extractTimeFromISO('')).toBe('');
    expect(extractTimeFromISO(null)).toBe('');
  });

  describe('getDefaultStatementDueDate (Issue #34)', () => {
    it('preserves due day 31 when the target month has 31 days', () => {
      // Sep statement -> Oct due (31 days)
      expect(getDefaultStatementDueDate('2026-09', 31)).toBe('2026-10-31');
      // Nov statement -> Dec due (31 days)
      expect(getDefaultStatementDueDate('2026-11', 31)).toBe('2026-12-31');
      // Jun statement -> Jul due (31 days)
      expect(getDefaultStatementDueDate('2026-06', 31)).toBe('2026-07-31');
    });

    it('clamps due day 31 to 30 when the target month has 30 days', () => {
      // Oct statement -> Nov due (30 days)
      expect(getDefaultStatementDueDate('2026-10', 31)).toBe('2026-11-30');
      // Mar statement -> Apr due (30 days)
      expect(getDefaultStatementDueDate('2026-03', 31)).toBe('2026-04-30');
      // Aug statement -> Sep due (30 days)
      expect(getDefaultStatementDueDate('2026-08', 31)).toBe('2026-09-30');
      // Day 30 in a 30-day month remains 30
      expect(getDefaultStatementDueDate('2026-10', 30)).toBe('2026-11-30');
    });

    it('clamps due day 29-31 to 28 in non-leap year February', () => {
      // Jan 2026 statement -> Feb 2026 due (28 days)
      expect(getDefaultStatementDueDate('2026-01', 31)).toBe('2026-02-28');
      expect(getDefaultStatementDueDate('2026-01', 30)).toBe('2026-02-28');
      expect(getDefaultStatementDueDate('2026-01', 29)).toBe('2026-02-28');
      expect(getDefaultStatementDueDate('2026-01', 28)).toBe('2026-02-28');
    });

    it('clamps due day 30-31 to 29 in leap year February', () => {
      // Jan 2028 statement -> Feb 2028 due (leap year, 29 days)
      expect(getDefaultStatementDueDate('2028-01', 31)).toBe('2028-02-29');
      expect(getDefaultStatementDueDate('2028-01', 30)).toBe('2028-02-29');
      expect(getDefaultStatementDueDate('2028-01', 29)).toBe('2028-02-29');
    });

    it('preserves mid-month due days without clamping across all months', () => {
      expect(getDefaultStatementDueDate('2026-09', 15)).toBe('2026-10-15');
      expect(getDefaultStatementDueDate('2026-10', 15)).toBe('2026-11-15');
      expect(getDefaultStatementDueDate('2026-01', 15)).toBe('2026-02-15');
      expect(getDefaultStatementDueDate('2028-01', 15)).toBe('2028-02-15');
    });

    describe('cycle-aware defaults with billingDay (Issue #80)', () => {
      it('defaults to current month when due_day > billing_day (same cycle)', () => {
        // Statement day 5, due day 25 -> same month (2026-10-25)
        expect(getDefaultStatementDueDate('2026-10', 25, 5)).toBe('2026-10-25');
        // Statement day 1, due day 31 -> same month, clamped if necessary
        expect(getDefaultStatementDueDate('2026-10', 31, 1)).toBe('2026-10-31');
        expect(getDefaultStatementDueDate('2026-04', 31, 1)).toBe('2026-04-30');
        expect(getDefaultStatementDueDate('2026-02', 31, 1)).toBe('2026-02-28');
      });

      it('rolls to subsequent month when due_day <= billing_day (next cycle)', () => {
        // Statement day 25, due day 5 -> next month (2026-11-05)
        expect(getDefaultStatementDueDate('2026-10', 5, 25)).toBe('2026-11-05');
        // Statement day 20, due day 20 -> next month (2026-11-20)
        expect(getDefaultStatementDueDate('2026-10', 20, 20)).toBe('2026-11-20');
        // Statement day 31, due day 31 -> next month, clamped to 30 in Nov
        expect(getDefaultStatementDueDate('2026-10', 31, 31)).toBe('2026-11-30');
      });

      it('rolls to subsequent month when billing_day is omitted (backwards compatibility)', () => {
        expect(getDefaultStatementDueDate('2026-10', 25)).toBe('2026-11-25');
        expect(getDefaultStatementDueDate('2026-10', 5)).toBe('2026-11-05');
      });
    });
  });
});
