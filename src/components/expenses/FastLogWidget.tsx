/**
 * FastLogWidget Component
 * Compact, lightning-fast 1-tap expense logging pad:
 * - Prominent numeric cents-first amount display with 1-tap virtual keypad
 * - 4 spendable category pills (🍔 Food, 🛍️ Lifestyle, 🚗 Transport, 🛡️ Buffer)
 * - Contextual 1-tap quick tags (Lunch, Dinner, Coffee, Groceries, Grab, etc.)
 * - Inline Payer selector & Shared toggle
 * - Instant 1-tap "Log S$X.XX" button with sound feedback and auto-reset
 * - Can be embedded inline or used as a standalone `/fast-log` PWA shortcut page
 */

import { useState, useMemo } from 'react';
import {
  Zap,
  CheckCircle2,
  ArrowRightLeft,
  Delete,
  Sparkles,
} from 'lucide-react';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { getTodayDateString, getCurrentSingaporeTime } from '../../lib/dateUtils';
import { playChaChingSound } from '../../lib/soundEffects';
import { mockCategories, mockMembers } from '../../data/mockSeedData';
import type { Expense, Category, HouseholdMember } from '../../types/finance';

export interface FastLogWidgetProps {
  onExpenseLogged?: (expense: Expense) => void;
  defaultPayerId?: string;
  defaultShared?: boolean;
  categories?: Category[];
  members?: HouseholdMember[];
  className?: string;
}

const CATEGORY_TAGS_MAP: Record<string, { icon: string; tags: string[] }> = {
  food: {
    icon: '🍔',
    tags: ['Lunch', 'Dinner', 'Coffee', 'Groceries', 'Hawker', 'Breakfast'],
  },
  transport: {
    icon: '🚗',
    tags: ['MRT / Bus', 'Grab', 'Gojek', 'Taxi', 'Parking', 'Petrol'],
  },
  lifestyle: {
    icon: '🛍️',
    tags: ['Shopping', 'Date Night', 'Coffee & Cake', 'Personal Care', 'Gifts'],
  },
  buffer: {
    icon: '🛡️',
    tags: ['Clinic / Pharmacy', 'Household Items', 'Utilities', 'Repair / Misc'],
  },
};

