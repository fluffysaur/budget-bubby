/**
 * Expense Form Modal: the one form for adding and editing expenses.
 * - Add mode (default), optionally opened with a savings goal pre-selected
 *   (e.g. from a goal card's Spend button).
 * - Edit mode when `expense` is passed.
 *
 * Minimal by default: Amount, Budget | Goal funding with its picker, and Description.
 * Everything else sits in a collapsed "More" section with smart defaults
 * (today, current member as payer, last split used), summarised on its toggle:
 * - Date chips (Today, Yesterday, 2d ago) + date/time pickers
 * - Payer and Personal / Shared split (custom partner share slider)
 * - Currency with FX conversion
 * - Remarks and #tags
 * "More" opens automatically when any of its non-default fields is set.
 */

import {
    useState,
    useEffect,
    useMemo,
    useCallback,
    type FormEvent,
} from "react";
import { Plus, Save, ChevronDown, ChevronUp } from "lucide-react";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import {
    financeService,
    isMockModeActive,
} from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import { emitAppEvent } from "../../lib/appEvents";
import {
    getTodayDateString,
    getCurrentSingaporeTime,
} from "../../lib/dateUtils";
import {
    isLoggableCategory,
    isSpendableCategory,
} from "../../lib/financialFormulas";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import { formatForeignAmount } from "../../lib/currencyConverter";
import type {
    Category,
    HouseholdMember,
    Expense,
    CreateExpenseInput,
    UpdateExpenseInput,
    SavingsGoal,
    InboxItem,
} from "../../types/finance";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { guessCategoryId } from "../../lib/categoryGuess";
import { getStoredLastSplit, storeLastSplit } from "../../lib/lastSplit";
import {
    inboxExpenseEventDetail,
    inboxItemFormValues,
} from "../../lib/capture/inboxExpense";
import { normalizeMerchant } from "../../lib/capture/merchant";
import { TruncatedText } from "../ui/TruncatedText";
import { useAddExpenseMutation } from "../../hooks/useFinanceQueries";
import { useConfirmInboxItemMutation } from "../../hooks/useInboxQueries";
import {
    buildExpenseInputFromDraft,
    storeRecentTags,
    type ExpenseFormDraft,
} from "../../lib/expenseFormDraft";
import { ExpenseFormFields } from "./ExpenseFormFields";

export interface ExpenseFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Pass an expense to open the form in Edit mode. */
    expense?: Expense | null;
    /** Add mode: open with Goal funding on and this goal picked. */
    initialGoalId?: string;
    /** Add mode: prefill fields (deep link, inbox item). */
    initialValues?: ExpenseFormInitialValues;
    /** Add mode: saving confirms this inbox item instead of adding. */
    inboxItemId?: string;
    onExpenseAdded?: (expense: Expense) => void;
    onExpenseUpdated?: (expense: Expense) => void;
    defaultPayerId?: string;
    defaultShared?: boolean;
    categories?: Category[];
    members?: HouseholdMember[];
    goals?: SavingsGoal[];
    addMutation?: ReturnType<typeof useAddExpenseMutation>;
}

export type ExpenseFormInitialValues = Partial<
    Pick<
        CreateExpenseInput,
        | "amount"
        | "item"
        | "date"
        | "time"
        | "original_currency"
        | "original_amount"
        | "remarks"
        | "category_id"
        | "payer_id"
        | "is_shared"
    >
>;

