/**
 * Minimalist 6-digit PIN Lock Screen.
 * Unlocks Budget Buddy directly based on the user's unique 6-digit PIN.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Lock, Delete, RotateCcw, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export interface PinLoginScreenProps {
  onSuccess?: () => void;
}

export function PinLoginScreen({ onSuccess }: PinLoginScreenProps) {
  const { signInWithPin, authLoading, authError, clearAuthError } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Clear any existing auth error when user starts typing
  const handleDigit = useCallback(
    async (digit: string) => {
      if (authLoading || pin.length >= 6) return;
      clearAuthError();
      const nextPin = pin + digit;
      setPin(nextPin);

      // Once 6 digits are reached, immediately submit
      if (nextPin.length === 6) {
        const ok = await signInWithPin(nextPin);
        if (ok) {
          onSuccess?.();
        } else {
          setIsShaking(true);
          setTimeout(() => {
            setIsShaking(false);
            setPin('');
          }, 600);
        }
      }
    },
    [authLoading, pin, clearAuthError, signInWithPin, onSuccess]
  );

  const handleBackspace = useCallback(() => {
    if (authLoading || pin.length === 0) return;
    clearAuthError();
    setPin((prev) => prev.slice(0, -1));
  }, [authLoading, pin, clearAuthError]);

  const handleClear = useCallback(() => {
    if (authLoading) return;
    clearAuthError();
    setPin('');
  }, [authLoading, clearAuthError]);

  // Physical keyboard support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (authLoading) return;
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [authLoading, handleDigit, handleBackspace, handleClear]);

  // Focus container on mount
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  const numpadDigits = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-slate-100 px-4 py-8 select-none outline-none"
    >
      <div className="w-full max-w-xs flex flex-col items-center">
        {/* App Branding & Icon */}
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-4 shadow-lg shadow-emerald-950/40">
          <Lock className="h-8 w-8 animate-pulse" />
        </div>

        <h1 className="text-2xl font-bold tracking-tight text-white mb-1">
          Budget Bubby
        </h1>
        <p className="text-xs font-medium text-slate-400 mb-8">
          Enter your 6-digit PIN to unlock <span className="text-slate-600 dark:text-slate-500">•</span> <button type="button" onClick={() => signInWithPin('000000').then((ok) => ok && onSuccess?.())} className="text-emerald-400/90 hover:underline cursor-pointer">Demo PIN: 000000</button>
        </p>

        {/* 6 PIN Indicator Dots */}
        <div
          data-testid="pin-dots-container"
          className={`flex items-center justify-center gap-3.5 mb-8 transition-transform duration-200 ${
            isShaking ? 'animate-bounce text-rose-500' : ''
          }`}
        >
          {Array.from({ length: 6 }).map((_, idx) => {
            const isFilled = idx < pin.length;
            return (
              <div
                key={idx}
                data-testid={`pin-dot-${idx}`}
                className={`h-4 w-4 rounded-full border transition-all duration-150 ${
                  isFilled
                    ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-sm shadow-emerald-500/50'
                    : 'border-slate-600 bg-slate-800'
                }`}
              />
            );
          })}
        </div>

        {/* Auth Error Display */}
        {authError && (
          <div
            role="alert"
            className="flex items-center gap-2 mb-6 px-3.5 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium animate-in fade-in"
          >
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{authError}</span>
          </div>
        )}

        {/* Loading Spinner during authentication */}
        {authLoading && (
          <div className="flex items-center gap-2 mb-6 text-emerald-400 text-xs font-medium animate-in fade-in">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Unlocking household...</span>
          </div>
        )}

        {/* Interactive Touch Numpad */}
        <div className="grid grid-cols-3 gap-3.5 w-full">
          {numpadDigits.map((digit) => (
            <button
              key={digit}
              type="button"
              disabled={authLoading}
              onClick={() => handleDigit(digit)}
              aria-label={`Digit ${digit}`}
              className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xl font-semibold text-slate-100 shadow-sm hover:bg-slate-700 active:scale-95 active:bg-emerald-600 active:border-emerald-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
            >
              {digit}
            </button>
          ))}

          {/* Reset / Clear */}
          <button
            type="button"
            disabled={authLoading || pin.length === 0}
            onClick={handleClear}
            aria-label="Clear PIN"
            className="h-16 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-500/30 disabled:opacity-30"
          >
            <RotateCcw className="h-5 w-5" />
          </button>

          {/* Digit 0 */}
          <button
            type="button"
            disabled={authLoading}
            onClick={() => handleDigit('0')}
            aria-label="Digit 0"
            className="h-16 rounded-2xl bg-slate-800/80 border border-slate-700/60 text-xl font-semibold text-slate-100 shadow-sm hover:bg-slate-700 active:scale-95 active:bg-emerald-600 active:border-emerald-500 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/30 disabled:opacity-50"
          >
            0
          </button>

          {/* Backspace */}
          <button
            type="button"
            disabled={authLoading || pin.length === 0}
            onClick={handleBackspace}
            aria-label="Backspace"
            className="h-16 rounded-2xl bg-slate-800/40 border border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800 active:scale-95 transition-all flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-slate-500/30 disabled:opacity-30"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

export default PinLoginScreen;
