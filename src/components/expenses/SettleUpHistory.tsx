import { useState } from "react";
import { m, AnimatePresence } from "motion/react";
import { ChevronDown, History } from "lucide-react";
import { Card } from "../ui/Card";
import { CurrencyText } from "../ui/CurrencyText";
import { TruncatedText } from "../ui/TruncatedText";
import { formatDisplayDate } from "../../lib/dateUtils";
import { collapse } from "../../lib/motion";
import type { HouseholdMember, SettleUp } from "../../types/finance";

interface SettleUpHistoryProps {
    settleUps: SettleUp[];
    members: HouseholdMember[];
}

/** Collapsible list of past settle-ups. Renders nothing until there is one. */
export function SettleUpHistory({ settleUps, members }: SettleUpHistoryProps) {
    const [isOpen, setIsOpen] = useState<boolean>(false);

    if (settleUps.length === 0) return null;

    const nameOf = (id: string) =>
        members.find((mem) => mem.id === id)?.display_name ?? "Someone";

    return (
        <Card variant="white" padding="sm">
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                aria-expanded={isOpen}
                className="flex min-h-11 w-full items-center gap-2 text-left"
            >
                <History
                    className="h-4 w-4 shrink-0 text-(--text-muted)"
                    strokeWidth={2.5}
                />
                <span className="min-w-0 flex-1 text-sm font-bold text-(--text-primary)">
                    History
                </span>
                <span className="shrink-0 text-xs font-semibold text-(--text-muted)">
                    {settleUps.length}
                </span>
                <ChevronDown
                    className={`h-4 w-4 shrink-0 text-(--text-muted) transition-transform ${
                        isOpen ? "rotate-180" : ""
                    }`}
                    strokeWidth={2.5}
                />
            </button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <m.ul
                        {...collapse}
                        className="mt-1 divide-y divide-(--border-subtle)"
                    >
                        {settleUps.map((s) => (
                            <li
                                key={s.id}
                                className="flex min-h-11 items-center gap-3 py-2"
                            >
                                <div className="min-w-0 flex-1">
                                    <TruncatedText
                                        as="div"
                                        text={`${nameOf(s.payer_id)} → ${nameOf(s.payee_id)}`}
                                        className="text-sm font-semibold text-(--text-primary)"
                                    />
                                    <p className="text-xs text-(--text-muted)">
                                        {formatDisplayDate(s.settled_on)} ·{" "}
                                        {s.expense_ids.length}{" "}
                                        {s.expense_ids.length === 1
                                            ? "expense"
                                            : "expenses"}
                                    </p>
                                </div>
                                <CurrencyText
                                    amount={s.amount}
                                    className="shrink-0 text-sm font-bold"
                                />
                            </li>
                        ))}
                    </m.ul>
                )}
            </AnimatePresence>
        </Card>
    );
}

export default SettleUpHistory;
