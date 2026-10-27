/**
 * Quick Add Expense Modal
 * Fast, mobile-optimized modal with:
 * - AnimatedModal wrapper (drawer slide on mobile, scale on desktop)
 * - CentsFirstAmountInput (ATM cashier-style digits input)
 * - Multi-currency FX conversion (SGD, VND, JPY, MYR, THB, USD, EUR, etc.) with live preview
 * - 2-button segmented toggle: 👤 Personal | 👥 Shared (50/50)
 * - Smart category auto-detection on typing/tagging
 * - Persistent recent custom tags per category in localStorage
 * - 1-tap Date chips (Today, Yesterday, 2d ago) + compact date picker
 * - Inline remarks/notes input
 * - Tag picker (#tags)
 * - "Funded by Goal" linking
 */

import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { X, Plus, Sparkles, Hash, Target } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { financeService } from '../../services/financeService';
import { getTodayDateString, getSingaporeDate, formatISODate } from '../../lib/dateUtils';
import { isSpendableCategory } from '../../lib/financialFormulas';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import {
  SUPPORTED_CURRENCIES,
  convertToSGD,
} from '../../lib/currencyConverter';
import type { Category, HouseholdMember, Expense, CreateExpenseInput, SavingsGoal } from '../../types/finance';
import { AnimatedModal } from '../ui/AnimatedModal';
import { CentsFirstAmountInput } from './CentsFirstAmountInput';

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

const DEFAULT_QUICK_TAGS_BY_CATEGORY: Record<string, string[]> = {
  food: ['Lunch', 'Dinner', 'Coffee', 'Groceries', 'Hawker', 'FairPrice'],
  transport: ['Grab', 'MRT', 'Bus', 'Gojek', 'Taxi', 'Parking'],
  lifestyle: ['Shopping', 'Date Night', 'Movie', 'Personal Care', 'Gifts'],
  buffer: ['Clinic', 'Pharmacy', 'Utilities', 'Household Items', 'Misc'],
};

const GLOBAL_DEFAULT_QUICK_TAGS = ['Lunch', 'Dinner', 'Coffee', 'FairPrice', 'Grab', 'MRT'];

const RECENT_TAGS_STORAGE_KEY = 'budget_bubby_recent_tags_v1';

// Category keyword matching rules
const KEYWORD_CATEGORY_MAP: { keywords: string[]; categoryKey: string }[] = [
  {
    keywords: [
      'grab', 'gojek', 'mrt', 'bus', 'taxi', 'comfortdelgro', 'parking',
      'petrol', 'ez-link', 'ezlink', 'simplygo', 'transit', 'fuel', 'tada'
    ],
    categoryKey: 'transport',
  },
  {
    keywords: [
      'lunch', 'dinner', 'breakfast', 'coffee', 'cafe', 'hawker', 'food',
      'groceries', 'fairprice', 'cold storage', 'sheng siong', 'shengsiong',
      'breadtalk', 'toast box', 'yakun', 'starbucks', 'kfc', 'mcdonalds',
      'macdonalds', 'bubble tea', 'koi', 'liho', 'snack', 'restaurant', 'subway'
    ],
    categoryKey: 'food',
  },
  {
    keywords: [
      'shopping', 'movie', 'cinema', 'gym', 'netflix', 'spotify',
      'date night', 'personal care', 'gifts', 'uniqlo', 'zara', 'shopee',
      'lazada', 'entertainment', 'games', 'haircut'
    ],
    categoryKey: 'lifestyle',
  },
  {
    keywords: [
      'clinic', 'pharmacy', 'doctor', 'hospital', 'panadol', 'watsons',
      'guardian', 'utilities', 'repair', 'sp services', 'maintenance', 'dentist'
    ],
    categoryKey: 'buffer',
  },
];

