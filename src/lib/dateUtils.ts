/**
 * Date and Month calculation utilities for Singapore time context (UTC+8).
 * Supports standard month format ('YYYY-MM') and ISO date strings ('YYYY-MM-DD').
 */

export const MONTH_NAMES_SHORT = [
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
] as const;

export const MONTH_NAMES_FULL = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
] as const;

/** Canonical alias for short month names */
export const MONTH_NAMES = MONTH_NAMES_SHORT;

/**
 * Returns current date in Singapore context.
 */
export function getSingaporeDate(): Date {
    const now = new Date();
    // Adjust to Singapore time zone (UTC+8)
    const sgTimeString = now.toLocaleString("en-US", {
        timeZone: "Asia/Singapore",
    });
    return new Date(sgTimeString);
}

const sgtMonthFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
});

/** 'YYYY-MM' in Asia/Singapore for an ISO timestamp. */
export function toSingaporeMonth(iso: string): string {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso.slice(0, 7);
    return sgtMonthFormatter.format(date);
}

/**
 * Returns current month string in 'YYYY-MM' format.
 */
export function getCurrentMonth(): string {
    const d = getSingaporeDate();
    return formatMonth(d);
}

const SINGAPORE_UTC_OFFSET_MS = 8 * 60 * 60 * 1000;

/**
 * Returns milliseconds from `now` until the start of the next calendar month
 * in Singapore time (UTC+8, no DST).
 */
