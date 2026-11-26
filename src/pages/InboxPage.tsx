/**
 * Inbox: sort captured purchases one card at a time.
 * Swipe right (or Confirm) saves with the inline form fields, swipe left (or
 * Discard) drops it with Undo. Household-wide: either partner can sort
 * both inboxes. Hidden until the capture inbox migration is applied.
 *
 * Keyboard: ← discard, → / Enter confirm, ↑ / [ prev, ↓ / ] next, 1-5 pick chip, z undo.
 */

import { keys } from "../lib/queryKeys";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, ChevronLeft, ChevronRight, Inbox, Trash2 } from "lucide-react";
import { useLoggedInMember } from "../hooks/useLoggedInMember";
import { useSettings } from "../hooks/useSettings";
import { useCategoriesQuery } from "../hooks/finance/categories";
import { useAllExpensesQuery } from "../hooks/finance/expenses";
import { useGoalsQuery } from "../hooks/finance/goals";
import {
    useCaptureTokensQuery,
    useInboxQuery,
    useMerchantRulesQuery,
    useConfirmInboxItemMutation,
    useResolveInboxItemMutation,
} from "../hooks/finance/inbox";
import {
    guessInboxCategory,
    findLikelyDuplicate,
} from "../lib/capture/guessCategory";
import {
    isLoggableCategory,
    isSpendableCategory,
} from "../lib/financialFormulas";
import { toSgtDateTime } from "../lib/capture/sgTime";
import { SUPPORTED_CURRENCIES } from "../lib/currencyConverter";
import {
    buildExpenseInputFromDraft,
    storeRecentTags,
    type ExpenseFormDraft,
} from "../lib/expenseFormDraft";
import { inboxItemSgd } from "../services/inbox/inboxSummary";
import { emitInboxEvent, InboxSessionTracker } from "../lib/inbox/inboxEvents";
import { getStoredLastSplit } from "../lib/lastSplit";
import { getTodayDateString } from "../lib/dateUtils";
import { haptics } from "../lib/haptics";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { QueryErrorAlert } from "../components/ui/QueryErrorAlert";
import { EmptyStateCard } from "../components/ui/EmptyStateCard";
import { InboxCard, InboxCardSkeleton } from "../components/inbox/InboxCard";
import {
    useSwipeCard,
    type SwipeDirection,
} from "../components/inbox/useSwipeCard";
import type {
    Category,
    Expense,
    InboxItem,
    InboxItemsResult,
    MerchantRule,
    SavingsGoal,
} from "../types/finance";

