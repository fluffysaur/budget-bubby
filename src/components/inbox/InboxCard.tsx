/**
 * One inbox item on the triage stack: merchant, card and time header,
 * duplicate/rate hints, and inline ExpenseFormFields. Swipe handlers come from
 * useSwipeCard; every action also has a button on the page.
 */

import type { Ref } from "react";
import { Card } from "../ui/Card";
import { CurrencyText } from "../ui/CurrencyText";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { TruncatedText } from "../ui/TruncatedText";
import { formatDisplayDate } from "../../lib/dateUtils";
import { toSgtDateTime } from "../../lib/capture/sgTime";
import type { ExpenseFormDraft } from "../../lib/expenseFormDraft";
import type {
    Category,
    Expense,
    HouseholdMember,
    InboxItem,
    SavingsGoal,
} from "../../types/finance";
import { ExpenseFormFields } from "../expenses/ExpenseFormFields";

export interface InboxCardProps {
    item: InboxItem;
    payerName?: string;
    /** Shown when the item belongs to the partner. */
    isPartnerItem: boolean;
    needsRateCheck: boolean;
    draft: ExpenseFormDraft;
    onDraftChange: (patch: Partial<ExpenseFormDraft>) => void;
    allCategories: Category[];
    initialShowMoreCategories?: boolean;
    members: HouseholdMember[];
    goals: SavingsGoal[];
    duplicate?: Expense;
    onSameOne: () => void;
    todayDate: string;
    cardRef?: Ref<HTMLDivElement>;
    confirmTintRef?: Ref<HTMLDivElement>;
    discardTintRef?: Ref<HTMLDivElement>;
    swipeHandlers?: React.HTMLAttributes<HTMLDivElement>;
}

export function InboxCard({
    item,
    payerName,
    isPartnerItem,
    needsRateCheck,
    draft,
    onDraftChange,
    allCategories,
    initialShowMoreCategories = false,
    members,
    goals,
    duplicate,
    onSameOne,
    todayDate,
    cardRef,
    confirmTintRef,
    discardTintRef,
    swipeHandlers,
}: InboxCardProps) {
    const sgt = toSgtDateTime(item.captured_at);
    const dayLabel = sgt
        ? sgt.date === todayDate
            ? "Today"
            : formatDisplayDate(sgt.date)
        : "";

    return (
        <div
            ref={cardRef}
            {...swipeHandlers}
            data-testid="inbox-card"
            className="relative touch-pan-y select-none will-change-transform"
        >
            <Card
                elevation="tactile"
                padding="md"
                className="relative overflow-hidden"
            >
                {/* Swipe tints */}
                <div
                    ref={confirmTintRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-start bg-(--pastel-mint-light) pl-5 opacity-0"
                >
                    <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">
                        Confirm
                    </span>
                </div>
                <div
                    ref={discardTintRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-end bg-(--pastel-coral-light) pr-5 opacity-0"
                >
                    <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">
                        Discard
                    </span>
                </div>

                <div className="relative space-y-3">
                    <div>
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                <TruncatedText
                                    text={item.merchant}
                                    as="div"
                                    className="font-display text-base font-black text-(--text-ink)"
                                />
                            </div>
                            {isPartnerItem && payerName && (
                                <Badge
                                    variant="lilac"
                                    size="sm"
                                    className="shrink-0"
                                >
                                    {payerName}
                                </Badge>
                            )}
                            <span className="shrink-0 text-xs font-bold text-(--text-muted) font-mono-num">
                                {sgt?.time}
                            </span>
                        </div>

                        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            {item.card_name && (
                                <TruncatedText
                                    text={item.card_name}
                                    className="min-w-0"
                                />
                            )}
                            {item.card_name && (
                                <span className="shrink-0">·</span>
                            )}
                            <span className="shrink-0">{dayLabel}</span>
                        </div>
                    </div>

                    {duplicate && (
                        <Alert
                            variant="warning"
                            title="Looks logged already"
                            action={
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={onSameOne}
                                >
                                    Same One
                                </Button>
                            }
                        >
                            <CurrencyText amount={duplicate.amount} /> on{" "}
                            {formatDisplayDate(duplicate.date)}.
                        </Alert>
                    )}

                    {needsRateCheck && (
                        <Alert variant="info" title="Check rate">
                            Set the exchange rate in More to confirm.
                        </Alert>
                    )}

                    <ExpenseFormFields
                        draft={draft}
                        onChange={onDraftChange}
                        categories={allCategories}
                        members={members}
                        goals={goals}
                        idPrefix="inbox-expense"
                        initialShowMoreCategories={initialShowMoreCategories}
                        resetKey={item.id}
                    />
                </div>
            </Card>
        </div>
    );
}

export function InboxCardSkeleton() {
    return (
        <Card
            elevation="tactile"
            padding="md"
            className="motion-safe:animate-pulse"
            aria-label="Loading inbox"
        >
            <div className="space-y-4">
                <div className="h-4 w-24 bg-(--border-subtle)/70 rounded-md" />
                <div className="h-6 w-44 bg-(--border-subtle)/80 rounded-lg" />
                <div className="space-y-1">
                    <div className="h-8 w-32 bg-(--border-subtle)/90 rounded-lg" />
                    <div className="h-3.5 w-36 bg-(--border-subtle)/50 rounded-md" />
                </div>
                <div className="flex gap-2">
                    <div className="h-9 w-24 bg-(--border-subtle)/60 rounded-xl" />
                    <div className="h-9 w-24 bg-(--border-subtle)/60 rounded-xl" />
                    <div className="h-9 w-20 bg-(--border-subtle)/60 rounded-xl" />
                </div>
                <div className="h-9 w-40 bg-(--border-subtle)/50 rounded-xl" />
            </div>
        </Card>
    );
}

export default InboxCard;
