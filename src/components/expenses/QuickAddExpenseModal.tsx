/**
 * Add Expense Modal
 * Minimal by default: Amount, Category and Description.
 * Everything else sits in a collapsed "More" section with smart defaults
 * (today, current member as payer, last split used), summarised on its toggle:
 * - Date chips (Today, Yesterday, 2d ago) + date/time pickers
 * - Payer and Personal / Shared (50/50) split
 * - Currency with FX conversion
 * - Fund from Savings Goal
 * - Remarks and #tags
 * "More" opens automatically when any of its non-default fields is set.
 */

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Plus, Hash, Target, ChevronDown, ChevronUp } from "lucide-react";
import { useHousehold } from "../../context/HouseholdContext";
import { financeService } from "../../services/financeService";
import {
    getTodayDateString,
    getSingaporeDate,
    formatISODate,
    formatDisplayDate,
    getCurrentSingaporeTime,
} from "../../lib/dateUtils";
import { isSpendableCategory } from "../../lib/financialFormulas";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import {
    SUPPORTED_CURRENCIES,
    buildExpenseFxFields,
} from "../../lib/currencyConverter";
import { FxRateField } from "./FxRateField";
import type {
    Category,
    HouseholdMember,
    Expense,
    CreateExpenseInput,
    SavingsGoal,
} from "../../types/finance";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "../ui/AnimatedModal";
import { Button } from "../ui/Button";
import { Alert } from "../ui/Alert";
import { CentsFirstAmountInput } from "./CentsFirstAmountInput";

export interface QuickAddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExpenseAdded?: (expense: Expense) => void;
    defaultPayerId?: string;
    defaultShared?: boolean;
    categories?: Category[];
    members?: HouseholdMember[];
    goals?: SavingsGoal[];
}

const GLOBAL_RECENT_TAGS_STORAGE_KEY = "budget_bubby_recent_tags_global_v2";
const LAST_SPLIT_STORAGE_KEY = "budget_bubby_last_split_v1";

function getStoredLastSplit(): boolean | undefined {
    try {
        const raw = window.localStorage.getItem(LAST_SPLIT_STORAGE_KEY);
        if (raw === "shared") return true;
        if (raw === "personal") return false;
    } catch {
        // Ignore localStorage errors
    }
    return undefined;
}

function storeLastSplit(isShared: boolean) {
    try {
        window.localStorage.setItem(LAST_SPLIT_STORAGE_KEY, isShared ? "shared" : "personal");
    } catch {
        // Ignore localStorage errors
    }
}

// Category keyword matching rules for smart auto-detection
const KEYWORD_CATEGORY_MAP: { keywords: string[]; categoryKey: string }[] = [
    {
        keywords: [
            "grab",
            "gojek",
            "mrt",
            "bus",
            "taxi",
            "comfortdelgro",
            "parking",
            "petrol",
            "ez-link",
            "ezlink",
            "simplygo",
            "transit",
            "fuel",
            "tada",
        ],
        categoryKey: "transport",
    },
    {
        keywords: [
            "lunch",
            "dinner",
            "breakfast",
            "coffee",
            "cafe",
            "hawker",
            "food",
            "groceries",
            "fairprice",
            "cold storage",
            "sheng siong",
            "shengsiong",
            "breadtalk",
            "toast box",
            "yakun",
            "starbucks",
            "kfc",
            "mcdonalds",
            "macdonalds",
            "bubble tea",
            "koi",
            "liho",
            "snack",
            "restaurant",
            "subway",
        ],
        categoryKey: "food",
    },
    {
        keywords: [
            "shopping",
            "movie",
            "cinema",
            "gym",
            "netflix",
            "spotify",
            "date night",
            "personal care",
            "gifts",
            "uniqlo",
            "zara",
            "shopee",
            "lazada",
            "entertainment",
            "games",
            "haircut",
        ],
        categoryKey: "lifestyle",
    },
    {
        keywords: [
            "clinic",
            "pharmacy",
            "doctor",
            "hospital",
            "panadol",
            "watsons",
            "guardian",
            "utilities",
            "repair",
            "sp services",
            "maintenance",
            "dentist",
        ],
        categoryKey: "buffer",
    },
];

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

