/**
 * One inbox item on the triage stack: merchant, amount, card and time, a
 * duplicate hint, category chips and Mine | Shared. Swipe handlers come from
 * useSwipeCard; every action also has a button on the page.
 */

import type { Ref } from "react";
import { Card } from "../ui/Card";
import { CurrencyText } from "../ui/CurrencyText";
import { CategoryBadge } from "../ui/CategoryBadge";
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { Select } from "../ui/Select";
import { Alert } from "../ui/Alert";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { TruncatedText } from "../ui/TruncatedText";
import { formatForeignAmount } from "../../lib/currencyConverter";
import { formatDisplayDate } from "../../lib/dateUtils";
import { toSgtDateTime } from "../../lib/capture/sgTime";
import type { Category, Expense, InboxItem } from "../../types/finance";

type Split = "mine" | "shared";

export interface InboxCardProps {
    item: InboxItem;
    payerName?: string;
    /** Shown when the item belongs to the partner. */
    isPartnerItem: boolean;
    amountSgd: number;
    canConfirm: boolean;
    chipCategories: Category[];
    allCategories: Category[];
    selectedCategoryId: string | null;
    onSelectCategory: (id: string) => void;
    isShared: boolean;
    onShareChange: (shared: boolean) => void;
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
    amountSgd,
    canConfirm,
    chipCategories,
    allCategories,
    selectedCategoryId,
    onSelectCategory,
    isShared,
    onShareChange,
    duplicate,
    onSameOne,
    todayDate,
    cardRef,
    confirmTintRef,
    discardTintRef,
    swipeHandlers,
}: InboxCardProps) {
    const sgt = toSgtDateTime(item.captured_at);
    const dayLabel = sgt ? (sgt.date === todayDate ? "Today" : formatDisplayDate(sgt.date)) : "";
    const isForeign = item.currency !== "SGD";
    const chipIds = new Set(chipCategories.map((c) => c.id));
    const moreOptions = allCategories
        .filter((c) => !chipIds.has(c.id))
        .map((c) => ({ value: c.id, label: c.name }));

    return (
        <div
            ref={cardRef}
            {...swipeHandlers}
            data-testid="inbox-card"
            className="relative touch-pan-y select-none will-change-transform"
        >
            <Card elevation="tactile" padding="md" className="relative overflow-hidden">
                {/* Swipe tints */}
                <div
                    ref={confirmTintRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-start bg-(--pastel-mint-light) pl-5 opacity-0"
                >
                    <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">Confirm</span>
                </div>
                <div
                    ref={discardTintRef}
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 flex items-center justify-end bg-(--pastel-coral-light) pr-5 opacity-0"
                >
                    <span className="text-xs font-black uppercase tracking-wider text-(--text-ink)">Discard</span>
                </div>

                <div className="relative space-y-3">
                    <div className="flex items-start gap-2">
                        <div className="min-w-0 flex-1">
                            <TruncatedText
                                text={item.merchant}
                                as="div"
                                className="text-base font-black text-(--text-ink) font-display"
                            />
                        </div>
                        {isPartnerItem && payerName && (
                            <Badge variant="lilac" size="sm" className="shrink-0">
                                {payerName}
                            </Badge>
                        )}
                        <span className="shrink-0 text-xs font-bold text-(--text-muted) font-mono-num">
                            {sgt?.time}
                        </span>
                    </div>

                    <div>
                        {isForeign ? (
                            <div className="flex flex-wrap items-baseline gap-2">
                                <span className="text-2xl font-black font-display tracking-tight text-(--text-ink)">
                                    {formatForeignAmount(item.amount, item.currency)}
                                </span>
                                {canConfirm && (
                                    <span className="text-xs font-bold text-(--text-muted)">
                                        ≈ <CurrencyText amount={amountSgd} />
                                    </span>
                                )}
                            </div>
                        ) : (
                            <CurrencyText
                                amount={item.amount}
                                className="text-2xl font-black font-display tracking-tight text-(--text-ink)"
                            />
                        )}
                        <div className="mt-0.5 flex min-w-0 items-center gap-1 text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                            {item.card_name && <TruncatedText text={item.card_name} className="min-w-0" />}
                            {item.card_name && <span className="shrink-0">·</span>}
                            <span className="shrink-0">{dayLabel}</span>
                        </div>
                    </div>

                    {duplicate && (
                        <Alert
                            variant="warning"
                            title="Looks logged already"
                            action={
                                <Button type="button" variant="secondary" size="sm" onClick={onSameOne}>
                                    Same One
                                </Button>
                            }
                        >
                            <CurrencyText amount={duplicate.amount} /> on {formatDisplayDate(duplicate.date)}.
                        </Alert>
                    )}

                    {!canConfirm && (
                        <Alert variant="info" title="Check rate">
                            Edit to set the SGD amount.
                        </Alert>
                    )}

                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Category">
                        {chipCategories.map((c, idx) => {
                            const selected = c.id === selectedCategoryId;
                            return (
                                <button
                                    key={c.id}
                                    type="button"
                                    aria-pressed={selected}
                                    aria-label={`${c.name} (${idx + 1})`}
                                    onClick={() => onSelectCategory(c.id)}
                                    className={`flex min-h-10 items-center rounded-xl border-2 px-1.5 transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
                                        selected
                                            ? "border-(--border-ink) bg-(--pastel-lilac-light) shadow-(--shadow-cute-sm)"
                                            : "border-transparent hover:bg-(--bg-cream)"
                                    }`}
                                >
                                    <CategoryBadge name={c.name} color={c.color} icon={c.icon} size="md" />
                                </button>
                            );
                        })}
                    </div>
                    {moreOptions.length > 0 && (
                        <Select
                            aria-label="More categories"
                            sizeVariant="sm"
                            value={chipIds.has(selectedCategoryId ?? "") ? "" : (selectedCategoryId ?? "")}
                            onChange={(e) => e.target.value && onSelectCategory(e.target.value)}
                            options={[{ value: "", label: "More…" }, ...moreOptions]}
                        />
                    )}

                    <SegmentedTabs<Split>
                        size="sm"
                        ariaLabel="Split"
                        activeTab={isShared ? "shared" : "mine"}
                        onChange={(tab) => onShareChange(tab === "shared")}
                        tabs={[
                            { id: "mine", label: isPartnerItem ? "Personal" : "Mine" },
                            { id: "shared", label: "Shared" },
                        ]}
                    />
                </div>
            </Card>
        </div>
    );
}

export default InboxCard;