export function FastLogWidget({
  onExpenseLogged,
  defaultPayerId,
  defaultShared = true,
  categories = mockCategories,
  members = mockMembers,
  className = '',
}: FastLogWidgetProps) {
  // Amount in cents (e.g. 1250 = $12.50)
  const [cents, setCents] = useState<number>(0);
  const amount = cents / 100;

  // Selected spendable category key: 'food' | 'transport' | 'lifestyle' | 'buffer'
  const [selectedCatKey, setSelectedCatKey] = useState<string>('food');
  const [selectedTag, setSelectedTag] = useState<string>('Lunch');
  const [customItem, setCustomItem] = useState<string>('');
  const [payerId, setPayerId] = useState<string>(defaultPayerId || members[0]?.id || '');
  const [isShared, setIsShared] = useState<boolean>(defaultShared);

  const [isLogging, setIsLogging] = useState<boolean>(false);
  const [justLoggedMessage, setJustLoggedMessage] = useState<string | null>(null);

  // Match category object from prop categories
  const currentCategoryObj = useMemo(() => {
    const found = categories.find((c) =>
      c.name.toLowerCase().includes(selectedCatKey)
    );
    return found || categories[0];
  }, [categories, selectedCatKey]);

  // Keypad operations
  const pushDigit = (digit: number) => {
    if (cents >= 9999999) return;
    setCents((prev) => prev * 10 + digit);
  };

  const popDigit = () => {
    setCents((prev) => Math.floor(prev / 10));
  };

  const clearAmount = () => {
    setCents(0);
  };

  const addPresetAmount = (presetDollars: number) => {
    setCents((prev) => Math.min(9999999, prev + Math.round(presetDollars * 100)));
  };

  // Switch category and pick its first tag
  const handleSelectCategory = (catKey: string) => {
    setSelectedCatKey(catKey);
    const firstTag = CATEGORY_TAGS_MAP[catKey]?.tags[0] || '';
    setSelectedTag(firstTag);
  };

  // Instant 1-tap log
  const handleLogExpense = async () => {
    if (amount <= 0 || isLogging) return;

    try {
      setIsLogging(true);
      const itemTitle = customItem.trim() || selectedTag || currentCategoryObj?.name || 'Fast Log';

      const created = await financeService.addExpense({
        payer_id: payerId,
        category_id: currentCategoryObj?.id || null,
        date: getTodayDateString(),
        time: getCurrentSingaporeTime(),
        item: itemTitle,
        amount,
        is_shared: isShared,
        split_ratio: isShared ? 0.5 : 0.5,
        tags: selectedTag ? [selectedTag] : [],
      });

      // Play audio celebratory chime
      playChaChingSound();

      // Dispatch global window event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('expenseAdded', { detail: created }));
      }

      onExpenseLogged?.(created);

      // Visual flash feedback
      const formatted = formatSGD(amount);
      setJustLoggedMessage(`Logged ${formatted} for ${itemTitle}!`);
      setTimeout(() => {
        setJustLoggedMessage(null);
      }, 3000);

      // Reset
      setCents(0);
      setCustomItem('');
    } catch (err) {
      console.error('Failed to fast-log expense:', err);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div
      className={`rounded-3xl border-2 border-(--border-ink) bg-(--bg-card) p-5 sm:p-6 shadow-cute transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink)">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <div>
            <h3 className="font-display font-black text-sm text-(--text-ink)">
              Fast Log
            </h3>
            <p className="text-[11px] font-medium text-(--text-muted)">
              1-tap lightning expense entry
            </p>
          </div>
        </div>

        {/* Payer Toggle */}
        <div className="flex items-center rounded-xl bg-(--bg-canvas) p-1 border border-(--border-ink)">
          {members.slice(0, 2).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPayerId(m.id)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                payerId === m.id
                  ? 'bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) shadow-cute-sm'
                  : 'text-(--text-muted) hover:text-(--text-ink)'
              }`}
            >
              <span>{m.avatar_url || '👤'}</span>
              <span>{m.display_name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Success Banner */}
      {justLoggedMessage && (
        <div className="mb-4 flex items-center gap-2 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--pastel-mint) px-4 py-3 text-xs font-bold text-(--text-ink) shadow-cute-sm animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-800" />
          <span>{justLoggedMessage}</span>
        </div>
      )}

      {/* Prominent Amount Display */}
      <div className="relative mb-3 flex flex-col items-center justify-center rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) p-4 shadow-cute-sm">
        <div className="flex items-baseline justify-center">
          <span className="font-mono-num text-2xl font-bold text-(--text-muted) mr-1.5 select-none">
            S$
          </span>
          <span className="text-4xl sm:text-5xl font-mono-num font-black tracking-tight text-(--text-ink)">
            {amount.toFixed(2)}
          </span>
        </div>

        {cents > 0 && (
          <button
            type="button"
            onClick={clearAmount}
            aria-label="Clear amount"
            className="absolute right-3.5 top-3 rounded-full p-1 text-(--text-muted) hover:bg-(--pastel-coral-light) hover:text-rose-600 transition-colors cursor-pointer"
          >
            <Delete className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Quick Amount Preset Chips */}
      <div className="flex items-center justify-between gap-1.5 mb-4">
        {[1, 2, 5, 10, 20].map((preset) => (
          <button
            key={preset}
            type="button"
            onClick={() => addPresetAmount(preset)}
            className="flex-1 rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) py-1.5 text-center text-xs font-mono-num font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--pastel-butter) active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
          >
            +{preset}
          </button>
        ))}
      </div>

      {/* 4 Spendable Category Pills */}
      <div className="mb-3 space-y-1.5">
        <div className="flex justify-between items-center text-[11px] font-bold text-(--text-muted) uppercase tracking-wider">
          <span>Category</span>
          <button
            type="button"
            onClick={() => setIsShared(!isShared)}
            className="inline-flex items-center gap-1 text-purple-700 dark:text-purple-300 font-bold hover:underline cursor-pointer lowercase"
          >
            <ArrowRightLeft className="h-3 w-3" />
            <span>{isShared ? 'shared 50/50' : 'personal'}</span>
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {Object.entries(CATEGORY_TAGS_MAP).map(([catKey, info]) => {
            const isSelected = selectedCatKey === catKey;
            const displayName = catKey.charAt(0).toUpperCase() + catKey.slice(1);
            return (
              <button
                key={catKey}
                type="button"
                onClick={() => handleSelectCategory(catKey)}
                className={`flex flex-col items-center justify-center rounded-2xl py-2 px-1 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-(--pastel-lilac) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm font-black'
                    : 'bg-(--bg-canvas) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink)'
                }`}
              >
                <span className="text-base mb-0.5">{info.icon}</span>
                <span className="text-[11px] font-bold">{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual 1-Tap Quick Tags */}
      <div className="mb-4 space-y-1.5">
        <span className="block text-[11px] font-bold text-(--text-muted) uppercase tracking-wider">
          Quick Item Tag
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CATEGORY_TAGS_MAP[selectedCatKey]?.tags.map((tag) => {
            const isSelected = selectedTag === tag && !customItem;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => {
                  setSelectedTag(tag);
                  setCustomItem('');
                }}
                className={`rounded-xl px-2.5 py-1 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-(--pastel-butter) text-(--text-ink) border-[1.5px] border-(--border-ink) shadow-cute-sm'
                    : 'bg-(--bg-canvas) text-(--text-ink) border border-(--border-subtle) hover:border-(--border-ink)'
                }`}
              >
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Numeric Keypad */}
      <div className="grid grid-cols-3 gap-1.5 mb-4 select-none">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
          <button
            key={digit}
            type="button"
            onClick={() => pushDigit(digit)}
            className="flex h-11 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) text-lg font-mono-num font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-transform"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (cents > 0 && cents < 999999) setCents((prev) => prev * 100);
          }}
          className="flex h-11 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) text-sm font-mono-num font-bold text-(--text-muted) shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-transform"
        >
          00
        </button>
        <button
          type="button"
          onClick={() => pushDigit(0)}
          className="flex h-11 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) text-lg font-mono-num font-bold text-(--text-ink) shadow-cute-sm hover:bg-(--pastel-butter-light) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-transform"
        >
          0
        </button>
        <button
          type="button"
          onClick={popDigit}
          aria-label="Backspace"
          className="flex h-11 items-center justify-center rounded-xl bg-(--pastel-coral-light) border-[1.5px] border-(--border-ink) text-rose-700 shadow-cute-sm hover:bg-(--pastel-coral) active:translate-x-0.5 active:translate-y-0.5 cursor-pointer transition-transform"
        >
          <Delete className="h-4 w-4" />
        </button>
      </div>

      {/* Prominent 1-Tap "Log S$X.XX" Button */}
      <button
        type="button"
        onClick={handleLogExpense}
        disabled={amount <= 0 || isLogging}
        aria-label={`Log ${formatSGD(amount)}`}
        className="w-full flex items-center justify-center gap-2 rounded-2xl border-2 border-(--border-ink) bg-(--pastel-lilac) text-(--text-ink) py-3.5 px-4 text-sm font-black shadow-cute hover:bg-[#1a1a1a] hover:text-[#fbf7f1] active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
      >
        <Sparkles className="h-4 w-4" />
        <span>
          {isLogging
            ? 'Logging...'
            : amount > 0
            ? `Log ${formatSGD(amount)} • ${selectedTag || currentCategoryObj?.name}`
            : 'Enter Amount to Log'}
        </span>
      </button>
    </div>
  );
}

export default FastLogWidget;
