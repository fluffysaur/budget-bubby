/**
 * CentsFirstAmountInput Component
 * Budget Bubby - Couples Finance & Daily Ledger
 *
 * ATM / Cashier-style numeric amount input where typing digits shifts right-to-left:
 * - Initial: 0.00 (or 0 for zero-decimal currencies)
 * - Typing 1 -> 0.01
 * - Typing 2 -> 0.12
 * - Typing 5 -> 1.25
 * - Typing 0 -> 12.50
 * - Backspace shifts right (12.50 -> 1.25)
 * - Clear button or Escape key resets to 0.00
 * - Uses inputMode="numeric" for digits-only keypad on mobile
 * - Supports zero-decimal currencies (VND, JPY, KRW, IDR)
 * - Supports optional integrated virtual numeric keypad for fast mobile entry
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Delete, X } from 'lucide-react';

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
  showKeypad?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  'aria-label'?: string;
}

const ZERO_DECIMAL_CURRENCIES = ['VND', 'JPY', 'KRW', 'IDR'];

export function CentsFirstAmountInput({
  value,
  onChange,
  currencySymbol = 'S$',
  currencyCode,
  id = 'expense-amount',
  name = 'amount',
  autoFocus = false,
  disabled = false,
  className = '',
  showKeypad = false,
  inputRef,
  'aria-label': ariaLabelProp,
}: CentsFirstAmountInputProps) {
  const isZeroDecimal = ZERO_DECIMAL_CURRENCIES.includes((currencyCode || '').toUpperCase());

  // Value stored in integer units (cents for decimal currencies, whole units for zero-decimal)
  const [internalUnits, setInternalUnits] = useState<number>(() => {
    if (value !== undefined && !isNaN(value) && value > 0) {
      return isZeroDecimal ? Math.round(value) : Math.round(value * 100);
    }
    return 0;
  });

  const internalInputRef = useRef<HTMLInputElement | null>(null);

  // Sync state synchronously if value prop changed externally
  const prevValueRef = useRef(value);
  if (value !== undefined && value !== prevValueRef.current) {
    prevValueRef.current = value;
    const targetUnits = isZeroDecimal ? Math.round(value) : Math.round(value * 100);
    if (targetUnits !== internalUnits) {
      setInternalUnits(targetUnits);
    }
  }

  // Also sync when isZeroDecimal changes
  useEffect(() => {
    if (value !== undefined) {
      const targetUnits = isZeroDecimal ? Math.round(value) : Math.round(value * 100);
      setInternalUnits(targetUnits);
    }
  }, [value, isZeroDecimal]);

  // Set ref helper
  const setRef = useCallback(
    (el: HTMLInputElement | null) => {
      internalInputRef.current = el;
      if (typeof inputRef === 'function') {
        inputRef(el);
      } else if (inputRef && 'current' in inputRef) {
        (inputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
      }
    },
    [inputRef]
  );

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

  const pushDigit = useCallback(
    (digit: number) => {
      if (disabled) return;
      const nextUnits = internalUnits * 10 + digit;
      updateUnits(nextUnits);
    },
    [disabled, internalUnits, updateUnits]
  );

  const popDigit = useCallback(() => {
    if (disabled) return;
    const nextUnits = Math.floor(internalUnits / 10);
    updateUnits(nextUnits);
  }, [disabled, internalUnits, updateUnits]);

  const pushDoubleZero = useCallback(() => {
    if (disabled) return;
    if (internalUnits > 0 && internalUnits < 9999999) {
      const nextUnits = internalUnits * 100;
      updateUnits(nextUnits);
    }
  }, [disabled, internalUnits, updateUnits]);

  const handleClear = useCallback(() => {
    if (disabled) return;
    updateUnits(0);
    internalInputRef.current?.focus();
  }, [disabled, updateUnits]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return;

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const digit = parseInt(e.key, 10);
      pushDigit(digit);
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      popDigit();
    } else if (e.key === 'Escape' || e.key === 'Delete') {
      e.preventDefault();
      handleClear();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    const cleanDigits = e.target.value.replace(/\D/g, '');
    if (cleanDigits.length === 0) {
      updateUnits(0);
      return;
    }
    const nextUnits = parseInt(cleanDigits, 10);
    if (!isNaN(nextUnits)) {
      updateUnits(nextUnits);
    }
  };

  useEffect(() => {
    if (autoFocus && internalInputRef.current) {
      internalInputRef.current.focus();
    }
  }, [autoFocus]);

  const computedAriaLabel =
    ariaLabelProp ||
    (currencyCode ? `Amount in ${currencyCode}` : 'Amount');

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Display & Numeric Input Field */}
      <div
        onClick={() => internalInputRef.current?.focus()}
        className="relative flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:focus-within:border-emerald-400 dark:focus-within:bg-slate-800 cursor-text"
      >
        <span className="mr-2 text-2xl font-bold text-slate-400 dark:text-slate-500 select-none">
          {currencySymbol}
        </span>
        <input
          ref={setRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          autoFocus={autoFocus}
          disabled={disabled}
          aria-label={computedAriaLabel}
          value={formattedDisplay}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          className="w-full text-center text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white bg-transparent outline-hidden"
          placeholder={isZeroDecimal ? '0' : '0.00'}
        />
        {internalUnits > 0 && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            aria-label="Clear amount"
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-200 transition-colors"
          >
            <Delete className="h-5 w-5" />
          </button>
        )}
      </div>

      {/* Optional Integrated Virtual Keypad */}
      {showKeypad && (
        <div className="grid grid-cols-3 gap-2 select-none">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              type="button"
              onClick={() => pushDigit(digit)}
              className="flex h-12 items-center justify-center rounded-xl bg-white text-xl font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 active:scale-95 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:active:bg-slate-700 cursor-pointer transition-transform"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={pushDoubleZero}
            className="flex h-12 items-center justify-center rounded-xl bg-white text-lg font-semibold text-slate-600 shadow-xs ring-1 ring-slate-200 active:scale-95 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700 dark:active:bg-slate-700 cursor-pointer transition-transform"
          >
            00
          </button>
          <button
            type="button"
            onClick={() => pushDigit(0)}
            className="flex h-12 items-center justify-center rounded-xl bg-white text-xl font-semibold text-slate-800 shadow-xs ring-1 ring-slate-200 active:scale-95 active:bg-slate-100 dark:bg-slate-800 dark:text-slate-100 dark:ring-slate-700 dark:active:bg-slate-700 cursor-pointer transition-transform"
          >
            0
          </button>
          <button
            type="button"
            onClick={popDigit}
            aria-label="Backspace"
            className="flex h-12 items-center justify-center rounded-xl bg-rose-50 text-rose-600 shadow-xs ring-1 ring-rose-200 active:scale-95 active:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 dark:ring-rose-900/60 dark:active:bg-rose-900/60 cursor-pointer transition-transform"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
export default CentsFirstAmountInput;
