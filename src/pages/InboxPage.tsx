/**
 * Inbox: sort captured purchases one card at a time.
 * Swipe right (or Confirm) saves with the picked category, swipe left (or
 * Discard) drops it with Undo. Household-wide: either partner can sort
 * both inboxes. Hidden until the capture inbox migration is applied.
 *
 * Keyboard: ← discard, → / Enter confirm, 1-5 pick chip, e edit, z undo.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Inbox, Pencil, Trash2 } from "lucide-react";
import { useLoggedInMember } from "../hooks/useLoggedInMember";
import { useAllExpensesQuery, useCategoriesQuery } from "../hooks/useFinanceQueries";
import {
    inboxQueryKeys,
    useCaptureTokensQuery,
    useInboxQuery,
    useMerchantRulesQuery,
    useConfirmInboxItemMutation,
    useResolveInboxItemMutation,
} from "../hooks/useInboxQueries";
import { guessInboxCategory, findLikelyDuplicate, topCategoriesForMember } from "../lib/capture/guessCategory";
import { buildInboxExpenseInput, canQuickConfirm, inboxItemFormValues } from "../lib/capture/inboxExpense";
import { inboxItemSgd } from "../services/inbox/inboxSummary";
import { emitInboxEvent, InboxSessionTracker } from "../lib/inbox/inboxEvents";
import { getStoredLastSplit } from "../lib/lastSplit";
import { getTodayDateString } from "../lib/dateUtils";
import { haptics } from "../lib/haptics";
import { PageHeader } from "../components/ui/PageHeader";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Alert } from "../components/ui/Alert";
import { EmptyStateCard } from "../components/ui/EmptyStateCard";
import { InboxCard, InboxCardSkeleton } from "../components/inbox/InboxCard";
import { useSwipeCard, type SwipeDirection } from "../components/inbox/useSwipeCard";
import { ExpenseFormModal, type ExpenseFormInitialValues } from "../components/expenses/ExpenseFormModal";
import type { Category, Expense, InboxItem, InboxItemsResult, MerchantRule } from "../types/finance";

const EMPTY_ITEMS: InboxItem[] = [];
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_EXPENSES: Expense[] = [];
const EMPTY_RULES: MerchantRule[] = [];
const UNDO_MS = 5000;
const COMMIT_ANIMATION_MS = 160;

type Via = "swipe" | "button" | "batch";

interface Choice {
    categoryId: string | null;
    isShared: boolean;
}

type FailedAction =
    | { message: string; kind: "confirm"; view: ItemView; via: Via }
    | { message: string; kind: "resolve"; view: ItemView; reason: "discarded" | "duplicate" };

interface ItemView {
    item: InboxItem;
    guessId: string | null;
    isRuleMatch: boolean;
    choice: Choice;
    duplicate?: Expense;
    canConfirm: boolean;
    amountSgd: number;
}

export function InboxPage() {
    const queryClient = useQueryClient();
    const { me, members } = useLoggedInMember();
    const { data, isLoading, refetch } = useInboxQuery();
    const { data: categoriesData } = useCategoriesQuery();
    const { data: expensesData } = useAllExpensesQuery();
    const { data: rulesData } = useMerchantRulesQuery();
    const { data: tokensData } = useCaptureTokensQuery(me?.id);
    const confirmInboxMutation = useConfirmInboxItemMutation();
    const resolveInboxMutation = useResolveInboxItemMutation();

    const items = data?.items ?? EMPTY_ITEMS;
    const categories = categoriesData ?? EMPTY_CATEGORIES;
    const expenses = expensesData ?? EMPTY_EXPENSES;
    const rules = rulesData ?? EMPTY_RULES;
    const hasToken = (tokensData?.tokens.length ?? 0) > 0;

    const [overrides, setOverrides] = useState<Record<string, Partial<Choice>>>({});
    const [error, setError] = useState<FailedAction | null>(null);
    const [undoItem, setUndoItem] = useState<InboxItem | null>(null);
    const [editing, setEditing] = useState<{ item: InboxItem; values: ExpenseFormInitialValues } | null>(null);
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
                const guessId = guess.categoryId ?? item.suggested_category_id ?? null;
                const override = overrides[item.id] ?? {};
                const duplicateId = item.likely_duplicate_of;
                const duplicate =
                    (duplicateId && expenses.find((e) => e.id === duplicateId)) ||
                    findLikelyDuplicate(item, expenses);
                return {
                    item,
                    guessId,
                    isRuleMatch: guess.confidence === "rule",
                    choice: {
                        categoryId: override.categoryId !== undefined ? override.categoryId : guessId,
                        isShared: override.isShared ?? guess.isShared ?? lastSplit,
                    },
                    duplicate: duplicate || undefined,
                    canConfirm: canQuickConfirm(item),
                    amountSgd: inboxItemSgd(item),
                };
            }),
        [items, rules, expenses, categories, overrides, lastSplit],
    );

    const top = views[0];
    const next = views[1];
    const matched = useMemo(() => views.filter((v) => v.isRuleMatch && v.canConfirm), [views]);

    const chipCategories = useMemo(
        () =>
            top
                ? topCategoriesForMember(expenses, categories, top.item.member_id, top.choice.categoryId, 5, todayDate)
                : EMPTY_CATEGORIES,
        [top, expenses, categories, todayDate],
    );

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
            if (!view.choice.categoryId || !view.canConfirm) return false;
            setError(null);
            const input = buildInboxExpenseInput(view.item, {
                categoryId: view.choice.categoryId,
                isShared: view.choice.isShared,
            });
            haptics.lightTap();
            try {
                await confirmInboxMutation.mutateAsync({
                    item: view.item,
                    input,
                    via,
                    guessedCategoryId: view.guessId,
                });
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
                queryClient.getQueryData<InboxItemsResult>(
                    inboxQueryKeys.items,
                )?.items ?? [];
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

    const handleUndo = useCallback(async () => {
        if (!undoItem) return;
        const item = undoItem;
        setUndoItem(null);
        if (undoTimer.current) clearTimeout(undoTimer.current);
        try {
            await resolveInboxMutation.mutateAsync({
                id: item.id,
                reason: "pending",
            });
        } catch (err) {
            console.error("Failed to undo inbox resolution:", err);
        }
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

    const openEdit = useCallback((view: ItemView) => {
        setEditing({
            item: view.item,
            values: inboxItemFormValues(view.item, view.choice),
        });
    }, []);

    const setChoice = useCallback((id: string, patch: Partial<Choice>) => {
        setOverrides((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    }, []);

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
        enabled: Boolean(top) && !editing,
        canConfirm: Boolean(top?.canConfirm && top.choice.categoryId),
        onCommit: onSwipeCommit,
    });

    // Desktop keyboard
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (editing || e.metaKey || e.ctrlKey || e.altKey) return;
            const el = document.activeElement as HTMLElement | null;
            const tag = el?.tagName.toLowerCase();
            if (tag === "input" || tag === "textarea" || tag === "select" || el?.isContentEditable) return;
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
            } else if (e.key === "ArrowRight" || (e.key === "Enter" && tag !== "button")) {
                e.preventDefault();
                void confirmView(top, "button");
            } else if (e.key === "e" || e.key === "E") {
                e.preventDefault();
                openEdit(top);
            } else if (/^[1-5]$/.test(e.key)) {
                const cat = chipCategories[Number(e.key) - 1];
                if (cat) {
                    e.preventDefault();
                    setChoice(top.item.id, { categoryId: cat.id });
                }
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [editing, top, undoItem, chipCategories, handleUndo, resolveView, confirmView, openEdit, setChoice]);

    if (!isLoading && data && !data.available) {
        return <Navigate to="/expenses" replace />;
    }

    const payerName = (id: string) => members.find((m) => m.id === id)?.display_name;

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
                {error && (
                    <Alert
                        variant="danger"
                        title="Couldn't save"
                        action={
                            <Button type="button" variant="secondary" size="sm" onClick={handleRetry}>
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
                ) : top ? (
                    <>
                        <div className="relative">
                            {next && (
                                <div
                                    aria-hidden="true"
                                    className="absolute inset-x-0 top-1.5 h-full scale-[0.97] rounded-2xl border-2 border-(--border-ink) bg-(--bg-card)"
                                />
                            )}
                            <InboxCard
                                key={top.item.id}
                                item={top.item}
                                payerName={payerName(top.item.member_id)}
                                isPartnerItem={!me || top.item.member_id !== me.id}
                                amountSgd={top.amountSgd}
                                canConfirm={top.canConfirm}
                                chipCategories={chipCategories}
                                allCategories={categories}
                                selectedCategoryId={top.choice.categoryId}
                                onSelectCategory={(id) => setChoice(top.item.id, { categoryId: id })}
                                isShared={top.choice.isShared}
                                onShareChange={(shared) => setChoice(top.item.id, { isShared: shared })}
                                duplicate={top.duplicate}
                                onSameOne={() => void resolveView(top, "duplicate")}
                                todayDate={todayDate}
                                cardRef={swipe.cardRef}
                                confirmTintRef={swipe.confirmTintRef}
                                discardTintRef={swipe.discardTintRef}
                                swipeHandlers={swipe.handlers}
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                            <Button
                                type="button"
                                variant="ghost"
                                className="min-h-11"
                                onClick={() => void resolveView(top, "discarded")}
                                leftIcon={<Trash2 className="h-4 w-4" strokeWidth={2.5} />}
                            >
                                Discard
                            </Button>
                            <Button
                                type="button"
                                variant={top.canConfirm ? "outline" : "primary"}
                                className="min-h-11"
                                onClick={() => openEdit(top)}
                                leftIcon={<Pencil className="h-4 w-4" strokeWidth={2.5} />}
                            >
                                Edit
                            </Button>
                            <Button
                                type="button"
                                variant="primary"
                                className="min-h-11"
                                disabled={!top.canConfirm || !top.choice.categoryId}
                                onClick={() => void confirmView(top, "button")}
                                leftIcon={<Check className="h-4 w-4" strokeWidth={2.5} />}
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
                                onClick={() => window.dispatchEvent(new Event("openQuickAdd"))}
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
                                onClick={() => window.dispatchEvent(new Event("openSettings"))}
                            >
                                Set Up
                            </Button>
                        }
                    />
                )}
            </div>

            {undoItem && (
                <div className="fixed inset-x-4 bottom-20 z-50 mx-auto max-w-md md:bottom-6" role="status">
                    <Alert
                        variant="info"
                        title="Discarded"
                        action={
                            <Button type="button" variant="secondary" size="sm" onClick={() => void handleUndo()}>
                                Undo
                            </Button>
                        }
                    >
                        {undoItem.merchant}
                    </Alert>
                </div>
            )}

            <ExpenseFormModal
                isOpen={Boolean(editing)}
                onClose={() => setEditing(null)}
                initialValues={editing?.values}
                inboxItemId={editing?.item.id}
                categories={categories}
                members={members}
                onExpenseAdded={() => void refetch()}
            />
        </div>
    );
}

export default InboxPage;
