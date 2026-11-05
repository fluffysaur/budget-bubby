/**
 * Pure SGT calendar helpers for 'YYYY-MM-DD' strings.
 * Singapore is UTC+8 with no DST, so plain UTC arithmetic is exact.
 */

const SGT_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** SGT calendar date for an instant. */
export function toSgtDateString(instant: Date = new Date()): string {
    return new Date(instant.getTime() + SGT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Minutes since SGT midnight for an instant. */
export function sgtMinutesOfDay(instant: Date = new Date()): number {
    const sg = new Date(instant.getTime() + SGT_OFFSET_MS);
    return sg.getUTCHours() * 60 + sg.getUTCMinutes();
}

function toUtcMs(iso: string): number {
    const [y, m, d] = iso.split("-").map(Number);
    return Date.UTC(y, (m || 1) - 1, d || 1);
}

export function addDays(iso: string, days: number): string {
    return new Date(toUtcMs(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (positive when `to` is later). */
export function daysBetween(from: string, to: string): number {
    return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS);
}

/** 0 = Sunday ... 6 = Saturday. */
export function weekdayOf(iso: string): number {
    return new Date(toUtcMs(iso)).getUTCDay();
}

/** Monday of the week containing `iso` (weeks run Mon-Sun). */
export function mondayOf(iso: string): string {
    const offset = (weekdayOf(iso) + 6) % 7;
    return addDays(iso, -offset);
}

export function daysInMonthOf(iso: string): number {
    const [y, m] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** "HH:MM" -> minutes, or null when malformed. */
export function timeToMinutes(value: string | null | undefined): number | null {
    if (!value) return null;
    const match = /^(\d{1,2}):(\d{2})/.exec(value);
    if (!match) return null;
    return Number(match[1]) * 60 + Number(match[2]);
}
