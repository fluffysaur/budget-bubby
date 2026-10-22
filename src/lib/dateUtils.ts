/**
 * Date and Month calculation utilities for Singapore time context (UTC+8).
 * Supports standard month format ('YYYY-MM') and ISO date strings ('YYYY-MM-DD').
 */

/**
 * Returns current date in Singapore context.
 */
export function getSingaporeDate(): Date {
  const now = new Date();
  // Adjust to Singapore time zone (UTC+8)
  const sgTimeString = now.toLocaleString('en-US', { timeZone: 'Asia/Singapore' });
  return new Date(sgTimeString);
}

/**
 * Returns current month string in 'YYYY-MM' format.
 */
export function getCurrentMonth(): string {
  const d = getSingaporeDate();
  return formatMonth(d);
}

/**
 * Returns today's date in 'YYYY-MM-DD' format.
 */
export function getTodayDateString(): string {
  const d = getSingaporeDate();
  return formatISODate(d);
}

/**
 * Formats a Date object or string into 'YYYY-MM'.
 */
export function formatMonth(dateOrString: Date | string): string {
  if (typeof dateOrString === 'string') {
    // If already YYYY-MM or YYYY-MM-DD
    const match = dateOrString.match(/^(\d{4})-(\d{2})/);
    if (match) {
      return `${match[1]}-${match[2]}`;
    }
    const parsed = new Date(dateOrString);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      return `${y}-${m}`;
    }
    return dateOrString;
  }

  const y = dateOrString.getFullYear();
  const m = String(dateOrString.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Formats a Date object into 'YYYY-MM-DD'.
 */
export function formatISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Formats 'YYYY-MM' into human readable string e.g. 'September 2026'.
 */
export function formatDisplayMonth(monthStr: string): string {
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' });
}

/**
 * Formats 'YYYY-MM' into compact string e.g. 'Sep 2026'.
 */
export function formatShortMonth(monthStr: string): string {
  const parts = monthStr.split('-');
  if (parts.length < 2) return monthStr;
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const date = new Date(year, month, 1);
  return date.toLocaleDateString('en-SG', { month: 'short', year: 'numeric' });
}

/**
 * Formats 'YYYY-MM-DD' into human readable string e.g. '15 Sep 2026'.
 */
export function formatDisplayDate(dateStr: string): string {
  const parts = dateStr.split('-');
  if (parts.length >= 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2].slice(0, 2), 10);
    const date = new Date(year, month, day);
    return date.toLocaleDateString('en-SG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Adds (or subtracts) a number of months to a 'YYYY-MM' or 'YYYY-MM-DD' date string.
 * Preserves day if provided in input.
 */
export function addMonths(dateStr: string | Date, count: number): string {
  if (dateStr instanceof Date) {
    const d = new Date(dateStr);
    d.setMonth(d.getMonth() + count);
    return formatISODate(d);
  }

  const isFullDate = /^\d{4}-\d{2}-\d{2}/.test(dateStr);
  const parts = dateStr.split('-');
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // 0-indexed
  const day = isFullDate ? parseInt(parts[2].slice(0, 2), 10) : 1;

  const targetDate = new Date(year, month + count, day);

  if (isFullDate) {
    return formatISODate(targetDate);
  } else {
    return formatMonth(targetDate);
  }
}

/**
 * Calculates number of calendar months between two dates.
 * Returns positive if endDate is later than startDate.
 */
export function monthsBetween(startDate: string | Date, endDate: string | Date): number {
  const parseYearMonth = (input: string | Date) => {
    if (input instanceof Date) {
      return { year: input.getFullYear(), month: input.getMonth() };
    }
    const parts = input.split('-');
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    return { year, month };
  };

  const d1 = parseYearMonth(startDate);
  const d2 = parseYearMonth(endDate);

  return (d2.year - d1.year) * 12 + (d2.month - d1.month);
}
