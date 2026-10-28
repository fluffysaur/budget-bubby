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
});