export function ExpenseFormModal({
    isOpen,
    onClose,
    expense,
    initialGoalId,
    initialValues,
    inboxItemId,
    onExpenseAdded,
    onExpenseUpdated,
    defaultPayerId,
    defaultShared,
    categories: propCategories,
    members: propMembers,
    goals: propGoals,
    addMutation: propAddMutation,
}: ExpenseFormModalProps) {
    const defaultAddMutation = useAddExpenseMutation();
    const addExpenseMutation = propAddMutation ?? defaultAddMutation;
    const confirmInboxMutation = useConfirmInboxItemMutation();

    // Optional so the form also works outside a HouseholdProvider (e.g. edit from a bare list)
    const household = useOptionalHousehold();
    const ctxMembers = household?.members;
    const activeMember = household?.activeMember ?? null;
    const perspective = household?.perspective ?? "household";
    const isMockMode = household?.isMockMode ?? isMockModeActive();
    const isEditMode = Boolean(expense);

    const members = useMemo(
        () =>
            propMembers && propMembers.length > 0
                ? propMembers
                : ctxMembers && ctxMembers.length > 0
                  ? ctxMembers
                  : isMockMode
                    ? mockMembers
                    : [],
        [propMembers, ctxMembers, isMockMode],
    );
    const { me } = useLoggedInMember(members);

    const categories = useMemo(
        () =>
            propCategories && propCategories.length > 0
                ? propCategories
                : isMockMode
                  ? mockCategories
                  : [],
        [propCategories, isMockMode],
    );

    // Savings is a target, not a spending bucket: it can't be logged against.
    const loggableCategories = useMemo(
        () => categories.filter((c) => isLoggableCategory(c)),
        [categories],
    );
    const spendableCategories = useMemo(
        () => loggableCategories.filter((c) => isSpendableCategory(c)),
        [loggableCategories],
    );
    // Split default: explicit prop, else the last split used, else Shared in Combined / Personal otherwise
    const resolvedDefaultShared =
        defaultShared ?? getStoredLastSplit() ?? perspective === "household";

    const [draft, setDraft] = useState<ExpenseFormDraft>(() => ({
        amount: 0,
        currencyCode: "SGD",
        customExchangeRate: undefined,
        item: "",
        categoryId:
            spendableCategories[0]?.id || loggableCategories[0]?.id || "",
        partnerCategoryId: "",
        categoryManuallySelected: false,
        isGoalSpend: false,
        selectedGoalId: "",
        payerId:
            defaultPayerId ||
            activeMember?.id ||
            me?.id ||
            members[0]?.id ||
            "",
        isShared: resolvedDefaultShared,
        splitRatio: 0.5,
        date: getTodayDateString(),
        time: getCurrentSingaporeTime(),
        remarks: "",
        tags: [],
    }));
    const [initialShowMoreCategories, setInitialShowMoreCategories] =
        useState<boolean>(false);

    // Goals State (all goals: achieved goals are fully funded pots you can still spend from)
    const [goals, setGoals] = useState<SavingsGoal[]>(propGoals || []);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inbox: the item this save confirms, and newest items offered as chips
    const [linkedInboxId, setLinkedInboxId] = useState<string | null>(null);
    const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
    const [showInboxChips, setShowInboxChips] = useState<boolean>(false);
    const inboxChips = useMemo(() => inboxItems.slice(0, 3), [inboxItems]);
    const wantsInboxChips = isOpen && !isEditMode && !inboxItemId;

    const patchDraft = useCallback((patch: Partial<ExpenseFormDraft>) => {
        setDraft((prev) => ({ ...prev, ...patch }));
    }, []);

    // Newest inbox items, offered as "From Inbox" (household-wide)
    useEffect(() => {
        if (!wantsInboxChips) return;
        let isMounted = true;
        financeService
            .getInboxItems("pending")
            .then((res) => {
                if (isMounted) setInboxItems(res.available ? res.items : []);
            })
            .catch((err: unknown) => {
                if (!isMounted) return;
                emitAppEvent("app:error", {
                    title: "Couldn't load inbox",
                    subtitle:
                        err instanceof Error && err.message
                            ? err.message
                            : "Inbox suggestions unavailable.",
                });
            });
        return () => {
            isMounted = false;
        };
    }, [wantsInboxChips]);

    // Fetch goals if not supplied in props
    useEffect(() => {
        if (propGoals) {
            setGoals(propGoals);
            return;
        }
        let isMounted = true;
        financeService
            .getGoals()
            .then((g) => {
                if (isMounted && g) {
                    setGoals(g);
                }
            })
            .catch((err: unknown) => {
                if (!isMounted) return;
                emitAppEvent("app:error", {
                    title: "Couldn't load goals",
                    subtitle:
                        err instanceof Error && err.message
                            ? err.message
                            : "Savings goals unavailable.",
                });
            });
        return () => {
            isMounted = false;
        };
    }, [propGoals, isOpen]);

    const applyPrefillToDraft = useCallback(
        (
            base: ExpenseFormDraft,
            values: ExpenseFormInitialValues,
        ): ExpenseFormDraft => {
            const next = { ...base };
            const foreign =
                values.original_currency && values.original_currency !== "SGD";
            if (foreign) {
                next.currencyCode = values.original_currency as string;
                next.amount = values.original_amount ?? values.amount ?? 0;
            } else if (values.amount) {
                next.currencyCode = "SGD";
                next.amount = values.amount;
            }
            if (values.item) {
                next.item = values.item;
                const guessed = guessCategoryId(
                    values.item,
                    loggableCategories,
                );
                if (guessed) next.categoryId = guessed;
            }
            if (values.category_id) {
                next.categoryId = values.category_id;
                next.categoryManuallySelected = true;
            }
            if (values.payer_id) next.payerId = values.payer_id;
            if (values.is_shared !== undefined)
                next.isShared = values.is_shared;
            if (values.date) next.date = values.date;
            if (values.time) next.time = values.time;
            if (values.remarks) next.remarks = values.remarks;
            return next;
        },
        [loggableCategories],
    );

    const applyPrefill = useCallback(
        (values: ExpenseFormInitialValues) => {
            setDraft((prev) => applyPrefillToDraft(prev, values));
        },
        [applyPrefillToDraft],
    );

    // Reset form on open
    useEffect(() => {
        if (isOpen && expense) {
            const origCurrency = expense.original_currency || "SGD";
            const savedRate = Number(expense.exchange_rate);
            const existingCategory = categories.find(
                (c) => c.id === expense.category_id,
            );
            setInitialShowMoreCategories(
                Boolean(existingCategory) &&
                    !isSpendableCategory(existingCategory as Category),
            );
            setDraft({
                currencyCode: origCurrency,
                customExchangeRate:
                    origCurrency !== "SGD" && savedRate > 0
                        ? savedRate
                        : undefined,
                amount:
                    expense.original_amount !== undefined &&
                    expense.original_amount !== null
                        ? expense.original_amount
                        : expense.amount,
                item: expense.item,
                categoryId: expense.category_id || "",
                partnerCategoryId: expense.partner_category_id || "",
                categoryManuallySelected: true,
                payerId: expense.payer_id || members[0]?.id || "",
                isShared: expense.is_shared,
                splitRatio: expense.is_shared
                    ? (expense.split_ratio ?? 0.5)
                    : 0.5,
                date: expense.date,
                time: expense.time || "",
                remarks: expense.remarks || "",
                tags: expense.tags ? [...expense.tags] : [],
                selectedGoalId: expense.goal_id || "",
                isGoalSpend: Boolean(expense.goal_id),
            });
            setErrorMessage(null);
            setIsSubmitting(false);
        } else if (isOpen) {
            setInitialShowMoreCategories(false);
            const base: ExpenseFormDraft = {
                amount: 0,
                currencyCode: "SGD",
                customExchangeRate: undefined,
                item: "",
                categoryId:
                    spendableCategories[0]?.id ||
                    loggableCategories[0]?.id ||
                    "",
                partnerCategoryId: "",
                categoryManuallySelected: false,
                payerId:
                    defaultPayerId ||
                    activeMember?.id ||
                    me?.id ||
                    members[0]?.id ||
                    "",
                isShared:
                    defaultShared ??
                    getStoredLastSplit() ??
                    perspective === "household",
                splitRatio: 0.5,
                date: getTodayDateString(),
                time: getCurrentSingaporeTime(),
                remarks: "",
                tags: [],
                selectedGoalId: initialGoalId || "",
                isGoalSpend: Boolean(initialGoalId),
            };
            setDraft(
                initialValues ? applyPrefillToDraft(base, initialValues) : base,
            );
            setErrorMessage(null);
            setIsSubmitting(false);
            setLinkedInboxId(inboxItemId ?? null);
            setShowInboxChips(false);
        }
    }, [
        isOpen,
        expense,
        initialGoalId,
        initialValues,
        inboxItemId,
        applyPrefillToDraft,
        defaultPayerId,
        defaultShared,
        activeMember,
        me,
        perspective,
        categories,
        spendableCategories,
        loggableCategories,
        members,
    ]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (isNaN(draft.amount) || draft.amount <= 0) {
            setErrorMessage(
                "Please enter a valid expense amount greater than 0",
            );
            return;
        }

        if (!draft.item.trim()) {
            setErrorMessage("Please enter a description for this expense");
            return;
        }

        if (draft.isGoalSpend && !draft.selectedGoalId) {
            setErrorMessage(
                "Please select which savings goal funds this expense",
            );
            return;
        }

        // A budget expense needs a category. Old uncategorised expenses can
        // still be edited, unless they're being moved off a goal.
        if (
            !draft.isGoalSpend &&
            !draft.categoryId &&
            categories.length > 0 &&
            (!expense || expense.goal_id)
        ) {
            setErrorMessage("Please pick a category for this expense");
            return;
        }

        const builtInput = buildExpenseInputFromDraft(draft);

        try {
            setIsSubmitting(true);

            if (expense) {
                const updates: UpdateExpenseInput = {
                    ...builtInput,
                    date: draft.date || expense.date,
                    time: draft.time || null,
                    tags: draft.tags.map((t) => t.trim()).filter(Boolean),
                };
                const updated = await financeService.updateExpense(
                    expense.id,
                    updates,
                );
                if (draft.tags.length > 0) {
                    storeRecentTags(draft.tags);
                }
                feedback.routine("edit");
                onExpenseUpdated?.(updated);
                onClose();
                return;
            }

            const input: CreateExpenseInput = builtInput;

            if (linkedInboxId) {
                const linked = inboxItems.find((i) => i.id === linkedInboxId);
                const expenseId = await confirmInboxMutation.mutateAsync({
                    item: {
                        id: linkedInboxId,
                        merchant_key:
                            linked?.merchant_key ??
                            normalizeMerchant(input.item),
                        suggested_category_id:
                            linked?.suggested_category_id ?? null,
                    },
                    input,
                    via: "edit",
                    guessedCategoryId: linked?.suggested_category_id ?? null,
                });
                if (draft.tags.length > 0) storeRecentTags(draft.tags);
                onExpenseAdded?.(inboxExpenseEventDetail(expenseId, input));
                onClose();
                return;
            }

            storeLastSplit(draft.isShared);

            // Persist tags globally for recent quick suggestions
            if (draft.tags.length > 0) {
                storeRecentTags(draft.tags);
            }

            // Optimistic mutation: updates cache immediately via onMutate
            try {
                const created = await addExpenseMutation.mutateAsync(input);
                if (typeof window !== "undefined") {
                    window.dispatchEvent(
                        new CustomEvent("expenseAdded", {
                            detail: { ...created, source: "form" },
                        }),
                    );
                }
                onExpenseAdded?.(created);
            } catch (err) {
                setErrorMessage(
                    err instanceof Error
                        ? err.message
                        : "Failed to save expense",
                );
            }

            onClose();
            return;
        } catch (err: unknown) {
            setErrorMessage(
                err instanceof Error ? err.message : "Failed to save expense",
            );
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
                <ModalHeader
                    title={isEditMode ? "Edit Expense" : "Add Expense"}
                    icon={
                        isEditMode ? (
                            <Save className="h-4.5 w-4.5" strokeWidth={2.5} />
                        ) : (
                            <Plus className="h-4.5 w-4.5" strokeWidth={2.5} />
                        )
                    }
                    iconBgColor={
                        isEditMode
                            ? "bg-(--pastel-butter-light)"
                            : "bg-(--pastel-lilac-light)"
                    }
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error Alert */}
                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
                    )}

                    {/* From Inbox: confirm a captured purchase instead of adding a duplicate */}
                    {!isEditMode && !inboxItemId && inboxChips.length > 0 && (
                        <div>
                            <button
                                type="button"
                                aria-expanded={
                                    showInboxChips || Boolean(linkedInboxId)
                                }
                                onClick={() =>
                                    setShowInboxChips((prev) => !prev)
                                }
                                className="flex items-center gap-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                            >
                                {`From Inbox (${inboxItems.length})`}
                                {showInboxChips || linkedInboxId ? (
                                    <ChevronUp
                                        className="h-3.5 w-3.5"
                                        strokeWidth={2.5}
                                    />
                                ) : (
                                    <ChevronDown
                                        className="h-3.5 w-3.5"
                                        strokeWidth={2.5}
                                    />
                                )}
                            </button>
                            {(showInboxChips || linkedInboxId) && (
                                <div
                                    className="flex flex-wrap gap-1.5"
                                    aria-label="From Inbox"
                                >
                                    {inboxChips.map((chip) => {
                                        const isLinked =
                                            chip.id === linkedInboxId;
                                        return (
                                            <button
                                                key={chip.id}
                                                type="button"
                                                aria-pressed={isLinked}
                                                onClick={() => {
                                                    if (isLinked) {
                                                        setLinkedInboxId(null);
                                                        return;
                                                    }
                                                    setLinkedInboxId(chip.id);
                                                    applyPrefill(
                                                        inboxItemFormValues(
                                                            chip,
                                                            {
                                                                categoryId:
                                                                    chip.suggested_category_id ??
                                                                    null,
                                                                isShared: null,
                                                            },
                                                        ),
                                                    );
                                                }}
                                                className={`flex min-h-10 max-w-full items-center gap-1.5 rounded-xl border-2 border-(--border-ink) px-2.5 py-1 text-xs font-bold transition-press active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
                                                    isLinked
                                                        ? "bg-(--pastel-mint-light) shadow-cute-sm"
                                                        : "bg-(--bg-card) hover:bg-(--bg-cream)"
                                                }`}
                                            >
                                                <TruncatedText
                                                    text={chip.merchant}
                                                    className="min-w-0 max-w-32"
                                                />
                                                <span className="shrink-0 font-mono-num text-(--text-muted)">
                                                    {formatForeignAmount(
                                                        chip.amount,
                                                        chip.currency,
                                                    )}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    <ExpenseFormFields
                        draft={draft}
                        onChange={patchDraft}
                        categories={categories}
                        members={members}
                        goals={goals}
                        onNavigateToGoals={onClose}
                        autoFocusAmount
                        initialShowMoreCategories={initialShowMoreCategories}
                        resetKey={`${isOpen}-${expense?.id ?? "new"}-${inboxItemId ?? ""}`}
                        isEditMode={isEditMode}
                        activeMemberId={activeMember?.id ?? null}
                    />
                </ModalBody>

                <ModalFooter>
                    <Button variant="secondary" type="button" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        type="submit"
                        disabled={isSubmitting}
                        isLoading={isSubmitting}
                        leftIcon={
                            isEditMode ? (
                                <Save className="h-4 w-4" strokeWidth={2.5} />
                            ) : (
                                <Plus className="h-4 w-4" strokeWidth={2.5} />
                            )
                        }
                    >
                        {isSubmitting
                            ? "Saving..."
                            : isEditMode
                              ? "Save"
                              : linkedInboxId
                                ? "Confirm"
                                : "Add"}
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default ExpenseFormModal;
