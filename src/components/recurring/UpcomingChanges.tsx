/**
 * UpcomingChanges: recurring items that start or end after today, soonest
 * first. Hidden when there are none.
 */

import { CalendarClock } from "lucide-react";
import { formatSGD } from "../../lib/currency";
import { formatShortMonth } from "../../lib/dateUtils";
import type { UpcomingChange } from "../../lib/recurringUpcoming";
import { Card, CurrencyText, TruncatedText } from "../ui";

export function UpcomingChanges({ changes }: { changes: UpcomingChange[] }) {
    if (changes.length === 0) return null;
    return (
        <Card variant="white" padding="md">
            <h3 className="mb-2 font-display text-base font-black text-(--text-ink)">
                Upcoming Changes
            </h3>
            <ul aria-label="Upcoming changes" className="space-y-1.5">
                {changes.map((c) => (
                    <li
                        key={c.id}
                        className="flex min-h-11 items-center gap-2 rounded-xl bg-(--bg-cream) px-3 py-1.5"
                    >
                        <CalendarClock
                            aria-hidden="true"
                            className="h-4 w-4 shrink-0 text-(--text-muted)"
                            strokeWidth={2.5}
                        />
                        <span className="flex min-w-0 flex-1 flex-col">
                            <TruncatedText
                                text={c.name}
                                className="text-xs font-bold text-(--text-ink)"
                            />
                            <span className="text-[11px] text-(--text-muted)">
                                {c.kind === "starts" ? "starts" : "ends"}{" "}
                                {formatShortMonth(c.month)}
                            </span>
                        </span>
                        <span
                            className={`shrink-0 font-mono-num text-xs font-bold ${
                                c.monthlyDelta < 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-700 dark:text-emerald-400"
                            }`}
                        >
                            {c.monthlyDelta < 0 ? "−" : "+"}
                            <CurrencyText
                                formatted={formatSGD(Math.abs(c.monthlyDelta))}
                            />
                            /mo
                        </span>
                    </li>
                ))}
            </ul>
        </Card>
    );
}

export default UpcomingChanges;
