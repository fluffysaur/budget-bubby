/**
 * CentsFirstAmountInput
 * A specialized numeric amount input that fills cents first from right to left
 * (e.g. 1 -> $0.01, 12 -> $0.12, 125 -> $1.25, 1250 -> $12.50).
 * Supports standard keyboard typing, backspace, and optional virtual keypad buttons.
 */

import React, { useCallback, useEffect, useRef } from 'react';
import { Delete } from 'lucide-react';

export interface CentsFirstAmountInputProps {
  value: number; // In standard currency units, e.g. 12.50
  onChange: (value: number) => void;
  currencySymbol?: string;
  autoFocus?: boolean;
  className?: string;
  showKeypad?: boolean;
  id?: string;
  placeholder?: string;
  'aria-label'?: string;
}

export function CentsFirstAmountInput({
  value,
  onChange,
  currencySymbol = 'S$',
  autoFocus = false,
  className = '',
  showKeypad = false,
  id = 'cents-first-amount-input',
  'aria-label': ariaLabel = 'Amount',
}: CentsFirstAmountInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert float to integer cents safely (e.g. 12.50 -> 1250)
  const cents = Math.round((value || 0) * 100);

  const formattedDisplay = (cents / 100).toFixed(2);

  const pushDigit = useCallback(
    (digit: number) => {
      if (cents >= 99999999) return; // Prevent overflow past $999,999.99
      const newCents = cents * 10 + digit;
      onChange(newCents / 100);
    },
    [cents, onChange]
  );

  const popDigit = useCallback(() => {
    const newCents = Math.floor(cents / 10);
    onChange(newCents / 100);
  }, [cents, onChange]);

  const clearAll = useCallback(() => {
    onChange(0);
  }, [onChange]);

  // Handle direct keyboard strokes in the input element
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      pushDigit(parseInt(e.key, 10));
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      popDigit();
    } else if (e.key === 'Delete' || e.key === 'Escape') {
      e.preventDefault();
      clearAll();
    }
  };

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Display & Invisible Input Field */}
      <div
        onClick={() => inputRef.current?.focus()}
        className="relative flex items-center justify-center rounded-2xl border-2 border-slate-200 bg-slate-50/70 p-4 transition-all focus-within:border-emerald-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-800/60 dark:focus-within:border-emerald-400 dark:focus-within:bg-slate-800 cursor-text"
      >
        <span className="mr-2 text-2xl font-bold text-slate-400 dark:text-slate-500 select-none">
          {currencySymbol}
        </span>
        <input
          ref={inputRef}
          id={id}
          type="text"
          inputMode="numeric"
          aria-label={ariaLabel}
          value={formattedDisplay}
          onKeyDown={handleKeyDown}
          onChange={() => {}} // Controlled by onKeyDown & keypad
          className="w-full text-center text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white bg-transparent outline-hidden"
          placeholder="0.00"
        />
        {cents > 0 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              clearAll();
              inputRef.current?.focus();
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
            onClick={() => {
              // Add 00
              if (cents > 0 && cents < 999999) {
                onChange((cents * 100) / 100);
              }
            }}
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
