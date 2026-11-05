/** Singapore-time date and time parts of an instant. Pure. */

const SGT_PARTS = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Singapore",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
});

export interface SgtDateTime {
    /** "YYYY-MM-DD" */
    date: string;
    /** "HH:MM" */
    time: string;
}

/** Returns null for an unparseable input. */
export function toSgtDateTime(value: string | Date): SgtDateTime | null {
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) return null;
    const parts: Record<string, string> = {};
    for (const p of SGT_PARTS.formatToParts(d)) parts[p.type] = p.value;
    return {
        date: `${parts.year}-${parts.month}-${parts.day}`,
        time: `${parts.hour}:${parts.minute}`,
    };
}

/** "YYYY-MM-DD" shifted by whole days. */
export function shiftIsoDate(date: string, days: number): string {
    const d = new Date(`${date}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}
