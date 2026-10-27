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
import { getTodayDateString } from '../../lib/dateUtils';
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
      className={`rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900 transition-all ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400">
            <Zap className="h-4 w-4 fill-current" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Fast Log
            </h3>
            <p className="text-[11px] text-slate-400 dark:text-slate-500">
              1-tap lightning expense entry
            </p>
          </div>
        </div>

        {/* Payer Toggle */}
        <div className="flex items-center rounded-xl bg-slate-100 p-0.5 dark:bg-slate-800">
          {members.slice(0, 2).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setPayerId(m.id)}
              className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                payerId === m.id
                  ? 'bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white'
                  : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
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
        <div className="mb-4 flex items-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-xs font-bold text-white shadow-md animate-in fade-in slide-in-from-top duration-200">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{justLoggedMessage}</span>
        </div>
      )}

      {/* Prominent Amount Display */}
      <div className="relative mb-3 flex flex-col items-center justify-center rounded-2xl border-2 border-slate-100 bg-slate-50/80 p-4 dark:border-slate-800 dark:bg-slate-800/40">
        <div className="flex items-baseline justify-center">
          <span className="text-2xl font-bold text-slate-400 dark:text-slate-500 mr-1.5 select-none">
            S$
          </span>
          <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white font-mono">
            {amount.toFixed(2)}
          </span>
        </div>

        {cents > 0 && (
          <button
            type="button"
            onClick={clearAmount}
            aria-label="Clear amount"
            className="absolute right-3.5 top-3 rounded-full p-1 text-slate-400 hover:bg-slate-200 dark:text-slate-500 dark:hover:bg-slate-700 transition-colors"
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
            className="flex-1 rounded-xl bg-slate-100 py-1.5 text-center text-xs font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 active:scale-95 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-300 transition-all cursor-pointer"
          >
            +{preset}
          </button>
        ))}
      </div>

      {/* 4 Spendable Category Pills */}
      <div className="mb-3 space-y-1.5">
        <div className="flex justify-between items-center text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          <span>Category</span>
          <button
            type="button"
            onClick={() => setIsShared(!isShared)}
            className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer lowercase"
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
                    ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-600 ring-offset-2 dark:ring-offset-slate-900 scale-102'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                <span className="text-base mb-0.5">{info.icon}</span>
                <span className="text-[11px]">{displayName}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Contextual 1-Tap Quick Tags */}
      <div className="mb-4 space-y-1.5">
        <span className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
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
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-100 text-emerald-800 ring-1 ring-emerald-500 dark:bg-emerald-950/60 dark:text-emerald-300'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
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
            className="flex h-11 items-center justify-center rounded-xl bg-slate-50 text-lg font-bold text-slate-800 ring-1 ring-slate-200/80 active:scale-95 active:bg-slate-200 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700 dark:active:bg-slate-700 cursor-pointer transition-transform"
          >
            {digit}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            if (cents > 0 && cents < 999999) setCents((prev) => prev * 100);
          }}
          className="flex h-11 items-center justify-center rounded-xl bg-slate-50 text-sm font-bold text-slate-600 ring-1 ring-slate-200/80 active:scale-95 dark:bg-slate-800/80 dark:text-slate-300 dark:ring-slate-700 cursor-pointer transition-transform"
        >
          00
        </button>
        <button
          type="button"
          onClick={() => pushDigit(0)}
          className="flex h-11 items-center justify-center rounded-xl bg-slate-50 text-lg font-bold text-slate-800 ring-1 ring-slate-200/80 active:scale-95 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-slate-700 cursor-pointer transition-transform"
        >
          0
        </button>
        <button
          type="button"
          onClick={popDigit}
          aria-label="Backspace"
          className="flex h-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600 ring-1 ring-rose-200/80 active:scale-95 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/60 cursor-pointer transition-transform"
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
        className="w-full flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 px-4 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/20 hover:bg-emerald-700 active:scale-98 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