export function msUntilNextMonth(now: Date = new Date()): number {
    const sg = new Date(now.getTime() + SINGAPORE_UTC_OFFSET_MS);
    const nextMonthStartUtc =
        Date.UTC(sg.getUTCFullYear(), sg.getUTCMonth() + 1, 1) -
        SINGAPORE_UTC_OFFSET_MS;
    return nextMonthStartUtc - now.getTime();
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
    if (typeof dateOrString === "string") {
        // If already YYYY-MM or YYYY-MM-DD
        const match = dateOrString.match(/^(\d{4})-(\d{2})/);
        if (match) {
            return `${match[1]}-${match[2]}`;
        }
        const parsed = new Date(dateOrString);
        if (!isNaN(parsed.getTime())) {
            const y = parsed.getFullYear();
            const m = String(parsed.getMonth() + 1).padStart(2, "0");
            return `${y}-${m}`;
        }
        return dateOrString;
    }

    const y = dateOrString.getFullYear();
    const m = String(dateOrString.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
}

/**
 * Formats a Date object into 'YYYY-MM-DD'.
 */
export function formatISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

/**
 * Formats 'YYYY-MM' into human readable string e.g. 'September 2026'.
 */
export function formatDisplayMonth(monthStr: string): string {
    const parts = monthStr.split("-");
    if (parts.length < 2) return monthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = new Date(year, month, 1);
    return date.toLocaleDateString("en-SG", { month: "long", year: "numeric" });
}

/**
 * Formats 'YYYY-MM' into compact string e.g. 'Sep 2026'.
 */
export function formatShortMonth(monthStr: string): string {
    const parts = monthStr.split("-");
    if (parts.length < 2) return monthStr;
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const date = new Date(year, month, 1);
    return date.toLocaleDateString("en-SG", {
        month: "short",
        year: "numeric",
    });
}

/**
 * Formats 'YYYY-MM-DD' into human readable string e.g. '15 Sep 2026'.
 */
export function formatDisplayDate(dateStr: string): string {
    const parts = dateStr.split("-");
    if (parts.length >= 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2].slice(0, 2), 10);
        const date = new Date(year, month, day);
        return date.toLocaleDateString("en-SG", {
            day: "numeric",
            month: "short",
            year: "numeric",
        });
    }
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("en-SG", {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
}

/**
 * Adds (or subtracts) a number of months to a 'YYYY-MM' or 'YYYY-MM-DD' date string.
 * Preserves day if provided in input, clamping it to the target month's length.
 */
export function addMonths(dateStr: string | Date, count: number): string {
    if (dateStr instanceof Date) {
        const firstOfTarget = new Date(
            dateStr.getFullYear(),
            dateStr.getMonth() + count,
            1,
        );
        const targetYear = firstOfTarget.getFullYear();
        const targetMonth = firstOfTarget.getMonth() + 1;
        const clampedDay = clampDueDay(
            dateStr.getDate(),
            targetYear,
            targetMonth,
        );
        return formatISODate(new Date(targetYear, targetMonth - 1, clampedDay));
    }

    const isFullDate = /^\d{4}-\d{2}-\d{2}/.test(dateStr);
    const parts = dateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexed
    const day = isFullDate ? parseInt(parts[2].slice(0, 2), 10) : 1;

    const firstOfTarget = new Date(year, month + count, 1);
    const targetYear = firstOfTarget.getFullYear();
    const targetMonth = firstOfTarget.getMonth() + 1;

    if (isFullDate) {
        const clampedDay = clampDueDay(day, targetYear, targetMonth);
        return formatISODate(new Date(targetYear, targetMonth - 1, clampedDay));
    } else {
        return formatMonth(firstOfTarget);
    }
}

/**
 * Calculates number of calendar months between two dates.
 * Returns positive if endDate is later than startDate.
 */
export function monthsBetween(
    startDate: string | Date,
    endDate: string | Date,
): number {
    const parseYearMonth = (input: string | Date) => {
        if (input instanceof Date) {
            return { year: input.getFullYear(), month: input.getMonth() };
        }
        const parts = input.split("-");
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        return { year, month };
    };

    const d1 = parseYearMonth(startDate);
    const d2 = parseYearMonth(endDate);

    return (d2.year - d1.year) * 12 + (d2.month - d1.month);
}

/**
 * Returns a chronological list of 'YYYY-MM' strings for the past `count` months ending at `endMonth`.
 */
export function getPastMonthsList(
    endMonth: string,
    count: number = 6,
): string[] {
    const list: string[] = [];
    for (let i = count - 1; i >= 0; i--) {
        list.push(addMonths(endMonth, -i));
    }
    return list;
}

/**
 * Returns the current time in Singapore (UTC+8) in 'HH:mm' 24-hour format.
 */
export function getCurrentSingaporeTime(): string {
    const d = getSingaporeDate();
    const h = String(d.getHours()).padStart(2, "0");
    const m = String(d.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

/**
 * Formats a 24-hour time string ('HH:mm' or 'HH:mm:ss') to 12-hour format e.g. '2:30 PM'.
 */
export function formatTime12h(timeStr?: string | null): string {
    if (!timeStr) return "";
    const match = timeStr.match(/^(\d{1,2}):(\d{2})/);
    if (!match) return timeStr;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const ampm = hours >= 12 ? "PM" : "AM";
    hours = hours % 12;
    hours = hours ? hours : 12; // 0 becomes 12
    return `${hours}:${minutes} ${ampm}`;
}

/**
 * Extracts 'HH:mm' in Singapore time from an ISO timestamp (e.g. created_at).
 */
export function extractTimeFromISO(isoString?: string | null): string {
    if (!isoString) return "";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";
    const sgTimeString = date.toLocaleString("en-US", {
        timeZone: "Asia/Singapore",
    });
    const sgDate = new Date(sgTimeString);
    const h = String(sgDate.getHours()).padStart(2, "0");
    const m = String(sgDate.getMinutes()).padStart(2, "0");
    return `${h}:${m}`;
}

/**
 * Returns the number of days in a calendar month (month is 1-12).
 */
export function getDaysInMonth(year: number, month: number): number {
    return new Date(year, month, 0).getDate();
}

/**
 * Clamps a 1-31 due day to the last day of the given month (month is 1-12).
 * e.g. due day 31 in November -> 30, in February 2028 (leap) -> 29.
 */
export function clampDueDay(
    dueDay: number,
    year: number,
    month: number,
): number {
    const safeDay = Math.max(1, Math.floor(dueDay) || 1);
    return Math.min(safeDay, getDaysInMonth(year, month));
}

/**
 * Calculates the default statement due date: the subsequent month on the card's due_day,
 * clamped to the actual length of that target month (e.g. 31 in Oct/Dec, 30 in Nov/Apr, 28/29 in Feb).
 */
export function getDefaultStatementDueDate(
    statementMonth: string,
    dueDay: number,
): string {
    const nextMonthStr = addMonths(statementMonth, 1);
    const [yearStr, monthStr] = nextMonthStr.split("-");
    const year = Number(yearStr);
    const month = Number(monthStr);
    const day = clampDueDay(dueDay, year, month);
    return `${nextMonthStr}-${String(day).padStart(2, "0")}`;
}

export interface DueSchedule {
    frequency: "monthly" | "annually";
    due_day?: number | null;
    payment_month?: number | null; // 1 - 12, annual items only
}

function startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dueDateIn(year: number, month: number, dueDay: number): Date {
    return new Date(year, month - 1, clampDueDay(dueDay, year, month));
}

/**
 * Returns the next due date (on or after `referenceDate`, by calendar day)
 * for a monthly or annual schedule, clamping the due day to short months.
 * Returns null for annual schedules without a payment month.
 */
export function getNextDueDate(
    schedule: DueSchedule,
    referenceDate: Date = getSingaporeDate(),
): Date | null {
    const today = startOfDay(referenceDate);
    const dueDay = schedule.due_day ?? 1;
    const year = today.getFullYear();

    if (schedule.frequency === "monthly") {
        const month = today.getMonth() + 1;
        const thisMonth = dueDateIn(year, month, dueDay);
        if (thisMonth >= today) return thisMonth;
        return month === 12
            ? dueDateIn(year + 1, 1, dueDay)
            : dueDateIn(year, month + 1, dueDay);
    }

    const paymentMonth = schedule.payment_month;
    if (!paymentMonth || paymentMonth < 1 || paymentMonth > 12) return null;
    const thisYear = dueDateIn(year, paymentMonth, dueDay);
    if (thisYear >= today) return thisYear;
    return dueDateIn(year + 1, paymentMonth, dueDay);
}

/**
 * Whole calendar days from `referenceDate` until the next due date (0 = due today).
 */
export function getDaysUntilDue(
    schedule: DueSchedule,
    referenceDate: Date = getSingaporeDate(),
): number | null {
    const next = getNextDueDate(schedule, referenceDate);
    if (!next) return null;
    const today = startOfDay(referenceDate);
    return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/**
 * Short label for days until due: "Due today", "Due tomorrow", "Due in 5 days".
 */
export function formatDueInDays(days: number): string {
    if (days <= 0) return "Due today";
    if (days === 1) return "Due tomorrow";
    return `Due in ${days} days`;
}

/**
 * Formats an integer with its English ordinal suffix (e.g. 1 -> "1st", 2 -> "2nd",
 * 3 -> "3rd", 4 -> "4th", 11 -> "11th", 12 -> "12th", 13 -> "13th", 21 -> "21st",
 * 22 -> "22nd", 23 -> "23rd", 31 -> "31st").
 */
export function ordinal(n: number): string {
    const int = Math.trunc(n);
    const abs = Math.abs(int);
    const mod100 = abs % 100;
    if (mod100 >= 11 && mod100 <= 13) {
        return `${int}th`;
    }
    switch (abs % 10) {
        case 1:
            return `${int}st`;
        case 2:
            return `${int}nd`;
        case 3:
            return `${int}rd`;
        default:
            return `${int}th`;
    }
}
