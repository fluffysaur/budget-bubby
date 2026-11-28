/**
 * UpcomingChanges: recurring items that start or end after today, soonest
 * first. Hidden when there are none. Each row shows its type icon, and
 * deductions (tax, insurance) are labelled as such.
 */

import { formatSGD } from "../../lib/currency";
import { formatShortMonth } from "../../lib/dateUtils";
import {
    isDeductionType,
    RECURRING_TYPE_ICONS,
} from "../../lib/recurringItems";
import type { UpcomingChange } from "../../lib/recurringUpcoming";
import { Card, CurrencyText, MetaList, TruncatedText } from "../ui";

export function UpcomingChanges({ changes }: { changes: UpcomingChange[] }) {
    if (changes.length === 0) return null;
    return (
        <Card variant="white" padding="md">
            <h3 className="mb-2 font-display text-base font-black text-(--text-ink)">
                Upcoming Changes
            </h3>
            <ul aria-label="Upcoming changes" className="space-y-1.5">
                {changes.map((c) => {
                    const Icon = RECURRING_TYPE_ICONS[c.type];
                    return (
                        <li
                            key={c.id}
                            className="flex min-h-11 items-center gap-2 rounded-xl bg-(--bg-cream) px-3 py-1.5"
                        >
                            <Icon
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-(--text-muted)"
                                strokeWidth={2.5}
                            />
                            <span className="flex min-w-0 flex-1 flex-col">
                                <TruncatedText
                                    text={c.name}
                                    className="text-xs font-bold text-(--text-ink)"
                                />
                                <MetaList
                                    className="text-[11px] text-(--text-muted)"
                                    items={[
                                        `${c.kind === "starts" ? "starts" : "ends"} ${formatShortMonth(c.month)}`,
                                        isDeductionType(c.type) && "deduction",
                                    ]}
                                />
                            </span>
                            {/* A tax year ending is replaced by the next one,
                                so it isn't shown as a saving. */}
                            {!(c.type === "tax" && c.kind === "ends") && (
                                <span
                                    className={`shrink-0 font-mono-num text-xs font-bold ${
                                        c.monthlyDelta < 0
                                            ? "text-rose-600 dark:text-rose-400"
                                            : "text-emerald-700 dark:text-emerald-400"
                                    }`}
                                >
                                    {c.monthlyDelta < 0 ? "−" : "+"}
                                    <CurrencyText
                                        formatted={formatSGD(
                                            Math.abs(c.monthlyDelta),
                                        )}
                                    />
                                    /mo
                                </span>
                            )}
                        </li>
                    );
                })}
            </ul>
        </Card>
    );
}

export default UpcomingChanges;