const EMPTY_ITEMS: InboxItem[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_RULES: MerchantRule[] = [];
const EMPTY_GOALS: SavingsGoal[] = [];
const UNDO_MS = 5000;
const COMMIT_ANIMATION_MS = 160;

type Via = "swipe" | "button" | "batch";

type FailedAction =
    | { message: string; kind: "confirm"; view: ItemView; via: Via }
    | {
          message: string;
          kind: "resolve";
          view: ItemView;
          reason: "discarded" | "duplicate";
      };

interface ItemView {
    item: InboxItem;
    guessId: string | null;
    isRuleMatch: boolean;
    initialShowMoreCategories: boolean;
    draft: ExpenseFormDraft;
    duplicate?: Expense;
    needsRateCheck: boolean;
    canConfirm: boolean;
    amountSgd: number;
}

export function InboxPage() {
    const queryClient = useQueryClient();
    const { openSettings } = useSettings();
    const { me, members } = useLoggedInMember();
    const {
        data,
        isLoading,
        isError: inboxQueryError,
        error: inboxQueryErrorObj,
        refetch: refetchInbox,
    } = useInboxQuery();
    const { data: categoriesData } = useCategoriesQuery();
    const { data: expensesData } = useAllExpensesQuery();
    const { data: rulesData } = useMerchantRulesQuery();
    const { data: goalsData } = useGoalsQuery();
    const { data: tokensData } = useCaptureTokensQuery(me?.id);
    const confirmInboxMutation = useConfirmInboxItemMutation();
    const resolveInboxMutation = useResolveInboxItemMutation();

    const items = data?.items ?? EMPTY_ITEMS;
    const categories = categoriesData ?? EMPTY_CATEGORIES;
    const expenses = expensesData ?? EMPTY_EXPENSES;
    const rules = rulesData ?? EMPTY_RULES;
    const goals = goalsData ?? EMPTY_GOALS;
    const hasToken = (tokensData?.tokens.length ?? 0) > 0;

    const [drafts, setDrafts] = useState<Record<string, ExpenseFormDraft>>({});
    const [activeIndex, setActiveIndex] = useState(0);
    const [error, setError] = useState<FailedAction | null>(null);
    const [undoItem, setUndoItem] = useState<InboxItem | null>(null);
    const [busy, setBusy] = useState(false);
    const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const tracker = useRef(new InboxSessionTracker());
    const todayDate = getTodayDateString();
    const lastSplit = useMemo(() => getStoredLastSplit() ?? false, []);

    const views = useMemo<ItemView[]>(
        () =>
            items.map((item) => {
                const guess = guessInboxCategory({
                    merchant: item.merchant,
                    merchantKey: item.merchant_key,
                    rules,
                    recentExpenses: expenses,
                    categories,
                });
                const guessId =
                    guess.categoryId ?? item.suggested_category_id ?? null;
                const guessedCategory = guessId
                    ? categories.find((c) => c.id === guessId)
                    : undefined;
                const initialShowMoreCategories = Boolean(
                    guessedCategory && !isSpendableCategory(guessedCategory),
                );
                const sgt = toSgtDateTime(item.captured_at);
                const defaultDraft: ExpenseFormDraft = {
                    amount: Number(item.amount),
                    currencyCode: item.currency || "SGD",
                    customExchangeRate: undefined,
                    item: item.merchant,
                    categoryId: guessId ?? "",
                    categoryManuallySelected: Boolean(guessId),
                    isGoalSpend: false,
                    selectedGoalId: "",
                    payerId: item.member_id,
                    isShared: guess.isShared ?? lastSplit,
                    splitRatio: 0.5,
                    date: sgt?.date ?? item.captured_at.slice(0, 10),
                    time: sgt?.time ?? "",
                    remarks: "",
                    tags: [],
                };
                const draft = drafts[item.id] ?? defaultDraft;
                const duplicateId = item.likely_duplicate_of;
                const duplicate =
                    (duplicateId &&
                        expenses.find((e) => e.id === duplicateId)) ||
                    findLikelyDuplicate(item, expenses);
                const hasKnownRate =
                    draft.currencyCode === "SGD" ||
                    SUPPORTED_CURRENCIES.some(
                        (c) => c.code === draft.currencyCode,
                    ) ||
                    (draft.customExchangeRate !== undefined &&
                        draft.customExchangeRate > 0);
                const hasValidFunding = draft.isGoalSpend
                    ? Boolean(draft.selectedGoalId)
                    : Boolean(draft.categoryId);
                const canConfirm =
                    hasKnownRate &&
                    draft.amount > 0 &&
                    draft.item.trim().length > 0 &&
                    hasValidFunding;
                return {
                    item,
                    guessId,
                    isRuleMatch: guess.confidence === "rule",
                    initialShowMoreCategories,
                    draft,
                    duplicate: duplicate || undefined,
                    needsRateCheck: !hasKnownRate,
                    canConfirm,
                    amountSgd: inboxItemSgd(item),
                };
            }),
        [items, rules, expenses, categories, drafts, lastSplit],
    );

    const clampedIndex =
        views.length > 0 ? Math.min(activeIndex, views.length - 1) : 0;
    const top = views[clampedIndex];
    const hasNextCard = clampedIndex < views.length - 1;
    const matched = useMemo(
        () => views.filter((v) => v.isRuleMatch && v.canConfirm),
        [views],
    );

    const chipCategories = useMemo(() => {
        if (!top) return EMPTY_CATEGORIES;
        const loggable = categories.filter((c) => isLoggableCategory(c));
        const spendable = loggable.filter((c) => isSpendableCategory(c));
        if (top.initialShowMoreCategories) return loggable;
        return spendable.length > 0 ? spendable : loggable;
    }, [top, categories]);

    // Inbox Zero: pending went to 0 during this visit
    useEffect(() => {
        if (data?.available) tracker.current.update(items.length, todayDate);
    }, [data?.available, items.length, todayDate]);

    useEffect(
        () => () => {
            if (undoTimer.current) clearTimeout(undoTimer.current);
        },
        [],
    );

    const confirmView = useCallback(
        async (view: ItemView, via: Via): Promise<boolean> => {
            if (!view.canConfirm) return false;
            setError(null);
            const input = buildExpenseInputFromDraft(
                view.draft,
                view.item.household_id,
            );
            haptics.lightTap();
            try {
                await confirmInboxMutation.mutateAsync({
                    item: view.item,
                    input,
                    via,
                    guessedCategoryId: view.guessId,
                });
                if (view.draft.tags.length > 0) {
                    storeRecentTags(view.draft.tags);
                }
                return true;
            } catch (err) {
                setError({
                    message: err instanceof Error ? err.message : "Try again.",
                    kind: "confirm",
                    view,
                    via,
                });
                return false;
            }
        },
        [confirmInboxMutation],
    );

    const resolveView = useCallback(
        async (view: ItemView, reason: "discarded" | "duplicate") => {
            setError(null);
            const cachedItems =
                queryClient.getQueryData<InboxItemsResult>(keys.inbox.items)
                    ?.items ?? [];
            const remaining = Math.max(0, cachedItems.length - 1);
            haptics.lightTap();
            try {
                await resolveInboxMutation.mutateAsync({
                    id: view.item.id,
                    reason,
                });
                emitInboxEvent("inbox:item-discarded", {
                    itemId: view.item.id,
                    reason,
                    remaining,
                });
                if (reason === "discarded") {
                    if (undoTimer.current) clearTimeout(undoTimer.current);
                    setUndoItem(view.item);
                    undoTimer.current = setTimeout(
                        () => setUndoItem(null),
                        UNDO_MS,
                    );
                }
            } catch (err) {
                setError({
                    message: err instanceof Error ? err.message : "Try again.",
                    kind: "resolve",
                    view,
                    reason,
                });
            }
        },
        [resolveInboxMutation, queryClient],
    );

    const handleRetry = useCallback(() => {
        if (!error) return;
        if (error.kind === "confirm") void confirmView(error.view, error.via);
        else void resolveView(error.view, error.reason);
    }, [error, confirmView, resolveView]);

    const handleUndo = useCallback(() => {
        if (!undoItem) return;
        const item = undoItem;
        setUndoItem(null);
        if (undoTimer.current) clearTimeout(undoTimer.current);
        resolveInboxMutation.mutate(
            {
                id: item.id,
                reason: "pending",
            },
            {
                onError: () => {
                    setUndoItem(item);
                },
            },
        );
    }, [undoItem, resolveInboxMutation]);

    const handleBatch = useCallback(async () => {
        setBusy(true);
        try {
            for (const view of matched) {
                const ok = await confirmView(view, "batch");
                if (!ok) break;
            }
        } finally {
            setBusy(false);
        }
    }, [matched, confirmView]);

    const patchDraft = useCallback(
        (
            id: string,
            baseDraft: ExpenseFormDraft,
            patch: Partial<ExpenseFormDraft>,
        ) => {
            setDrafts((prev) => ({
                ...prev,
                [id]: { ...(prev[id] ?? baseDraft), ...patch },
            }));
        },
        [],
    );

    const onSwipeCommit = useCallback(
        (direction: SwipeDirection) => {
            if (!top) return;
            const view = top;
            setTimeout(() => {
                if (direction === "right") void confirmView(view, "swipe");
                else void resolveView(view, "discarded");
            }, COMMIT_ANIMATION_MS);
        },
        [top, confirmView, resolveView],
    );

    const swipe = useSwipeCard({
        enabled: Boolean(top),
        canConfirm: Boolean(top?.canConfirm),
        onCommit: onSwipeCommit,
    });

    // Desktop keyboard
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.metaKey || e.ctrlKey || e.altKey) return;
            const el = document.activeElement as HTMLElement | null;
            const tag = el?.tagName.toLowerCase();
            if (
                tag === "input" ||
                tag === "textarea" ||
                tag === "select" ||
                el?.isContentEditable
            )
                return;
            if (document.querySelector('[role="dialog"]')) return;
            if ((e.key === "z" || e.key === "Z") && undoItem) {
                e.preventDefault();
                void handleUndo();
                return;
            }
            if (!top) return;
            if (e.key === "ArrowLeft") {
                e.preventDefault();
                void resolveView(top, "discarded");
            } else if (
                e.key === "ArrowRight" ||
                (e.key === "Enter" && tag !== "button")
            ) {
                e.preventDefault();
                void confirmView(top, "button");
            } else if (e.key === "ArrowUp" || e.key === "[") {
                e.preventDefault();
                setActiveIndex((i) => Math.max(0, i - 1));
            } else if (e.key === "ArrowDown" || e.key === "]") {
                e.preventDefault();
                setActiveIndex((i) => Math.min(views.length - 1, i + 1));
            } else if (/^[1-5]$/.test(e.key)) {
                const cat = chipCategories[Number(e.key) - 1];
                if (cat) {
                    e.preventDefault();
                    patchDraft(top.item.id, top.draft, {
                        categoryId: cat.id,
                        categoryManuallySelected: true,
                        isGoalSpend: false,
                    });
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [
        top,
        views.length,
        undoItem,
        chipCategories,
        handleUndo,
        resolveView,
        confirmView,
        patchDraft,
    ]);

    if (!isLoading && data && !data.available) {
        return <Navigate to="/expenses" replace />;
    }

    const payerName = (id: string) =>
        members.find((m) => m.id === id)?.display_name;

    return (
        <div className="space-y-5 pb-20 md:pb-12">
            <PageHeader
                title="Inbox"
                icon={<Inbox className="h-5 w-5" strokeWidth={2.5} />}
                badge={
                    items.length > 0 ? (
                        <Badge variant="butter" size="sm">
                            {items.length} to sort
                        </Badge>
                    ) : undefined
                }
            />

            <div className="mx-auto w-full max-w-md space-y-4">
                {inboxQueryError && (
                    <QueryErrorAlert
                        error={inboxQueryErrorObj}
                        onRetry={() => void refetchInbox()}
                    />
                )}

                {error && (
                    <Alert
                        variant="danger"
                        title="Couldn't save"
                        action={
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={handleRetry}
                            >
                                Retry
                            </Button>
                        }
                        onClose={() => setError(null)}
                    >
                        {error.message}
                    </Alert>
                )}

                {isLoading ? (
                    <InboxCardSkeleton />
                ) : inboxQueryError && !data ? null : top ? (
                    <>
                        <div className="flex items-center justify-between gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11"
                                disabled={clampedIndex === 0}
                                onClick={() =>
                                    setActiveIndex((i) => Math.max(0, i - 1))
                                }
                                leftIcon={
                                    <ChevronLeft
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                Prev
                            </Button>
                            <span
                                data-testid="inbox-position"
                                className="text-xs font-bold uppercase tracking-wider text-(--text-muted) font-mono-num"
                            >
                                {`${clampedIndex + 1} of ${views.length}`}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="min-h-11"
                                disabled={clampedIndex >= views.length - 1}
                                onClick={() =>
                                    setActiveIndex((i) =>
                                        Math.min(views.length - 1, i + 1),
                                    )
                                }
                                rightIcon={
                                    <ChevronRight
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                Next
                            </Button>
                        </div>

                        <div className="relative">
                            {hasNextCard && (
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-x-0 top-1.5 h-full scale-[0.97] rounded-2xl border-2 border-(--border-ink) bg-(--bg-card)"
                                />
                            )}
                            <InboxCard
                                key={top.item.id}
                                item={top.item}
                                payerName={payerName(top.item.member_id)}
                                isPartnerItem={
                                    !me || top.item.member_id !== me.id
                                }
                                needsRateCheck={top.needsRateCheck}
                                draft={top.draft}
                                onDraftChange={(patch) =>
                                    patchDraft(top.item.id, top.draft, patch)
                                }
                                allCategories={categories}
                                initialShowMoreCategories={
                                    top.initialShowMoreCategories
                                }
                                members={members}
                                goals={goals}
                                duplicate={top.duplicate}
                                onSameOne={() =>
                                    void resolveView(top, "duplicate")
                                }
                                todayDate={todayDate}
                                cardRef={swipe.cardRef}
                                confirmTintRef={swipe.confirmTintRef}
                                discardTintRef={swipe.discardTintRef}
                                swipeHandlers={swipe.handlers}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="min-h-11"
                                onClick={() =>
                                    void resolveView(top, "discarded")
                                }
                                leftIcon={
                                    <Trash2
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                Discard
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                className="min-h-11"
                                disabled={!top.canConfirm}
                                onClick={() => void confirmView(top, "button")}
                                leftIcon={
                                    <Check
                                        className="h-4 w-4"
                                        strokeWidth={2.5}
                                    />
                                }
                            >
                                Confirm
                            </Button>
                        </div>

                        {matched.length >= 2 && (
                            <Button
                                type="button"
                                variant="secondary"
                                className="min-h-11 w-full"
                                isLoading={busy}
                                onClick={() => void handleBatch()}
                            >
                                {`Confirm ${matched.length} Matched`}
                            </Button>
                        )}
                    </>
                ) : hasToken ? (
                    <EmptyStateCard
                        icon={<Check className="h-5 w-5" strokeWidth={2.5} />}
                        title="All Sorted"
                        description="New card purchases land here."
                        action={
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() =>
                                    window.dispatchEvent(
                                        new Event("openQuickAdd"),
                                    )
                                }
                            >
                                Add Expense
                            </Button>
                        }
                    />
                ) : (
                    <EmptyStateCard
                        icon={<Inbox className="h-5 w-5" strokeWidth={2.5} />}
                        title="No Captures"
                        description="Set up Auto Capture to skip typing."
                        action={
                            <Button
                                type="button"
                                variant="primary"
                                onClick={() => openSettings("auto-capture")}
                            >
                                Set Up
                            </Button>
                        }
                    />
                )}
            </div>

            {undoItem && (
                <div
                    className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md md:bottom-6"
                    role="status"
                >
                    <Alert
                        variant="info"
                        title="Discarded"
                        action={
                            <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                onClick={() => void handleUndo()}
                            >
                                Undo
                            </Button>
                        }
                    >
                        {undoItem.merchant}
                    </Alert>
                </div>
            )}
        </div>
    );
}

export default InboxPage;
