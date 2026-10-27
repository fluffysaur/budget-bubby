/**
 * Minimalist 6-digit PIN Lock Screen with WebAuthn Biometric Authentication.
 * Unlocks Budget Bubby directly based on the user's unique 6-digit PIN or Touch ID / Face ID.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Lock,
  Delete,
  RotateCcw,
  AlertCircle,
  Loader2,
  Fingerprint,
  ScanFace,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import {
  isBiometricsAvailable,
  isBiometricsEnrolled,
  authenticateWithBiometrics,
  enrollBiometrics,
  disableBiometrics,
} from '../../lib/webauthnBiometrics';

export interface PinLoginScreenProps {
  onSuccess?: () => void;
}

export function PinLoginScreen({ onSuccess }: PinLoginScreenProps) {
  const { signInWithPin, authLoading, authError, clearAuthError } = useAuth();
  const [pin, setPin] = useState<string>('');
  const [isShaking, setIsShaking] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Biometrics States
  const [biometricsAvailable, setBiometricsAvailable] = useState<boolean>(false);
  const [biometricsEnrolled, setBiometricsEnrolled] = useState<boolean>(false);
  const [isBiometricAuthenticating, setIsBiometricAuthenticating] = useState<boolean>(false);
  const [biometricError, setBiometricError] = useState<string | null>(null);

  // Enrollment Prompt Modal State
  const [showEnrollPrompt, setShowEnrollPrompt] = useState<boolean>(false);
  const [pendingPin, setPendingPin] = useState<string>('');
  const [isEnrolling, setIsEnrolling] = useState<boolean>(false);

  // Check biometric support & status on mount
  useEffect(() => {
    let mounted = true;
    async function checkBio() {
      const available = await isBiometricsAvailable();
      const enrolled = isBiometricsEnrolled();
      if (mounted) {
        setBiometricsAvailable(available);
        setBiometricsEnrolled(enrolled);
      }
    }
    checkBio();
    return () => {
      mounted = false;
    };
  }, []);

  // Handle Biometric Unlock
  const handleBiometricUnlock = useCallback(async () => {
    if (authLoading || isBiometricAuthenticating) return;
    clearAuthError();
    setBiometricError(null);
    setIsBiometricAuthenticating(true);

    try {
      const unlockedPin = await authenticateWithBiometrics();
      if (unlockedPin) {
        const ok = await signInWithPin(unlockedPin);
        if (ok) {
          onSuccess?.();
          return;
        }
      }
      setBiometricError('Biometric verification failed. Please enter your PIN.');
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Biometric authentication was cancelled or unavailable.';
      setBiometricError(message);
    } finally {
      setIsBiometricAuthenticating(false);
    }
  }, [authLoading, isBiometricAuthenticating, clearAuthError, signInWithPin, onSuccess]);

  // Handle PIN submission
  const processPinSubmission = useCallback(
    async (submittedPin: string) => {
      const ok = await signInWithPin(submittedPin);
      if (ok) {
        // If biometrics are available but not yet enrolled, prompt enrollment
        if (biometricsAvailable && !isBiometricsEnrolled()) {
          setPendingPin(submittedPin);
          setShowEnrollPrompt(true);
        } else {
          onSuccess?.();
        }
      } else {
        setIsShaking(true);
        setTimeout(() => {
          setIsShaking(false);
          setPin('');
        }, 600);
      }
    },
    [signInWithPin, biometricsAvailable, onSuccess]
  );

  // Clear any existing auth error when user starts typing
  const handleDigit = useCallback(
    async (digit: string) => {
      if (authLoading || pin.length >= 6) return;
      clearAuthError();
      setBiometricError(null);
      const nextPin = pin + digit;
      setPin(nextPin);

      // Once 6 digits are reached, immediately submit
      if (nextPin.length === 6) {
        await processPinSubmission(nextPin);
      }
    },
    [authLoading, pin, clearAuthError, processPinSubmission]
  );

  const handleBackspace = useCallback(() => {
    if (authLoading || pin.length === 0) return;
    clearAuthError();
    setBiometricError(null);
    setPin((prev) => prev.slice(0, -1));
  }, [authLoading, pin, clearAuthError]);

  const handleClear = useCallback(() => {
    if (authLoading) return;
    clearAuthError();
    setBiometricError(null);
    setPin('');
  }, [authLoading, clearAuthError]);

  // Disable Biometrics Handler
  const handleDisableBiometrics = useCallback(() => {
    disableBiometrics();
    setBiometricsEnrolled(false);
    setBiometricError(null);
  }, []);

  // Confirm Enrollment Handler
  const handleConfirmEnrollment = useCallback(async () => {
    if (!pendingPin) return;
    setIsEnrolling(true);
    setBiometricError(null);
    try {
      await enrollBiometrics(pendingPin, 'Budget Bubby Member');
      setBiometricsEnrolled(true);
      setShowEnrollPrompt(false);
      onSuccess?.();
    } catch (err: unknown) {
      console.error('Failed to enroll biometrics:', err);
      // Still proceed to app if enrollment cancelled
      setShowEnrollPrompt(false);
      onSuccess?.();
    } finally {
      setIsEnrolling(false);
    }
  }, [pendingPin, onSuccess]);

  const handleSkipEnrollment = useCallback(() => {
    setShowEnrollPrompt(false);
    onSuccess?.();
  }, [onSuccess]);

  // Physical keyboard support
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (authLoading || showEnrollPrompt) return;
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
  }, [authLoading, showEnrollPrompt, handleDigit, handleBackspace, handleClear]);

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
        <p className="text-xs font-medium text-slate-400 mb-6 text-center">
          Enter your 6-digit PIN to unlock{' '}
          <span className="text-slate-600 dark:text-slate-500">•</span>{' '}
          <button
            type="button"
            onClick={() => processPinSubmission('000000')}
            className="text-emerald-400/90 hover:underline cursor-pointer"
          >
            Demo PIN: 000000
          </button>
        </p>

        {/* Biometrics Quick Unlock Banner (When Enrolled) */}
        {biometricsEnrolled && (
          <button
            type="button"
            data-testid="biometric-unlock-btn"
            onClick={handleBiometricUnlock}
            disabled={authLoading || isBiometricAuthenticating}
            className="w-full flex items-center justify-center gap-2.5 py-3 px-4 mb-6 rounded-2xl bg-gradient-to-r from-emerald-500/20 via-teal-500/20 to-emerald-500/20 hover:from-emerald-500/30 hover:to-teal-500/30 border border-emerald-500/40 text-emerald-300 font-bold text-sm shadow-md active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            {isBiometricAuthenticating ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
                <span>Scanning Biometrics...</span>
              </>
            ) : (
              <>
                <Fingerprint className="h-5 w-5 text-emerald-400" />
                <span>Unlock with Fingerprint / Face ID</span>
              </>
            )}
          </button>
        )}

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

        {/* Biometric Error Display */}
        {biometricError && (
          <div
            role="alert"
            data-testid="biometric-error-alert"
            className="flex items-center gap-2 mb-4 px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium animate-in fade-in"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-400" />
            <span>{biometricError}</span>
          </div>
        )}

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

        {/* Biometrics Settings / Disable link */}
        {biometricsEnrolled ? (
          <button
            type="button"
            data-testid="disable-biometrics-btn"
            onClick={handleDisableBiometrics}
            className="mt-6 text-xs text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
          >
            Disable biometric unlock
          </button>
        ) : biometricsAvailable ? (
          <div className="mt-6 flex items-center gap-1.5 text-xs text-slate-400">
            <ScanFace className="h-4 w-4 text-emerald-400" />
            <span>Biometric unlock supported on this device</span>
          </div>
        ) : null}
      </div>

      {/* Biometrics Enrollment Dialog */}
      {showEnrollPrompt && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="enroll-biometrics-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in overflow-hidden"
        >
          <div className="w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-400 mb-4 border border-emerald-500/30">
                <Fingerprint className="h-8 w-8" />
              </div>

              <h2
                id="enroll-biometrics-title"
                className="text-lg font-bold text-white mb-2"
              >
                Enable Biometric Login?
              </h2>

              <p className="text-xs text-slate-400 mb-6 leading-relaxed">
                Unlock Budget Bubby faster next time using Touch ID, Face ID, or
                your device fingerprint without entering your 6-digit PIN.
              </p>

              <div className="w-full flex flex-col gap-2.5">
                <button
                  type="button"
                  data-testid="confirm-enroll-biometrics-btn"
                  disabled={isEnrolling}
                  onClick={handleConfirmEnrollment}
                  className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isEnrolling ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Enrolling Device...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Enable Biometrics</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  data-testid="skip-enroll-biometrics-btn"
                  disabled={isEnrolling}
                  onClick={handleSkipEnrollment}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-all cursor-pointer"
                >
                  Skip for Now
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default PinLoginScreen;
