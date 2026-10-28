/**
 * Quick Add Expense Modal
 * Fast, mobile-optimized modal with:
 * - AnimatedModal wrapper + standardized ModalHeader / ModalBody / ModalFooter
 * - CentsFirstAmountInput (ATM cashier-style digits input)
 * - Multi-currency FX conversion (SGD, VND, JPY, MYR, THB, USD, EUR, etc.) with live preview
 * - 2-button segmented toggle: 👤 Personal | 👥 Shared (50/50)
 * - Smart category auto-detection on typing
 * - 1-tap Date chips (Today, Yesterday, 2d ago) + compact date picker
 * - Expandable "More options" accordion for secondary details:
 *   - Inline remarks/notes input
 *   - Tag picker (#tags) with up to 3 most recent global tags
 *   - "Funded by Goal" linking
 */

import { useState, useEffect, useMemo, type FormEvent } from "react";
import { Plus, Hash, Target, ChevronDown, ChevronUp } from "lucide-react";
import { useHousehold } from "../../context/HouseholdContext";
import { financeService } from "../../services/financeService";
import { getTodayDateString, getSingaporeDate, formatISODate } from "../../lib/dateUtils";
import { isSpendableCategory } from "../../lib/financialFormulas";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import {
    SUPPORTED_CURRENCIES,
    convertToSGD,
} from "../../lib/currencyConverter";
import type { Category, HouseholdMember, Expense, CreateExpenseInput, SavingsGoal } from "../../types/finance";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
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