export function QuickAddExpenseModal({
    isOpen,
    onClose,
    onExpenseAdded,
    defaultPayerId,
    defaultShared,
    categories: propCategories,
    members: propMembers,
    goals: propGoals,
}: QuickAddExpenseModalProps) {
    const { members: ctxMembers, activeMember, perspective } = useHousehold();

    const members =
        propMembers && propMembers.length > 0
            ? propMembers
            : ctxMembers && ctxMembers.length > 0
              ? ctxMembers
              : mockMembers;

    const categories =
        propCategories && propCategories.length > 0
            ? propCategories
            : mockCategories;

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
        return members[0]?.id || "";
    });
    const [isShared, setIsShared] = useState<boolean>(resolvedDefaultShared);

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

    // Goals State
    const [activeGoals, setActiveGoals] = useState<SavingsGoal[]>(
        propGoals || [],
    );
    const [selectedGoalId, setSelectedGoalId] = useState<string>("");
    const [isGoalSpend, setIsGoalSpend] = useState<boolean>(false);
    const [showMoreGoals, setShowMoreGoals] = useState<boolean>(false);

    // Accordion State
    const [showMoreOptions, setShowMoreOptions] = useState<boolean>(false);

    // Submission State
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Fetch active goals if not supplied in props
    useEffect(() => {
        if (propGoals) {
            setActiveGoals(propGoals);
            return;
        }
        let isMounted = true;
        financeService
            .getGoals()
            .then((g) => {
                if (isMounted && g) {
                    setActiveGoals(g);
                }
            })
            .catch(() => {});
        return () => {
            isMounted = false;
        };
    }, [propGoals, isOpen]);

    // Reset form and sync recent tags on open
    useEffect(() => {
        if (isOpen) {
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
                    (activeMember ? activeMember.id : members[0]?.id || ""),
            );
            setIsShared(
                defaultShared ?? getStoredLastSplit() ?? perspective === "household",
            );
            setDate(getTodayDateString());
            setTime(getCurrentSingaporeTime());
            setRemarks("");
            setTags([]);
            setNewTagInput("");
            setSelectedGoalId("");
            setIsGoalSpend(false);
            setShowMoreGoals(false);
            setShowMoreOptions(false);
            setRecentTagsList(getStoredRecentTags());
            setErrorMessage(null);
            setIsSubmitting(false);
        }
    }, [
        isOpen,
        defaultPayerId,
        defaultShared,
        activeMember,
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
            const lower = text.toLowerCase();
            for (const map of KEYWORD_CATEGORY_MAP) {
                if (map.keywords.some((kw) => lower.includes(kw))) {
                    const match = categories.find((c) =>
                        c.name.toLowerCase().includes(map.categoryKey),
                    );
                    if (match) {
                        setCategoryId(match.id);
                        break;
                    }
                }
            }
        }
    };

    // Add tag
    const handleAddTag = (rawTag: string) => {
        const trimmed = rawTag.trim();
        if (!trimmed) return;
        const clean = trimmed.replace(/^#/, "");
        const formatted = `#${clean}`;
        if (!tags.includes(formatted)) {
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

    // Count non-default values hidden in "More" (they keep it open)
    const moreOptionsActiveCount =
        (remarks.trim() ? 1 : 0) +
        (tags.length > 0 ? 1 : 0) +
        (currencyCode !== "SGD" ? 1 : 0) +
        (isGoalSpend ? 1 : 0);

    // Auto-expand accordion if any nested fields have active values
    const isAccordionExpanded = showMoreOptions || moreOptionsActiveCount > 0;

    // Date shortcut calculations
    const todayStr = useMemo(() => getTodayDateString(), []);
    const yesterdayStr = useMemo(() => {
        const d = getSingaporeDate();
        d.setDate(d.getDate() - 1);
        return formatISODate(d);
    }, []);
    const twoDaysAgoStr = useMemo(() => {
        const d = getSingaporeDate();
        d.setDate(d.getDate() - 2);
        return formatISODate(d);
    }, []);

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
        return [
            dateLabel,
            payerName,
            isShared ? "Shared" : "Personal",
            currencyCode !== "SGD" ? currencyCode : null,
        ]
            .filter(Boolean)
            .join(" · ");
    }, [date, todayStr, yesterdayStr, twoDaysAgoStr, members, payerId, isShared, currencyCode]);

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

        try {
            setIsSubmitting(true);

            const input: CreateExpenseInput = {
                payer_id: payerId,
                category_id: isGoalSpend ? null : categoryId || null,
                date: date || todayStr,
                time: time || getCurrentSingaporeTime(),
                item: item.trim(),
                ...buildExpenseFxFields(
                    amount,
                    currencyCode,
                    customExchangeRate,
                ),
                remarks: remarks.trim() ? remarks.trim() : null,
                is_shared: isShared,
                split_ratio: isShared ? 0.5 : 0.0,
                tags: tags.length > 0 ? tags : undefined,
                goal_id: isGoalSpend ? selectedGoalId || null : null,
            };

            const created = await financeService.addExpense(input);

            storeLastSplit(isShared);

            // Persist tags globally for recent quick suggestions
            if (tags.length > 0) {
                storeRecentTags(tags);
            }

            // Dispatch global event for celebration toast, sound & category alerts
            if (typeof window !== "undefined") {
                window.dispatchEvent(
                    new CustomEvent("expenseAdded", { detail: created }),
                );
            }

            onExpenseAdded?.(created);
            onClose();
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
                    title="Add Expense"
                    icon={<Plus className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error Alert */}
                    {errorMessage && (
                        <Alert variant="danger">{errorMessage}</Alert>
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

                    {/* Category or Goal Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                                {isGoalSpend ? "Goal" : "Category"}
                            </span>
                            <div>
                                {isGoalSpend
                                    ? activeGoals.length > 4 && (
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
                                                  : `+ More (${activeGoals.length - 4})`}
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
                                {activeGoals.length === 0 ? (
                                    <p className="text-xs text-(--text-muted) py-1">
                                        No active savings goals found.
                                    </p>
                                ) : (
                                    (showMoreGoals
                                        ? activeGoals
                                        : activeGoals.slice(0, 4)
                                    ).map((g) => {
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
                                                        ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) font-bold"
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
                                                    ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm) font-bold"
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
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
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
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)"
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
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)"
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
                                                ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)"
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
                                            className="w-full rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2 py-1 text-xs font-mono-num font-semibold text-(--text-ink) cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <input
                                            id="expense-time"
                                            type="time"
                                            aria-label="Expense Time"
                                            value={time}
                                            onChange={(e) => setTime(e.target.value)}
                                            className="rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2 py-1 text-xs font-mono-num font-semibold text-(--text-ink) cursor-pointer"
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
                            <div className="space-y-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-2.5 shadow-(--shadow-cute-sm)">
                                {/* Payer Toggle */}
                                <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                    <span className="text-[11px] font-bold text-(--text-muted)">
                                        Payer:
                                    </span>
                                    <div
                                        className="flex gap-1.5"
                                        aria-label="Payer Selection"
                                    >
                                        {members.map((member) => {
                                            const isSelected = payerId === member.id;
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
                                                            ? "bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-(--shadow-cute-sm)"
                                                            : "bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                                    }`}
                                                >
                                                    <span>
                                                        {member.avatar_url || "👤"}
                                                    </span>
                                                    <span>{member.display_name}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

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
                                                    ? "bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) shadow-(--shadow-cute-sm)"
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
                                                    ? "bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) shadow-(--shadow-cute-sm)"
                                                    : "text-(--text-muted) hover:text-(--text-ink)"
                                            }`}
                                        >
                                            <span>👥</span>
                                            <span>Shared (50/50)</span>
                                        </button>
                                    </div>
                                </div>
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
                                            className="appearance-none rounded-full bg-(--bg-canvas) text-xs font-bold pl-3 pr-8 py-1 text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink) cursor-pointer focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
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

                            {/* Goal Spend Full-Width Toggle Card */}
                            {activeGoals.length > 0 && (
                                <div
                                    onClick={() => {
                                        const next = !isGoalSpend;
                                        setIsGoalSpend(next);
                                        if (
                                            next &&
                                            !selectedGoalId &&
                                            activeGoals.length > 0
                                        ) {
                                            setSelectedGoalId(activeGoals[0].id);
                                        }
                                        if (!next) {
                                            setSelectedGoalId("");
                                        }
                                    }}
                                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 shadow-(--shadow-cute-sm) ${
                                        isGoalSpend
                                            ? "bg-(--pastel-lilac-light) border-(--border-ink)"
                                            : "bg-(--bg-card) border-(--border-subtle) hover:border-(--border-ink)"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-(--border-ink) ${
                                                isGoalSpend
                                                    ? "bg-(--pastel-lilac)"
                                                    : "bg-(--bg-canvas)"
                                            }`}
                                        >
                                            <Target
                                                strokeWidth={2.5}
                                                className={`h-4 w-4 ${
                                                    isGoalSpend
                                                        ? "text-(--text-ink)"
                                                        : "text-(--text-muted)"
                                                }`}
                                            />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="text-xs font-black text-(--text-ink) font-display flex items-center gap-1.5">
                                                <span>Fund from Savings Goal</span>
                                                {isGoalSpend && (
                                                    <span className="text-[10px] font-bold text-purple-700 dark:text-purple-300 bg-(--pastel-lilac) px-1.5 py-0.2 rounded border border-(--border-ink)">
                                                        Active
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[10px] text-(--text-muted) truncate mt-0.5">
                                                Excludes from monthly budget caps
                                            </p>
                                        </div>
                                    </div>

                                    {/* Tactile Sliding Switch Pill */}
                                    <button
                                        type="button"
                                        role="switch"
                                        aria-checked={isGoalSpend}
                                        aria-label="Fund from Savings Goal"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            const next = !isGoalSpend;
                                            setIsGoalSpend(next);
                                            if (
                                                next &&
                                                !selectedGoalId &&
                                                activeGoals.length > 0
                                            ) {
                                                setSelectedGoalId(activeGoals[0].id);
                                            }
                                            if (!next) {
                                                setSelectedGoalId("");
                                            }
                                        }}
                                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                            isGoalSpend
                                                ? "bg-(--pastel-lilac)"
                                                : "bg-slate-200 dark:bg-slate-700"
                                        }`}
                                    >
                                        <span
                                            aria-hidden="true"
                                            className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-(--shadow-cute-sm) border border-(--border-ink) transition duration-200 ease-in-out ${
                                                isGoalSpend
                                                    ? "translate-x-5"
                                                    : "translate-x-0.5"
                                            }`}
                                        />
                                    </button>
                                </div>
                            )}

                            {/* Dedicated Inline Remarks / Notes */}
                            <div>
                                <label
                                    htmlFor="expense-remarks"
                                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
                                >
                                    Remarks / Notes
                                </label>
                                <input
                                    id="expense-remarks"
                                    type="text"
                                    placeholder="Optional notes or context..."
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
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
                                                <span>{tag}</span>
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
                                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) pl-8 pr-3 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            handleAddTag(newTagInput)
                                        }
                                        className="rounded-xl border-2 border-(--border-ink) bg-(--bg-card) hover:bg-(--pastel-butter-light) shadow-(--shadow-cute-sm) active:translate-x-0.5 active:translate-y-0.5 text-(--text-ink) px-3 py-1.5 text-xs font-bold cursor-pointer transition-all"
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
                                                className="inline-flex items-center gap-1 rounded-full bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink) px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer shadow-(--shadow-cute-sm)"
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
                        leftIcon={<Plus className="h-4 w-4" strokeWidth={2.5} />}
                    >
                        {isSubmitting ? "Saving..." : "Add Expense"}
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default QuickAddExpenseModal;