function getStoredRecentTags(): Record<string, string[]> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(RECENT_TAGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function storeRecentTag(categoryId: string, tag: string) {
  if (typeof window === 'undefined' || !window.localStorage || !categoryId || !tag.trim()) return;
  try {
    const store = getStoredRecentTags();
    const existing = Array.isArray(store[categoryId]) ? store[categoryId] : [];
    const updated = [tag.trim(), ...existing.filter((t) => t.toLowerCase() !== tag.trim().toLowerCase())].slice(0, 6);
    store[categoryId] = updated;
    window.localStorage.setItem(RECENT_TAGS_STORAGE_KEY, JSON.stringify(store));
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

  const members = propMembers && propMembers.length > 0
    ? propMembers
    : ctxMembers && ctxMembers.length > 0
    ? ctxMembers
    : mockMembers;

  const categories = propCategories && propCategories.length > 0
    ? propCategories
    : mockCategories;

  const spendableCategories = useMemo(
    () => categories.filter((c) => isSpendableCategory(c)),
    [categories]
  );
  const allocationCategories = useMemo(
    () => categories.filter((c) => !isSpendableCategory(c)),
    [categories]
  );

  // Default to Personal when in Personal perspective, or Shared when in Combined view (unless overridden)
  const resolvedDefaultShared =
    defaultShared !== undefined ? defaultShared : perspective === 'household';

  // Amount & Currency State
  const [amount, setAmount] = useState<number>(0);
  const [currencyCode, setCurrencyCode] = useState<string>('SGD');
  const [customExchangeRate, setCustomExchangeRate] = useState<number | undefined>(undefined);

  // Item & Category State
  const [item, setItem] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>(
    spendableCategories[0]?.id || categories[0]?.id || ''
  );
  const [categoryManuallySelected, setCategoryManuallySelected] = useState<boolean>(false);
  const [showMoreCategories, setShowMoreCategories] = useState<boolean>(false);

  // Payer & Shared State
  const [payerId, setPayerId] = useState<string>(() => {
    if (defaultPayerId) return defaultPayerId;
    if (activeMember) return activeMember.id;
    return members[0]?.id || '';
  });
  const [isShared, setIsShared] = useState<boolean>(resolvedDefaultShared);

  // Date & Notes State
  const [date, setDate] = useState<string>(getTodayDateString());
  const [remarks, setRemarks] = useState<string>('');

  // Tags State
  const [tags, setTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState<string>('');

  // Goals State
  const [activeGoals, setActiveGoals] = useState<SavingsGoal[]>(propGoals || []);
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');

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
    financeService.getGoals()
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

  // Reset form and focus on open
  useEffect(() => {
    if (isOpen) {
      setAmount(0);
      setCurrencyCode('SGD');
      setCustomExchangeRate(undefined);
      setItem('');
      setCategoryId(spendableCategories[0]?.id || categories[0]?.id || '');
      setCategoryManuallySelected(false);
      setShowMoreCategories(false);
      setPayerId(defaultPayerId || (activeMember ? activeMember.id : members[0]?.id || ''));
      setIsShared(defaultShared !== undefined ? defaultShared : perspective === 'household');
      setDate(getTodayDateString());
      setRemarks('');
      setTags([]);
      setNewTagInput('');
      setSelectedGoalId('');
      setErrorMessage(null);
      setIsSubmitting(false);
    }
  }, [isOpen, defaultPayerId, defaultShared, activeMember, perspective, categories, spendableCategories, members]);

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Calculate currency conversion
  const selectedCurrency = useMemo(
    () => SUPPORTED_CURRENCIES.find((c) => c.code === currencyCode) || SUPPORTED_CURRENCIES[0],
    [currencyCode]
  );

  const fxConversion = useMemo(() => {
    if (currencyCode === 'SGD') {
      return { amountInSGD: amount, exchangeRate: 1 };
    }
    return convertToSGD(amount, currencyCode, customExchangeRate);
  }, [amount, currencyCode, customExchangeRate]);

  // Quick Tags: recent tags from localStorage + defaults for this category
  const quickTags = useMemo(() => {
    const catNameLower = selectedCategory?.name?.trim().toLowerCase() || '';
    const catDefaults = DEFAULT_QUICK_TAGS_BY_CATEGORY[catNameLower] || GLOBAL_DEFAULT_QUICK_TAGS;
    const stored = getStoredRecentTags();
    const catRecent = selectedCategory ? stored[selectedCategory.id] || [] : [];
    // Combine recent first, then defaults, deduplicated
    const combined = [...catRecent, ...catDefaults];
    return Array.from(new Set(combined)).slice(0, 7);
  }, [selectedCategory]);

  const visibleCategories = showMoreCategories
    ? categories
    : spendableCategories.length > 0
    ? spendableCategories
    : categories;

  // Auto-detect category from description/tag text if user hasn't explicitly chosen one
  const handleItemTextChange = (text: string) => {
    setItem(text);
    if (!categoryManuallySelected) {
      const lower = text.toLowerCase();
      for (const map of KEYWORD_CATEGORY_MAP) {
        if (map.keywords.some((kw) => lower.includes(kw))) {
          const match = categories.find((c) =>
            c.name.toLowerCase().includes(map.categoryKey)
          );
          if (match) {
            setCategoryId(match.id);
            break;
          }
        }
      }
    }
  };

  const handleSelectQuickTag = (tag: string) => {
    handleItemTextChange(tag);
  };

  // Add tag
  const handleAddTag = (rawTag: string) => {
    const trimmed = rawTag.trim();
    if (!trimmed) return;
    const formatted = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    if (!tags.includes(formatted)) {
      setTags([...tags, formatted]);
    }
    setNewTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

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
      setErrorMessage('Please enter a valid expense amount greater than 0');
      return;
    }

    if (!item.trim()) {
      setErrorMessage('Please select a quick tag or enter a description');
      return;
    }

    try {
      setIsSubmitting(true);

      const finalAmountInSGD = currencyCode === 'SGD' ? amount : fxConversion.amountInSGD;
      const finalExchangeRate = currencyCode === 'SGD' ? 1 : fxConversion.exchangeRate;

      const input: CreateExpenseInput = {
        payer_id: payerId,
        category_id: categoryId || null,
        date: date || todayStr,
        item: item.trim(),
        amount: finalAmountInSGD,
        remarks: remarks.trim() ? remarks.trim() : null,
        is_shared: isShared,
        split_ratio: isShared ? 0.5 : 0.0,
        tags: tags.length > 0 ? tags : undefined,
        goal_id: selectedGoalId || null,
        original_amount: currencyCode !== 'SGD' ? amount : null,
        original_currency: currencyCode,
        exchange_rate: currencyCode !== 'SGD' ? finalExchangeRate : 1,
      };

      const created = await financeService.addExpense(input);

      // Persist recent tag for the category
      if (categoryId && item.trim()) {
        storeRecentTag(categoryId, item.trim());
      }

      onExpenseAdded?.(created);
      onClose();
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Failed to save expense');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
      <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 pb-3 border-b border-(--border-subtle) flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-(--pastel-lilac-light) text-(--text-ink) border border-(--border-ink)">
              <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
            </div>
            <h2 id="modal-title" className="font-display font-bold text-base text-(--text-ink)">
              Quick Add Expense
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border-ink) text-(--text-ink) hover:bg-(--pastel-coral-light) transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form wrapping scrollable content and pinned footer */}
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-5 space-y-4">
            {/* Error Alert */}
            {errorMessage && (
              <div className="rounded-xl bg-rose-50 p-2.5 text-xs font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                {errorMessage}
              </div>
            )}

            {/* Amount Input Header with Inline Currency Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="expense-amount"
                  className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                >
                  Amount
                </label>

                {/* Inline Currency Selector Dropdown Pill */}
                <div className="relative">
                  <select
                    aria-label="Select currency"
                    value={currencyCode}
                    onChange={(e) => {
                      setCurrencyCode(e.target.value);
                      setCustomExchangeRate(undefined);
                    }}
                    className="rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-bold px-2.5 py-1 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {SUPPORTED_CURRENCIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.flag} {c.code} ({c.symbol})
                      </option>
                    ))}
                  </select>
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
              {currencyCode !== 'SGD' && (
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-emerald-50/80 p-2.5 text-xs text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span>Converted:</span>
                    <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-300">
                      ≈ S${fxConversion.amountInSGD.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">1 SGD =</span>
                    <input
                      type="number"
                      step="any"
                      aria-label="Exchange rate"
                      value={customExchangeRate ?? fxConversion.exchangeRate}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setCustomExchangeRate(isNaN(val) || val <= 0 ? undefined : val);
                      }}
                      className="w-20 rounded-lg border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 px-2 py-0.5 text-xs font-semibold text-center text-slate-800 dark:text-slate-100"
                    />
                    <span className="text-[10px] font-semibold">{currencyCode}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Category Chips */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-(--text-muted)">
                  Category
                </span>
                {allocationCategories.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowMoreCategories((prev) => !prev)}
                    className="text-[11px] font-bold text-purple-700 dark:text-purple-300 hover:underline cursor-pointer"
                  >
                    {showMoreCategories ? 'Spendable only' : `+ More (${allocationCategories.length})`}
                  </button>
                )}
              </div>
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
                          ? 'bg-(--pastel-lilac) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm font-bold'
                          : 'bg-(--bg-canvas) text-(--text-ink) hover:bg-(--pastel-butter-light) border border-(--border-subtle) font-medium'
                      }`}
                    >
                      <span
                        className="h-2 w-2 rounded-full border border-black/20"
                        style={{ backgroundColor: cat.color || '#dfc2ff' }}
                      />
                      <span>{cat.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Quick Tags + Description */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label
                  htmlFor="expense-item"
                  className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)"
                >
                  Item / Description
                </label>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-(--text-muted)">
                  <Sparkles className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  Tap tag or type
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-2" aria-label="Quick Tags">
                {quickTags.map((tag) => {
                  const isActiveTag = item.toLowerCase() === tag.toLowerCase();
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => handleSelectQuickTag(tag)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition-all cursor-pointer ${
                        isActiveTag
                          ? 'bg-(--pastel-butter) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm'
                          : 'bg-(--bg-canvas) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink)'
                      }`}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>

              <input
                id="expense-item"
                type="text"
                placeholder="e.g., FairPrice Groceries, Grab, Lunch"
                value={item}
                onChange={(e) => handleItemTextChange(e.target.value)}
                required
                className="w-full rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) px-3.5 py-2 text-sm text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
              />
            </div>

            {/* Payer Selection & 2-Button Segmented Personal/Shared Toggle */}
            <div className="space-y-2 rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-2.5 shadow-cute-sm">
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
                            ? 'bg-(--pastel-butter) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm'
                            : 'bg-(--bg-canvas) text-(--text-muted) hover:bg-(--pastel-butter-light) border border-(--border-subtle)'
                        }`}
                      >
                        <span>{member.avatar_url || '👤'}</span>
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
                  className="flex rounded-xl bg-(--bg-canvas) p-1 border-[1.5px] border-(--border-ink)"
                >
                  <button
                    type="button"
                    aria-pressed={!isShared}
                    onClick={() => setIsShared(false)}
                    className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      !isShared
                        ? 'bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) shadow-cute-sm'
                        : 'text-(--text-muted) hover:text-(--text-ink)'
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
                        ? 'bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) shadow-cute-sm'
                        : 'text-(--text-muted) hover:text-(--text-ink)'
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
                      ? 'bg-(--pastel-lilac) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm'
                      : 'bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) border border-(--border-subtle)'
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
                      ? 'bg-(--pastel-lilac) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm'
                      : 'bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) border border-(--border-subtle)'
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
                      ? 'bg-(--pastel-lilac) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm'
                      : 'bg-(--bg-canvas) hover:bg-(--pastel-butter-light) text-(--text-muted) border border-(--border-subtle)'
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
                    className="rounded-lg border-[1.5px] border-(--border-ink) bg-(--bg-canvas) px-2 py-1 text-xs font-mono-num font-semibold text-(--text-ink) cursor-pointer"
                  />
                </div>
              </div>
            </div>

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
                className="w-full rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
              />
            </div>

            {/* Tag Picker (#tags) */}
            <div>
              <label
                htmlFor="expense-tag-input"
                className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1"
              >
                Tags
              </label>
              <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
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
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(newTagInput);
                      }
                    }}
                    className="w-full rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) pl-8 pr-3 py-1.5 text-xs text-(--text-ink) placeholder:text-(--text-muted) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac)"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleAddTag(newTagInput)}
                  className="rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) hover:bg-(--pastel-butter-light) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 text-(--text-ink) px-3 py-1.5 text-xs font-bold cursor-pointer"
                >
                  + Tag
                </button>
              </div>
            </div>

            {/* Funded by Goal (Optional) */}
            {activeGoals.length > 0 && (
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Target className="h-3 w-3 text-purple-600 dark:text-purple-400" />
                  <label
                    htmlFor="expense-goal"
                    className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted)"
                  >
                    Funded by Goal (Optional)
                  </label>
                </div>
                <select
                  id="expense-goal"
                  aria-label="Funded by Goal"
                  value={selectedGoalId}
                  onChange={(e) => setSelectedGoalId(e.target.value)}
                  className="w-full rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) px-3 py-1.5 text-xs font-semibold text-(--text-ink) focus:border-(--border-ink) focus:bg-(--bg-card) focus:outline-none focus:ring-2 focus:ring-(--pastel-lilac) cursor-pointer"
                >
                  <option value="">None (Standard Budget)</option>
                  {activeGoals.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.emoji || '🎯'} {g.title} (S${g.saved_so_far.toLocaleString('en-SG')} saved)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Submit Actions Footer */}
          <div className="flex items-center justify-end gap-2.5 p-4 sm:p-5 pt-3 border-t border-(--border-subtle) shrink-0 bg-(--bg-card) pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
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
              className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl border-[1.5px] border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) px-5 py-2.5 text-xs font-black shadow-cute-sm hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
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
          </div>
        </form>
      </div>
    </AnimatedModal>
  );
}

export default QuickAddExpenseModal;
