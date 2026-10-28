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
import { Delete } from 'lucide-react';

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
  const [prevValue, setPrevValue] = useState(value);
  if (value !== undefined && value !== prevValue) {
    setPrevValue(value);
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
      } else if (inputRef) {
        Object.assign(inputRef, { current: el });
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

  useEffect(() => {
    if (!autoFocus) return;

    // Detect if device primarily uses touch / coarse pointer to prevent mobile keyboard pop-in jitter
    const isTouchDevice =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window);

    if (isTouchDevice) {
      return;
    }

    // Delay focus until drawer slide-up animation completes smoothly
    const timer = setTimeout(() => {
      internalInputRef.current?.focus();
    }, 240);

    return () => clearTimeout(timer);
  }, [autoFocus]);

  const computedAriaLabel =
    ariaLabelProp ||
    (currencyCode ? `Amount in ${currencyCode}` : 'Amount');

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Display & Numeric Input Field */}
      <div
        onClick={() => internalInputRef.current?.focus()}
        className="relative flex items-center justify-center rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-canvas) p-4 shadow-cute-sm transition-all focus-within:ring-2 focus-within:ring-(--pastel-lilac) focus-within:bg-(--bg-card) cursor-text"
      >
        <span className="mr-2 text-2xl font-bold font-mono-num text-(--text-muted) select-none">
          {currencySymbol}
        </span>
        <input
          ref={setRef}
          id={id}
          name={name}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          aria-label={computedAriaLabel}
          value={formattedDisplay}
          onKeyDown={handleKeyDown}
          onChange={handleChange}
          onPaste={handlePaste}
          className="w-full text-center text-4xl sm:text-5xl font-mono-num font-black tracking-tight text-(--text-ink) bg-transparent outline-none"
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
            className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-(--text-muted) hover:bg-(--pastel-coral-light) hover:text-rose-600 transition-colors cursor-pointer"
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
              className="flex h-12 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) text-xl font-bold font-mono-num text-(--text-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 hover:bg-(--pastel-butter-light) cursor-pointer transition-transform"
            >
              {digit}
            </button>
          ))}
          <button
            type="button"
            onClick={pushDoubleZero}
            className="flex h-12 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) text-lg font-bold font-mono-num text-(--text-muted) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 hover:bg-(--pastel-butter-light) cursor-pointer transition-transform"
          >
            00
          </button>
          <button
            type="button"
            onClick={() => pushDigit(0)}
            className="flex h-12 items-center justify-center rounded-xl bg-(--bg-card) border-[1.5px] border-(--border-ink) text-xl font-bold font-mono-num text-(--text-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 hover:bg-(--pastel-butter-light) cursor-pointer transition-transform"
          >
            0
          </button>
          <button
            type="button"
            onClick={popDigit}
            aria-label="Backspace"
            className="flex h-12 items-center justify-center rounded-xl bg-(--pastel-coral-light) border-[1.5px] border-(--border-ink) text-rose-700 shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 hover:bg-(--pastel-coral) cursor-pointer transition-transform"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}
export default CentsFirstAmountInput;