// Category keyword matching rules for smart auto-detection
const KEYWORD_CATEGORY_MAP: { keywords: string[]; categoryKey: string }[] = [
    {
        keywords: [
            "grab", "gojek", "mrt", "bus", "taxi", "comfortdelgro", "parking",
            "petrol", "ez-link", "ezlink", "simplygo", "transit", "fuel", "tada",
        ],
        categoryKey: "transport",
    },
    {
        keywords: [
            "lunch", "dinner", "breakfast", "coffee", "cafe", "hawker", "food",
            "groceries", "fairprice", "cold storage", "sheng siong", "shengsiong",
            "breadtalk", "toast box", "yakun", "starbucks", "kfc", "mcdonalds",
            "macdonalds", "bubble tea", "koi", "liho", "snack", "restaurant", "subway",
        ],
        categoryKey: "food",
    },
    {
        keywords: [
            "shopping", "movie", "cinema", "gym", "netflix", "spotify",
            "date night", "personal care", "gifts", "uniqlo", "zara", "shopee",
            "lazada", "entertainment", "games", "haircut",
        ],
        categoryKey: "lifestyle",
    },
    {
        keywords: [
            "clinic", "pharmacy", "doctor", "hospital", "panadol", "watsons",
            "guardian", "utilities", "repair", "sp services", "maintenance", "dentist",
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
    if (typeof window === "undefined" || !window.localStorage || !newTags.length) return;
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

    // Default to Personal when in Personal perspective, or Shared when in Combined view (unless overridden)
    const resolvedDefaultShared =
        defaultShared !== undefined ? defaultShared : perspective === "household";

    // Amount & Currency State
    const [amount, setAmount] = useState<number>(0);
    const [currencyCode, setCurrencyCode] = useState<string>("SGD");
    const [customExchangeRate, setCustomExchangeRate] = useState<number | undefined>(undefined);

    // Item & Category State
    const [item, setItem] = useState<string>("");
    const [categoryId, setCategoryId] = useState<string>(
        spendableCategories[0]?.id || categories[0]?.id || "",
    );
    const [categoryManuallySelected, setCategoryManuallySelected] = useState<boolean>(false);
    const [showMoreCategories, setShowMoreCategories] = useState<boolean>(false);

    // Payer & Shared State
    const [payerId, setPayerId] = useState<string>(() => {
        if (defaultPayerId) return defaultPayerId;
        if (activeMember) return activeMember.id;
        return members[0]?.id || "";
    });
    const [isShared, setIsShared] = useState<boolean>(resolvedDefaultShared);

    // Date & Notes State
    const [date, setDate] = useState<string>(getTodayDateString());
    const [remarks, setRemarks] = useState<string>("");

    // Tags State
    const [tags, setTags] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState<string>("");
    const [recentTagsList, setRecentTagsList] = useState<string[]>(() => getStoredRecentTags());

    // Goals State
    const [activeGoals, setActiveGoals] = useState<SavingsGoal[]>(propGoals || []);
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
            setCategoryId(spendableCategories[0]?.id || categories[0]?.id || "");
            setCategoryManuallySelected(false);
            setShowMoreCategories(false);
            setPayerId(defaultPayerId || (activeMember ? activeMember.id : members[0]?.id || ""));
            setIsShared(defaultShared !== undefined ? defaultShared : perspective === "household");
            setDate(getTodayDateString());
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
        () => SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) || SUPPORTED_CURRENCIES[0],
        [currencyCode],
    );

    const fxConversion = useMemo(() => {
        if (currencyCode === "SGD") {
            return { amountInSGD: amount, exchangeRate: 1 };
        }
        return convertToSGD(amount, currencyCode, customExchangeRate);
    }, [amount, currencyCode, customExchangeRate]);

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
                        (t) => t.replace(/^#/, "").toLowerCase() === rTag.toLowerCase(),
                    ),
            )
            .slice(0, 3);
    }, [recentTagsList, tags]);

    // Count active items in the "More options" accordion
    const moreOptionsActiveCount =
        (remarks.trim() ? 1 : 0) +
        (tags.length > 0 ? 1 : 0);

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

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setErrorMessage(null);

        if (isNaN(amount) || amount <= 0) {
            setErrorMessage("Please enter a valid expense amount greater than 0");
            return;
        }

        if (!item.trim()) {
            setErrorMessage("Please enter a description for this expense");
            return;
        }

        if (isGoalSpend && !selectedGoalId) {
            setErrorMessage("Please select which savings goal funds this expense");
            return;
        }

        try {
            setIsSubmitting(true);

            const finalAmountInSGD = currencyCode === "SGD" ? amount : fxConversion.amountInSGD;
            const finalExchangeRate = currencyCode === "SGD" ? 1 : fxConversion.exchangeRate;

            const input: CreateExpenseInput = {
                payer_id: payerId,
                category_id: isGoalSpend ? null : (categoryId || null),
                date: date || todayStr,
                item: item.trim(),
                amount: finalAmountInSGD,
                remarks: remarks.trim() ? remarks.trim() : null,
                is_shared: isShared,
                split_ratio: isShared ? 0.5 : 0.0,
                tags: tags.length > 0 ? tags : undefined,
                goal_id: isGoalSpend ? (selectedGoalId || null) : null,
                original_amount: currencyCode !== "SGD" ? amount : null,
                original_currency: currencyCode,
                exchange_rate: currencyCode !== "SGD" ? finalExchangeRate : 1,
            };

            const created = await financeService.addExpense(input);

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
            setErrorMessage(err instanceof Error ? err.message : "Failed to save expense");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Quick Add Expense"
                    icon={<Plus className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    {/* Error Alert */}
                    {errorMessage && (
                        <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                            {errorMessage}
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

                            {/* Inline Currency Selector Dropdown Pill */}
                            <div className="relative flex items-center">
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

                        {/* Foreign Currency Live Conversion Preview & Editable Rate */}
                        {currencyCode !== "SGD" && (
                            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-(--pastel-butter-light) p-2.5 text-xs text-(--text-ink) border border-(--border-ink)">
                                <div className="flex items-center gap-1.5 font-bold">
                                    <span>Converted:</span>
                                    <span className="text-sm font-black text-(--text-ink)">
                                        ≈ S${fxConversion.amountInSGD.toFixed(2)}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] text-(--text-muted)">1 SGD =</span>
                                    <input
                                        type="number"
                                        step="any"
                                        aria-label="Exchange rate"
                                        value={customExchangeRate ?? fxConversion.exchangeRate}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            setCustomExchangeRate(isNaN(val) || val <= 0 ? undefined : val);
                                        }}
                                        className="w-20 rounded-lg border border-(--border-ink) bg-(--bg-card) px-2 py-0.5 text-xs font-semibold text-center text-(--text-ink)"
                                    />
                                    <span className="text-[10px] font-semibold">{currencyCode}</span>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Goal Spend Full-Width Toggle Card */}
                    {activeGoals.length > 0 && (
                        <div
                            onClick={() => {
                                const next = !isGoalSpend;
                                setIsGoalSpend(next);
                                if (next && !selectedGoalId && activeGoals.length > 0) {
                                    setSelectedGoalId(activeGoals[0].id);
                                }
                                if (!next) {
                                    setSelectedGoalId("");
                                }
                            }}
                            className={`flex items-center justify-between gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 shadow-cute-sm ${
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
                                        className={`h-4 w-4 stroke-[2.5] ${
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
                                    if (next && !selectedGoalId && activeGoals.length > 0) {
                                        setSelectedGoalId(activeGoals[0].id);
                                    }
                                    if (!next) {
                                        setSelectedGoalId("");
                                    }
                                }}
                                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-(--border-ink) transition-colors duration-200 ease-in-out focus:outline-none ${
                                    isGoalSpend ? "bg-(--pastel-lilac)" : "bg-slate-200 dark:bg-slate-700"
                                }`}
                            >
                                <span
                                    aria-hidden="true"
                                    className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow-cute-sm border border-(--border-ink) transition duration-200 ease-in-out ${
                                        isGoalSpend ? "translate-x-5" : "translate-x-0.5"
                                    }`}
                                />
                            </button>
                        </div>
                    )}

                    {/* Category or Goal Selection */}
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                                {isGoalSpend ? "Goal" : "Category"}
                            </span>
                            <div>
                                {isGoalSpend ? (
                                    activeGoals.length > 4 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowMoreGoals((prev) => !prev)}
                                            className="text-[11px] font-bold text-(--text-muted) hover:text-(--text-ink) underline cursor-pointer"
                                        >
                                            {showMoreGoals
                                                ? "Show less"
                                                : `+ More (${activeGoals.length - 4})`}
                                        </button>
                                    )
                                ) : (
                                    allocationCategories.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setShowMoreCategories((prev) => !prev)}
                                            className="text-[11px] font-bold text-(--text-muted) hover:text-(--text-ink) underline cursor-pointer"
                                        >
                                            {showMoreCategories
                                                ? "Spendable only"
                                                : `+ More (${allocationCategories.length})`}
                                        </button>
                                    )
                                )}
                            </div>
                        </div>

                        {isGoalSpend ? (
                            <div className="flex flex-wrap gap-1.5" aria-label="Goal Selection">
                                {activeGoals.length === 0 ? (
                                    <p className="text-xs text-(--text-muted) py-1">No active savings goals found.</p>
                                ) : (
                                    (showMoreGoals ? activeGoals : activeGoals.slice(0, 4)).map((g) => {
                                        const isSelected = selectedGoalId === g.id;
                                        return (
                                            <button
                                                key={g.id}
                                                type="button"
                                                aria-pressed={isSelected}
                                                onClick={() => setSelectedGoalId(g.id)}
                                                className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                                                    isSelected
                                                        ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold"
                                                        : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle) font-medium"
                                                }`}
                                            >
                                                <span role="img" aria-label={g.title} className="text-xs shrink-0">
                                                    {g.emoji || "🎯"}
                                                </span>
                                                <span>{g.title}</span>
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-1.5" aria-label="Category Selection">
                                {visibleCategories.map((cat) => {
                                    const isSelected = categoryId === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => {
                                                setCategoryId(cat.id);
                                                setCategoryManuallySelected(true);
                                            }}
                                            className={`flex items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                                                isSelected
                                                    ? "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold"
                                                    : "bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle) font-medium"
                                            }`}
                                        >
                                            <span
                                                className="h-2 w-2 rounded-full border border-black/20"
                                                style={{ backgroundColor: cat.color || "#dfc2ff" }}
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
                            Item / Description
                        </label>
                        <input
                            id="expense-item"
                            type="text"
                            placeholder="e.g., FairPrice Groceries, Grab, Lunch"
                            value={item}
                            onChange={(e) => handleItemTextChange(e.target.value)}
                            required
                            className="w-full rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                        />
                    </div>

                    {/* Payer Selection & 2-Button Segmented Personal/Shared Toggle */}
                    <div className="space-y-2 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) p-2.5 shadow-cute-sm">
                        {/* Payer Toggle */}
                        <div className="flex items-center justify-between gap-1.5 flex-wrap">
                            <span className="text-[11px] font-bold text-(--text-muted)">
                                Payer:
                            </span>
                            <div className="flex gap-1.5" aria-label="Payer Selection">
                                {members.map((member) => {
                                    const isSelected = payerId === member.id;
                                    return (
                                        <button
                                            key={member.id}
                                            type="button"
                                            aria-pressed={isSelected}
                                            onClick={() => setPayerId(member.id)}
                                            className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                                                isSelected
                                                    ? "bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                                    : "bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light) border border-(--border-subtle)"
                                            }`}
                                        >
                                            <span>{member.avatar_url || "👤"}</span>
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
                                    <span>Shared (50/50)</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 1-Tap Date Chips + Compact Date Picker */}
                    <div>
                        <label
                            htmlFor="expense-date"
                            className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1.5"
                        >
                            Date
                        </label>
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <button
                                type="button"
                                aria-pressed={date === todayStr}
                                onClick={() => setDate(todayStr)}
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
                            <div className="relative flex items-center">
                                <input
                                    id="expense-date"
                                    type="date"
                                    aria-label="Custom Date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    required
                                    className="rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-2 py-1 text-xs font-mono-num font-semibold text-(--text-ink) cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Expandable "More options" accordion */}
                    <div className="border-t border-(--border-subtle) pt-2">
                        <button
                            type="button"
                            onClick={() => setShowMoreOptions((prev) => !prev)}
                            aria-expanded={isAccordionExpanded}
                            className="flex w-full items-center justify-between py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                        >
                            <div className="flex items-center gap-2">
                                <span>More options (notes, tags, goal)</span>
                                {moreOptionsActiveCount > 0 && (
                                    <span className="rounded-full bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) px-2 py-0.5 text-[10px] font-bold">
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

                        <div className={isAccordionExpanded ? "space-y-4 pt-2" : "hidden"}>
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
                                                    onClick={() => handleRemoveTag(tag)}
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
                                            onChange={(e) => setNewTagInput(e.target.value)}
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
                                        onClick={() => handleAddTag(newTagInput)}
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
                                                onClick={() => handleAddTag(rTag)}
                                                className="inline-flex items-center gap-1 rounded-full bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink) px-2 py-0.5 text-[11px] font-bold transition-all cursor-pointer shadow-cute-sm"
                                            >
                                                <span>+ #{rTag.replace(/^#/, "")}</span>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) px-5 py-2.5 text-xs font-black shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        {isSubmitting ? (
                            <span>Saving...</span>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 stroke-[2.5]" />
                                <span>Add Expense</span>
                            </>
                        )}
                    </button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default QuickAddExpenseModal;
