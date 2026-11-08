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

import { useState, useEffect, useMemo, useCallback, type FormEvent } from "react";
import { Plus, Save, Hash, Target, ChevronDown, ChevronUp } from "lucide-react";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { useSgtClock } from "../../hooks/useBubby";
import { addDays } from "../../lib/bubby/dates";
import { financeService, isMockModeActive } from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import {
    getTodayDateString,
    formatDisplayDate,
    getCurrentSingaporeTime,
} from "../../lib/dateUtils";
import { isSpendableCategory } from "../../lib/financialFormulas";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import {
    SUPPORTED_CURRENCIES,
    buildExpenseFxFields,
    convertToSGD,
    formatForeignAmount,
} from "../../lib/currencyConverter";
import { FxRateField } from "./FxRateField";
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
import { SegmentedTabs } from "../ui/SegmentedTabs";
import { TooltipPopover } from "../ui/TooltipPopover";
import { CurrencyText } from "../ui/CurrencyText";
import { CentsFirstAmountInput } from "./CentsFirstAmountInput";
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

type FundingSource = "budget" | "goal";

// Goal chips shown before "+ More"
const GOAL_CHIP_LIMIT = 4;

const GLOBAL_RECENT_TAGS_STORAGE_KEY = "budget_bubby_recent_tags_global_v2";
function getStoredRecentTags(): string[] {
    if (typeof window === "undefined" || !window.localStorage) return [];
    try {
        const raw = window.localStorage.getItem(GLOBAL_RECENT_TAGS_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
    } catch {
        // Ignore localStorage error
    }
    return [];
}

function storeRecentTags(newTags: string[]) {
    if (
        typeof window === "undefined" ||
        !window.localStorage ||
        !newTags.length
    )
        return;
    try {
        const existing = getStoredRecentTags();
        const combined = [
            ...newTags.map((t) => t.trim().replace(/^#/, "")).filter(Boolean),
            ...existing,
        ];
        const unique: string[] = [];
        for (const t of combined) {
            if (!unique.some((u) => u.toLowerCase() === t.toLowerCase())) {
                unique.push(t);
            }
        }
        window.localStorage.setItem(
            GLOBAL_RECENT_TAGS_STORAGE_KEY,
            JSON.stringify(unique.slice(0, 10)),
        );
    } catch {
        // Ignore localStorage failures
    }
}

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

    const spendableCategories = useMemo(
        () => categories.filter((c) => isSpendableCategory(c)),
        [categories],
    );
    const allocationCategories = useMemo(
        () => categories.filter((c) => !isSpendableCategory(c)),
        [categories],
    );

    // Split default: explicit prop, else the last split used, else Shared in Combined / Personal otherwise
    const resolveDefaultShared = () =>
        defaultShared ?? getStoredLastSplit() ?? perspective === "household";
    const resolvedDefaultShared = resolveDefaultShared();

    // Amount & Currency State
    const [amount, setAmount] = useState<number>(0);
    const [currencyCode, setCurrencyCode] = useState<string>("SGD");
    const [customExchangeRate, setCustomExchangeRate] = useState<
        number | undefined
    >(undefined);

    // Item & Category State
    const [item, setItem] = useState<string>("");
    const [categoryId, setCategoryId] = useState<string>(
        spendableCategories[0]?.id || categories[0]?.id || "",
    );
    const [categoryManuallySelected, setCategoryManuallySelected] =
        useState<boolean>(false);
    const [showMoreCategories, setShowMoreCategories] =
        useState<boolean>(false);

    // Payer & Shared State
    const [payerId, setPayerId] = useState<string>(() => {
        if (defaultPayerId) return defaultPayerId;
        if (activeMember) return activeMember.id;
        if (me) return me.id;
        return members[0]?.id || "";
    });
    const [isShared, setIsShared] = useState<boolean>(resolvedDefaultShared);
    // Partner's share of a shared expense (0.5 = 50/50)
    const [splitRatio, setSplitRatio] = useState<number>(0.5);

    // Date, Time & Notes State
    const [date, setDate] = useState<string>(getTodayDateString());
    const [time, setTime] = useState<string>(() => getCurrentSingaporeTime());
    const [remarks, setRemarks] = useState<string>("");

    // Tags State
    const [tags, setTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>("");
    const [recentTagsList, setRecentTagsList] = useState<string[]>(() =>
        getStoredRecentTags(),
    );

    // Goals State (all goals: achieved goals are fully funded pots you can still spend from)
    const [goals, setGoals] = useState<SavingsGoal[]>(propGoals || []);
    // Kept when switching to Budget, so switching back restores the pick
    const [selectedGoalId, setSelectedGoalId] = useState<string>("");
    const [isGoalSpend, setIsGoalSpend] = useState<boolean>(false);
    const [showMoreGoals, setShowMoreGoals] = useState<boolean>(false);

    // Accordion State
    const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inbox: the item this save confirms, and newest items offered as chips
    const [linkedInboxId, setLinkedInboxId] = useState<string | null>(null);
    const [inboxItems, setInboxItems] = useState<InboxItem[]>([]);
    const [showInboxChips, setShowInboxChips] = useState<boolean>(false);
    const inboxChips = useMemo(() => inboxItems.slice(0, 3), [inboxItems]);
    const wantsInboxChips = isOpen && !isEditMode && !inboxItemId;

    // Newest inbox items, offered as "From Inbox" (household-wide)
    useEffect(() => {
        if (!wantsInboxChips) return;
        let isMounted = true;
        financeService
            .getInboxItems("pending")
            .then((res) => {
                if (isMounted) setInboxItems(res.available ? res.items : []);
            })
            .catch(() => {});
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
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, [propGoals, isOpen]);

    // Applies prefill values on top of the add-mode defaults
    const applyPrefill = useCallback(
        (values: ExpenseFormInitialValues) => {
            const foreign =
                values.original_currency && values.original_currency !== "SGD";
            if (foreign) {
                setCurrencyCode(values.original_currency as string);
                setAmount(values.original_amount ?? values.amount ?? 0);
            } else if (values.amount) {
                setCurrencyCode("SGD");
                setAmount(values.amount);
            }
            if (values.item) {
                setItem(values.item);
                const guessed = guessCategoryId(values.item, categories);
                if (guessed) setCategoryId(guessed);
            }
            if (values.category_id) {
                setCategoryId(values.category_id);
                setCategoryManuallySelected(true);
            }
            if (values.payer_id) setPayerId(values.payer_id);
            if (values.is_shared !== undefined) setIsShared(values.is_shared);
            if (values.date) setDate(values.date);
            if (values.time) setTime(values.time);
            if (values.remarks) setRemarks(values.remarks);
        },
        [categories],
    );

    // Reset form and sync recent tags on open
    useEffect(() => {
        if (isOpen && expense) {
            // Edit mode: load the expense
            const origCurrency = expense.original_currency || "SGD";
            const savedRate = Number(expense.exchange_rate);
            setCurrencyCode(origCurrency);
            setCustomExchangeRate(
                origCurrency !== "SGD" && savedRate > 0 ? savedRate : undefined,
            );
            setAmount(
                expense.original_amount !== undefined &&
                    expense.original_amount !== null
                    ? expense.original_amount
                    : expense.amount,
            );
            setItem(expense.item);
            const existingCategory = categories.find(
                (c) => c.id === expense.category_id,
            );
            setCategoryId(expense.category_id || "");
            // Don't let description edits re-guess the category
            setCategoryManuallySelected(true);
            // Show all categories when the current one isn't a spendable one
            setShowMoreCategories(
                Boolean(existingCategory) &&
                    !isSpendableCategory(existingCategory as Category),
            );
            setPayerId(expense.payer_id || members[0]?.id || "");
            setIsShared(expense.is_shared);
            setSplitRatio(
                expense.is_shared ? (expense.split_ratio ?? 0.5) : 0.5,
            );
            setDate(expense.date);
            setTime(expense.time || "");
            setRemarks(expense.remarks || "");
            setTags(expense.tags ? [...expense.tags] : []);
            setNewTagInput("");
            setSelectedGoalId(expense.goal_id || "");
            setIsGoalSpend(Boolean(expense.goal_id));
            setShowMoreGoals(false);
            setShowMoreOptions(false);
            setRecentTagsList(getStoredRecentTags());
            setErrorMessage(null);
            setIsSubmitting(false);
        } else if (isOpen) {
            setAmount(0);
            setCurrencyCode("SGD");
            setCustomExchangeRate(undefined);
            setItem("");
            setCategoryId(
                spendableCategories[0]?.id || categories[0]?.id || "",
            );
            setCategoryManuallySelected(false);
            setShowMoreCategories(false);
            setPayerId(
                defaultPayerId ||
                    activeMember?.id ||
                    me?.id ||
                    members[0]?.id ||
                    "",
            );
            setIsShared(
                defaultShared ?? getStoredLastSplit() ?? perspective === "household",
            );
            setSplitRatio(0.5);
            setDate(getTodayDateString());
            setTime(getCurrentSingaporeTime());
            setRemarks("");
            setTags([]);
            setNewTagInput("");
            setSelectedGoalId(initialGoalId || "");
            setIsGoalSpend(Boolean(initialGoalId));
            setShowMoreGoals(false);
            setShowMoreOptions(false);
            setRecentTagsList(getStoredRecentTags());
            setErrorMessage(null);
            setIsSubmitting(false);

            setLinkedInboxId(inboxItemId ?? null);
            setShowInboxChips(false);
            if (initialValues) applyPrefill(initialValues);
        }
    }, [
        isOpen,
        expense,
        initialGoalId,
        initialValues,
        inboxItemId,
        applyPrefill,
        defaultPayerId,
        defaultShared,
        activeMember,
        me,
        perspective,
        categories,
        spendableCategories,
        members,
    ]);

    // Calculate currency conversion
    const selectedCurrency = useMemo(
        () =>
            SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) ||
            SUPPORTED_CURRENCIES[0],
        [currencyCode],
    );

    const visibleCategories = showMoreCategories
        ? categories
        : spendableCategories.length > 0
          ? spendableCategories
          : categories;

    // Auto-detect category from description text if user hasn't explicitly chosen one
    const handleItemTextChange = (text: string) => {
        setItem(text);
        if (!categoryManuallySelected) {
            const guessed = guessCategoryId(text, categories);
            if (guessed) setCategoryId(guessed);
        }
    };

    // Add tag
    const handleAddTag = (rawTag: string) => {
        const trimmed = rawTag.trim();
        if (!trimmed) return;
        const clean = trimmed.replace(/^#/, "");
        const formatted = `#${clean}`;
        // Older tags may be stored without "#", so compare without it
        const alreadyTagged = tags.some(
            (t) => t.replace(/^#/, "").toLowerCase() === clean.toLowerCase(),
        );
        if (!alreadyTagged) {
            setTags([...tags, formatted]);
        }
        setNewTagInput("");
    };

    const handleRemoveTag = (tagToRemove: string) => {
        setTags(tags.filter((t) => t !== tagToRemove));
    };

    // Available recent tags (up to 3 distinct tags not already attached to this expense)
    const availableRecentTags = useMemo(() => {
        return recentTagsList
            .filter(
                (rTag) =>
                    !tags.some(
                        (t) =>
                            t.replace(/^#/, "").toLowerCase() ===
                            rTag.toLowerCase(),
                    ),
            )
            .slice(0, 3);
    }, [recentTagsList, tags]);

    const hasCustomSplit = isShared && splitRatio !== 0.5;

    // Count non-default values hidden in "More" (they keep it open)
    const moreOptionsActiveCount =
        (remarks.trim() ? 1 : 0) +
        (tags.length > 0 ? 1 : 0) +
        (currencyCode !== "SGD" ? 1 : 0) +
        (hasCustomSplit ? 1 : 0);

    // Partner's share preview for the split slider
    const amountInSGD = convertToSGD(
        amount,
        currencyCode,
        customExchangeRate,
    ).amountInSGD;

    // Show the Budget | Goal switch only when there are goals to fund from
    const showFundingSwitch = goals.length > 0 || isGoalSpend;

    // First few goals, plus the selected one if it would otherwise be hidden
    const visibleGoals = useMemo(() => {
        if (showMoreGoals || goals.length <= GOAL_CHIP_LIMIT) return goals;
        const firstGoals = goals.slice(0, GOAL_CHIP_LIMIT);
        const selected = goals.find((g) => g.id === selectedGoalId);
        return selected && !firstGoals.includes(selected)
            ? [...firstGoals, selected]
            : firstGoals;
    }, [goals, showMoreGoals, selectedGoalId]);

    const handleFundingChange = (source: FundingSource) => {
        const toGoal = source === "goal";
        setIsGoalSpend(toGoal);
        // Pre-select only when there's no choice to make
        if (toGoal && !selectedGoalId && goals.length === 1) {
            setSelectedGoalId(goals[0].id);
        }
    };

    // Auto-expand accordion if any nested fields have active values
    const isAccordionExpanded = showMoreOptions || moreOptionsActiveCount > 0;

    // Date shortcut calculations (derived from SGT clock so chips stay fresh across midnight)
    const { today: todayStr } = useSgtClock();
    const yesterdayStr = useMemo(() => addDays(todayStr, -1), [todayStr]);
    const twoDaysAgoStr = useMemo(() => addDays(todayStr, -2), [todayStr]);

    // One-line summary of the defaults hidden in "More", e.g. "Today · Yi Jia · Shared"
    const moreSummary = useMemo(() => {
        const dateLabel =
            date === todayStr
                ? "Today"
                : date === yesterdayStr
                  ? "Yesterday"
                  : date === twoDaysAgoStr
                    ? "2d ago"
                    : formatDisplayDate(date);
        const payerName = members.find((m) => m.id === payerId)?.display_name;
        const splitLabel = !isShared
            ? "Personal"
            : splitRatio !== 0.5
              ? `Shared ${Math.round((1 - splitRatio) * 100)}/${Math.round(splitRatio * 100)}`
              : "Shared";
        return [
            dateLabel,
            payerName,
            splitLabel,
            currencyCode !== "SGD" ? currencyCode : null,
        ]
            .filter(Boolean)
            .join(" · ");
    }, [date, todayStr, yesterdayStr, twoDaysAgoStr, members, payerId, isShared, splitRatio, currencyCode]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (isNaN(amount) || amount <= 0) {
            setErrorMessage(
                "Please enter a valid expense amount greater than 0",
            );
            return;
        }

        if (!item.trim()) {
            setErrorMessage("Please enter a description for this expense");
            return;
        }

        if (isGoalSpend && !selectedGoalId) {
            setErrorMessage(
                "Please select which savings goal funds this expense",
            );
            return;
        }

        // A budget expense needs a category. Old uncategorised expenses can
        // still be edited, unless they're being moved off a goal.
        if (
            !isGoalSpend &&
            !categoryId &&
            categories.length > 0 &&
            (!expense || expense.goal_id)
        ) {
            setErrorMessage("Please pick a category for this expense");
            return;
        }

        const sharedFields = {
            payer_id: payerId,
            category_id: isGoalSpend ? null : categoryId || null,
            item: item.trim(),
            ...buildExpenseFxFields(amount, currencyCode, customExchangeRate),
            remarks: remarks.trim() ? remarks.trim() : null,
            is_shared: isShared,
            split_ratio: isShared ? splitRatio : 0.0,
            goal_id: isGoalSpend ? selectedGoalId || null : null,
        };

        try {
            setIsSubmitting(true);

            if (expense) {
                const updates: UpdateExpenseInput = {
                    ...sharedFields,
                    date: date || expense.date,
                    time: time || null,
                    tags: tags.map((t) => t.trim()).filter(Boolean),
                };
                const updated = await financeService.updateExpense(
                    expense.id,
                    updates,
                );
                if (tags.length > 0) {
                    storeRecentTags(tags);
                }
                feedback.routine("edit");
                onExpenseUpdated?.(updated);
                onClose();
                return;
            }

            const input: CreateExpenseInput = {
                ...sharedFields,
                date: date || todayStr,
                time: time || getCurrentSingaporeTime(),
                tags: tags.length > 0 ? tags : undefined,
            };

            if (linkedInboxId) {
                const linked = inboxItems.find((i) => i.id === linkedInboxId);
                const expenseId = await confirmInboxMutation.mutateAsync({
                    item: {
                        id: linkedInboxId,
                        merchant_key: linked?.merchant_key ?? normalizeMerchant(input.item),
                        suggested_category_id: linked?.suggested_category_id ?? null,
                    },
                    input,
                    via: "edit",
                    guessedCategoryId: linked?.suggested_category_id ?? null,
                });
                if (tags.length > 0) storeRecentTags(tags);
                onExpenseAdded?.(inboxExpenseEventDetail(expenseId, input));
                onClose();
                return;
            }

            storeLastSplit(isShared);

            // Persist tags globally for recent quick suggestions
            if (tags.length > 0) {
                storeRecentTags(tags);
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
                    err instanceof Error ? err.message : "Failed to save expense",
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
                                aria-expanded={showInboxChips || Boolean(linkedInboxId)}
                                onClick={() => setShowInboxChips((prev) => !prev)}
                                className="flex items-center gap-1 mb-1.5 text-[11px] font-bold uppercase tracking-wider text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                            >
                                {`From Inbox (${inboxItems.length})`}
                                {showInboxChips || linkedInboxId ? (
                                    <ChevronUp className="h-3.5 w-3.5" strokeWidth={2.5} />
                                ) : (
                                    <ChevronDown className="h-3.5 w-3.5" strokeWidth={2.5} />
                                )}
                            </button>
                            {(showInboxChips || linkedInboxId) && (
                            <div className="flex flex-wrap gap-1.5" aria-label="From Inbox">
                                {inboxChips.map((chip) => {
                                    const isLinked = chip.id === linkedInboxId;
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
                                                    inboxItemFormValues(chip, {
                                                        categoryId: chip.suggested_category_id ?? null,
                                                        isShared: null,
                                                    }),
                                                );
                                            }}
                                            className={`flex min-h-10 max-w-full items-center gap-1.5 rounded-xl border-2 border-(--border-ink) px-2.5 py-1 text-xs font-bold transition-all active:translate-x-0.5 active:translate-y-0.5 cursor-pointer ${
                                                isLinked
                                                    ? "bg-(--pastel-mint-light) shadow-cute-sm"
                                                    : "bg-(--bg-card) hover:bg-(--bg-cream)"
                                            }`}
                                        >
                                            <TruncatedText text={chip.merchant} className="min-w-0 max-w-32" />
                                            <span className="shrink-0 font-mono-num text-(--text-muted)">
                                                {formatForeignAmount(chip.amount, chip.currency)}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                            )}
                        </div>
                    )}

                    {/* Amount Input Header with Inline Currency Selector */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label
                                htmlFor="expense-amount"
                                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)"
                            >
                                Amount
                            </label>
                        </div>

                        {/* ATM / Cashier Cents-First Amount Input */}
                        <CentsFirstAmountInput
                            id="expense-amount"
                            value={amount}
                            onChange={(newAmt) => setAmount(newAmt)}
                            currencySymbol={selectedCurrency.symbol}
                            currencyCode={currencyCode}
                            autoFocus
                        />

                    </div>

                    {/* Funding source (Budget | Goal) with its picker right below */}
                    <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                            {showFundingSwitch ? (
                                <div className="flex min-w-0 items-center gap-1">
                                    <SegmentedTabs<FundingSource>
                                        size="sm"
                                        ariaLabel="Funding Source"
                                        activeTab={isGoalSpend ? "goal" : "budget"}
                                        onChange={handleFundingChange}
                                        tabs={[
                                            { id: "budget", label: "Budget" },
                                            {
                                                id: "goal",
                                                label: "Goal",
                                                icon: (
                                                    <Target
                                                        className="h-3.5 w-3.5"
                                                        strokeWidth={2.5}
                                                    />
                                                ),
                                            },
                                        ]}
                                    />
                                    <TooltipPopover
                                        title="Goal Funding"
                                        ariaLabel="Goal funding info"
                                        align="left"
                                        className="shrink-0"
                                    >
                                        Paid from goal savings. Excluded from caps.
                                    </TooltipPopover>
                                </div>
                            ) : (
                                <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                                    Category
                                </span>
                            )}
                            <div className="shrink-0">
                                {isGoalSpend
                                    ? goals.length > GOAL_CHIP_LIMIT && (
                                          <button
                                              type="button"
                                              onClick={() =>
                                                  setShowMoreGoals(
                                                      (prev) => !prev,
                                                  )
                                              }
                                              className="text-[11px] font-bold text-(--text-muted) hover:text-(--text-ink) underline cursor-pointer"
                                          >
                                              {showMoreGoals
                                                  ? "Show less"
                                                  : `+ More (${goals.length - GOAL_CHIP_LIMIT})`}
                                          </button>
                                      )
                                    : allocationCategories.length > 0 && (
                                          <button
                                              type="button"
                                              onClick={() =>
                                                  setShowMoreCategories(
                                                      (prev) => !prev,
                                                  )
                                              }
                                              className="text-[11px] font-bold text-(--text-muted) hover:text-(--text-ink) underline cursor-pointer"
                                          >
                                              {showMoreCategories
                                                  ? "Spendable only"
                                                  : `+ More (${allocationCategories.length})`}
                                          </button>
                                      )}
                            </div>
                        </div>

                        {isGoalSpend ? (
                            <div
                                className="flex flex-wrap gap-1.5"
                                aria-label="Goal Selection"
                            >
                                {goals.length === 0 ? (
                                    <div className="py-2 text-center w-full">
                                        <p className="text-xs font-bold text-(--text-ink)">No Goals</p>
                                        <p className="text-xs text-(--text-muted) mt-0.5">Create a goal to link this expense.</p>
                                        <a
                                            href="/goals"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                onClose();
                                                if (typeof window !== "undefined") {
                                                    window.location.href = "/goals";
                                                }
                                            }}
                                            className="mt-1.5 inline-flex items-center gap-1 text-xs font-bold text-purple-700 dark:text-purple-400 hover:underline cursor-pointer"
                                        >
                                            <Plus className="h-3 w-3 stroke-3" />
                                            <span>Add Goal</span>
                                        </a>
                                    </div>
                                ) : (
                                    visibleGoals.map((g) => {
                                        const isSelected =
                                            selectedGoalId === g.id;
                                        return (
                                            <button
                                                key={g.id}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() =>
                                                    setSelectedGoalId(g.id)
                                                }
                                                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold"
                                                        : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle) font-medium"
                                                }`}
                                            >
                                                <span
                                                    role="img"
                                                    aria-label={g.title}
                                                    className="text-xs shrink-0"
                                                >
                                                    {g.emoji || "🎯"}
                                                </span>
                                                <span>{g.title}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div
                                className="flex flex-wrap gap-1.5"
                                aria-label="Category Selection"
                            >
                                {visibleCategories.map((cat) => {
                                    const isSelected = categoryId === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => {
                                                setCategoryId(cat.id);
                                                setCategoryManuallySelected(
                                                    true,
                                                );
                                            }}
                                            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                                                isSelected
                                                    ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold"
                                                    : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle) font-medium"
                                            }`}
                                        >
                                            <span
                                                className="h-2 w-2 rounded-full border border-black/20"
                                                style={{
                                                    backgroundColor:
                                                        cat.color || "#dfc2ff",
                                                }}
                                            />
                                            <span>{cat.name}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Clean Item / Description Input (No suggestions bar) */}
                    <div>
                        <label
                            htmlFor="expense-item"
                            className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Description
                        </label>
                        <input
                            id="expense-item"
                            type="text"
                            placeholder="e.g., FairPrice Groceries, Grab, Lunch"
                            value={item}
                            onChange={(e) =>
                                handleItemTextChange(e.target.value)
                            }
                            required
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-base sm:text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* "More": secondary fields with their defaults summarised */}
                    <div className="border-t border-(--border-subtle) pt-2">
                        <button
                            type="button"
                            onClick={() => setShowMoreOptions((prev) => !prev)}
                            aria-expanded={isAccordionExpanded}
                            className="flex w-full items-center justify-between py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                        >
                            <div className="flex min-w-0 items-center gap-2">
                                <span className="shrink-0">More</span>
                                <span
                                    data-testid="expense-more-summary"
                                    className="truncate font-semibold text-(--text-faint)"
                                >
                                    {moreSummary}
                                </span>
                                {moreOptionsActiveCount > 0 && (
                                    <span className="shrink-0 rounded-full bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) px-2 py-0.5 text-[10px] font-bold">
                                        {moreOptionsActiveCount} active
                                    </span>
                                )}
                            </div>
                            {isAccordionExpanded ? (
                                <ChevronUp className="h-4 w-4 shrink-0 text-(--text-muted)" />
                            ) : (
                                <ChevronDown className="h-4 w-4 shrink-0 text-(--text-muted)" />
                            )}
                        </button>

                        <div
                            className={
                                isAccordionExpanded
                                    ? "space-y-4 pt-2"
                                    : "hidden"
                            }
                        >
                            {/* 1-Tap Date Chips + Compact Date & Time Pickers */}
                            <div className="space-y-1.5">
                                <label
                                    htmlFor="expense-date"
                                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)"
                                >
                                    Date & Time
                                </label>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                    <button
                                        type="button"
                                        aria-pressed={date === todayStr}
                                        onClick={() => {
                                            setDate(todayStr);
                                            setTime(getCurrentSingaporeTime());
                                        }}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                            date === todayStr
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                                : "bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) border border-(--border-subtle)"
                                        }`}
                                    >
                                        Today
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={date === yesterdayStr}
                                        onClick={() => setDate(yesterdayStr)}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                            date === yesterdayStr
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                                : "bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) border border-(--border-subtle)"
                                        }`}
                                    >
                                        Yesterday
                                    </button>
                                    <button
                                        type="button"
                                        aria-pressed={date === twoDaysAgoStr}
                                        onClick={() => setDate(twoDaysAgoStr)}
                                        className={`rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                            date === twoDaysAgoStr
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                                : "bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) border border-(--border-subtle)"
                                        }`}
                                    >
                                        2d ago
                                    </button>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap pt-0.5">
                                    <div className="relative flex items-center flex-1 min-w-32">
                                        <input
                                            id="expense-date"
                                            type="date"
                                            aria-label="Custom Date"
                                            value={date}
                                            onChange={(e) => setDate(e.target.value)}
                                            required
                                            className="w-full rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2 py-1 text-base sm:text-xs font-mono-num font-semibold text-(--text-ink) cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            id="expense-time"
                                            type="time"
                                            aria-label="Expense Time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2 py-1 text-base sm:text-xs font-mono-num font-semibold text-(--text-ink) cursor-pointer"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setTime(getCurrentSingaporeTime())
                                            }
                                            className="rounded-lg px-2 py-1 text-xs font-bold bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) hover:text-(--text-ink) border border-(--border-subtle) transition-all cursor-pointer"
                                            title="Reset to current time"
                                        >
                                            Now
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Payer Selection & 2-Button Segmented Personal/Shared Toggle */}
                            <div className="space-y-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-2.5 shadow-cute-sm">
                                {/* Payer Toggle */}
                                {members.length > 0 && (
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <span className="text-[11px] font-bold text-(--text-muted)">
                                            Payer:
                                        </span>
                                        <div
                                            className="flex gap-1.5"
                                            aria-label="Payer Selection"
                                        >
                                            {members.map((member) => {
                                                const isSelected =
                                                    payerId === member.id;
                                                return (
                                                    <button
                                                        key={member.id}
                                                        type="button"
                                                        aria-pressed={isSelected}
                                                        onClick={() =>
                                                            setPayerId(member.id)
                                                        }
                                                        className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                                            isSelected
                                                                ? "bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                                                : "bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                                        }`}
                                                    >
                                                        <span>
                                                            {member.avatar_url ||
                                                                "👤"}
                                                        </span>
                                                        <span>
                                                            {member.display_name}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {/* 2-Button Segmented Personal / Shared Toggle */}
                                <div>
                                    {/* Hidden input for backwards-compatibility with test queries */}
                                    <input
                                        id="expense-shared-toggle"
                                        type="checkbox"
                                        aria-label="Shared"
                                        checked={isShared}
                                        onChange={(e) => setIsShared(e.target.checked)}
                                        className="sr-only"
                                    />

                                    <div
                                        role="group"
                                        aria-label="Expense Split Type"
                                        className="flex rounded-xl bg-(--bg-canvas) p-1 border-2 border-(--border-ink)"
                                    >
                                        <button
                                            type="button"
                                            aria-pressed={!isShared}
                                            onClick={() => setIsShared(false)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                                !isShared
                                                    ? "bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) shadow-cute-sm"
                                                    : "text-(--text-muted) hover:text-(--text-ink)"
                                            }`}
                                        >
                                            <span>👤</span>
                                            <span>Personal</span>
                                        </button>
                                        <button
                                            type="button"
                                            aria-pressed={isShared}
                                            onClick={() => setIsShared(true)}
                                            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                                                isShared
                                                    ? "bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) shadow-cute-sm"
                                                    : "text-(--text-muted) hover:text-(--text-ink)"
                                            }`}
                                        >
                                            <span>👥</span>
                                            <span>Shared</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Partner's share of a shared expense */}
                                {isShared && (
                                    <div className="space-y-1 pt-1">
                                        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-(--text-muted)">
                                            <label htmlFor="expense-split-ratio">
                                                Partner's share
                                            </label>
                                            <span className="shrink-0 text-(--text-ink)">
                                                {Math.round(splitRatio * 100)}% (
                                                <CurrencyText
                                                    amount={amountInSGD * splitRatio}
                                                />
                                                )
                                            </span>
                                        </div>
                                        <input
                                            id="expense-split-ratio"
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.05"
                                            value={splitRatio}
                                            onChange={(e) =>
                                                setSplitRatio(
                                                    parseFloat(e.target.value),
                                                )
                                            }
                                            className="w-full cursor-pointer accent-(--pastel-lilac)"
                                        />
                                        <div className="flex justify-between text-[10px] text-(--text-muted)">
                                            <span>0%</span>
                                            <button
                                                type="button"
                                                onClick={() => setSplitRatio(0.5)}
                                                className="font-semibold text-(--text-ink) hover:underline cursor-pointer"
                                            >
                                                50/50
                                            </button>
                                            <span>100%</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Currency */}
                            <div>
                                <span className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                                    Currency
                                </span>
                                    {/* Inline Currency Selector Dropdown Pill */}
                                    <div className="relative flex w-fit items-center">
                                        <select
                                            aria-label="Select currency"
                                            value={currencyCode}
                                            onChange={(e) => {
                                                setCurrencyCode(e.target.value);
                                                setCustomExchangeRate(undefined);
                                            }}
                                            className="appearance-none rounded-full bg-(--bg-canvas) text-base sm:text-xs font-bold pl-3 pr-8 py-1 text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink) cursor-pointer focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                        >
                                            {SUPPORTED_CURRENCIES.map((c) => (
                                                <option key={c.code} value={c.code}>
                                                    {c.flag} {c.code} ({c.symbol})
                                                </option>
                                            ))}
                                        </select>
                                        <ChevronDown
                                            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-(--text-muted)"
                                            strokeWidth={2.5}
                                        />
                                    </div>
                                {/* Foreign Currency Live Conversion Preview & Editable Rate */}
                                {currencyCode !== "SGD" && (
                                    <FxRateField
                                        currencyCode={currencyCode}
                                        foreignAmount={amount}
                                        customRate={customExchangeRate}
                                        onCustomRateChange={setCustomExchangeRate}
                                    />
                                )}
                            </div>

                            {/* Dedicated Inline Remarks / Notes */}
                            <div>
                                <label
                                    htmlFor="expense-remarks"
                                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                >
                                    Notes
                                </label>
                                <input
                                    id="expense-remarks"
                                    type="text"
                                    placeholder="Optional notes or context..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-base sm:text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                />
                            </div>

                            {/* Tag Picker (#tags) + up to 3 most recent used tags */}
                            <div>
                                <label
                                    htmlFor="expense-tag-input"
                                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                >
                                    Tags
                                </label>

                                {tags.length > 0 && (
                                    <div className="flex flex-wrap items-center gap-1.5 mb-2">
                                        {tags.map((tag) => (
                                            <span
                                                key={tag}
                                                className="inline-flex items-center gap-1 rounded-full bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink) px-2.5 py-0.5 text-[11px] font-bold"
                                            >
                                                <span>#{tag.replace(/^#/, "")}</span>
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleRemoveTag(tag)
                                                    }
                                                    aria-label={`Remove tag ${tag}`}
                                                    className="text-(--text-muted) hover:text-rose-600 cursor-pointer ml-0.5"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                <div className="flex items-center gap-1.5">
                                    <div className="relative flex-1">
                                        <Hash className="absolute left-2.5 top-2 h-3.5 w-3.5 text-(--text-muted)" />
                                        <input
                                            id="expense-tag-input"
                                            type="text"
                                            placeholder="e.g. VietnamTrip, Reimbursable"
                                            value={newTagInput}
                                            onChange={(e) =>
                                                setNewTagInput(e.target.value)
                                            }
                                            onKeyDown={(e) => {
                                                if (e.key === "Enter") {
                                                    e.preventDefault();
                                                    handleAddTag(newTagInput);
                                                }
                                            }}
                                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-8 pr-3 py-1.5 text-base sm:text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleAddTag(newTagInput)
                                        }
                                        className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 text-(--text-ink) px-3 py-1.5 text-xs font-bold cursor-pointer transition-all"
                                    >
                                        + Tag
                                    </button>
                                </div>

                                {/* Up to 3 most recent used tags as quick-tap pills */}
                                {availableRecentTags.length > 0 && (
                                    <div className="flex items-center gap-1.5 flex-wrap pt-2">
                                        <span className="text-[10px] font-bold text-(--text-muted) uppercase">
                                            Recent:
                                        </span>
                                        {availableRecentTags.map((rTag) => (
                                            <button
                                                key={rTag}
                                                type="button"
                                                aria-label={`Add tag ${rTag.replace(/^#/, "")}`}
                                                onClick={() =>
                                                    handleAddTag(rTag)
                                                }
                                                className="inline-flex items-center gap-1 rounded-full bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink) px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer shadow-cute-sm"
                                            >
                                                <span>
                                                    + #{rTag.replace(/^#/, "")}
                                                </span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="secondary"
                        type="button"
                        onClick={onClose}
                    >
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
