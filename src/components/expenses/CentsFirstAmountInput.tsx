/**
 * CentsFirstAmountInput Component
 * ATM / Cashier-style numeric amount input where typing digits shifts right-to-left:
 * - Initial: 0.00
 * - Typing 1 -> 0.01
 * - Typing 2 -> 0.12
 * - Typing 5 -> 1.25
 * - Typing 0 -> 12.50
 * - Backspace shifts right (12.50 -> 1.25)
 * - Clear button or Escape key resets to 0.00
 * - Uses inputMode="numeric" for digits-only keypad on mobile
 * - Supports zero-decimal currencies (VND, JPY, KRW, IDR)
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';

export interface CentsFirstAmountInputProps {
  value?: number;
  onChange: (amount: number) => void;
  currencySymbol?: string;
  currencyCode?: string;
  id?: string;
  name?: string;
  placeholder?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  className?: string;
  inputRef?: React.Ref<HTMLInputElement>;
}

const ZERO_DECIMAL_CURRENCIES = ['VND', 'JPY', 'KRW', 'IDR'];

export function CentsFirstAmountInput({
  value,
  onChange,
  currencySymbol = 'S$',
  currencyCode = 'SGD',
  id = 'expense-amount',
  name = 'amount',
  autoFocus = false,
  disabled = false,
  className = '',
  inputRef,
}: CentsFirstAmountInputProps) {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes((currencyCode || '').toUpperCase());

  // Value stored in integer units (cents for decimal currencies, whole units for zero-decimal)
  const [internalUnits, setInternalUnits] = useState<number>(() => {
    if (value !== undefined && !isNaN(value) && value > 0) {
      return isZeroDecimal ? Math.round(value) : Math.round(value * 100);
    }
    return 0;
  });

  const internalInputRef = useRef<HTMLInputElement>(null);

  // Sync from external value prop when it changes
  useEffect(() => {
    if (value !== undefined) {
      const targetUnits = isZeroDecimal ? Math.round(value) : Math.round(value * 100);
      if (targetUnits !== internalUnits) {
        setInternalUnits(targetUnits);
      }
    }
  }, [value, isZeroDecimal]);

  // Format display string
  const formattedDisplay = React.useMemo(() => {
    if (isZeroDecimal) {
      return internalUnits.toLocaleString('en-US');
    }
    const dollars = Math.floor(internalUnits / 100);
    const cents = internalUnits % 100;
    return `${dollars.toLocaleString('en-US')}.${cents.toString().padStart(2, '0')}`;
  }, [internalUnits, isZeroDecimal]);

  const updateUnits = useCallback(
    (nextUnits: number) => {
      const bounded = Math.max(0, Math.min(nextUnits, 999999999));
      setInternalUnits(bounded);
      const floatAmount = isZeroDecimal ? bounded : bounded / 100;
      onChange(floatAmount);
    },
    [isZeroDecimal, onChange]
  );

  const handleClear = useCallback(() => {
    updateUnits(0);
    const el = internalInputRef.current;
    if (el) {
      el.focus();
    }
  }, [updateUnits]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const digit = parseInt(e.key, 10);
      const nextUnits = internalUnits * 10 + digit;
      updateUnits(nextUnits);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const nextUnits = Math.floor(internalUnits / 10);
      updateUnits(nextUnits);
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      e.preventDefault();
      handleClear();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const raw = e.target.value.trim();
    if (!raw) {
      updateUnits(0);
      return;
    }

    const floatVal = parseFloat(raw.replace(/[^0-9.]/g, ''));
    if (isNaN(floatVal)) {
      updateUnits(0);
      return;
    }

    if (isZeroDecimal) {
      updateUnits(Math.round(floatVal));
    } else {
      if (raw.startsWith(formattedDisplay) || raw.endsWith(formattedDisplay)) {
        const digitsOnly = raw.replace(/\D/g, '');
        const parsed = parseInt(digitsOnly, 10);
        updateUnits(parsed);
      } else {
        updateUnits(Math.round(floatVal * 100));
      }
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (disabled) return;
    const pasted = e.clipboardData.getData('text');
    const floatVal = parseFloat(pasted.replace(/[^0-9.]/g, ''));
    if (!isNaN(floatVal) && floatVal >= 0) {
      const targetUnits = isZeroDecimal ? Math.round(floatVal) : Math.round(floatVal * 100);
      updateUnits(targetUnits);
    }
  };

  const setRefs = useCallback(
    (element: HTMLInputElement | null) => {
      internalInputRef.current = element;
      if (typeof inputRef === 'function') {
        inputRef(element);
      } else if (inputRef && 'current' in inputRef) {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = element;
      }
    },
    [inputRef]
  );

  return (
    <div className={`relative flex items-center ${className}`}>
      {/* Active Currency Symbol */}
      <span
        aria-hidden="true"
        className="absolute left-4 text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 select-none pointer-events-none"
      >
        {currencySymbol}
      </span>

      {/* ATM Shift-in Numeric Input */}
      <input
        ref={setRefs}
        id={id}
        name={name}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        autoCorrect="off"
        spellCheck="false"
        value={formattedDisplay}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        onPaste={handlePaste}
        autoFocus={autoFocus}
        disabled={disabled}
        aria-label={`Amount in ${currencyCode}`}
        className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50/50 py-3 sm:py-3.5 pl-14 sm:pl-16 pr-12 text-2xl sm:text-3xl font-black tracking-tight text-slate-900 transition-colors placeholder:text-slate-300 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white dark:placeholder:text-slate-600 dark:focus:border-emerald-400 dark:focus:bg-slate-800"
      />

      {/* 1-tap Clear Button */}
      {internalUnits > 0 && !disabled && (
        <button
          type="button"
          onClick={handleClear}
          aria-label="Clear amount"
          className="absolute right-3.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-200/80 text-slate-500 hover:bg-slate-300 hover:text-slate-700 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600 transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export default CentsFirstAmountInput;
