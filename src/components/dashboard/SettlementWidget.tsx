/**
 * SettlementWidget Component
 * Splitwise-style Running Settlement card for couple expenses:
 * - "Who Owes Whom" running settlement balance
 * - Breakdown of what each partner paid towards shared expenses
 * - Interactive "Settle Up" action with confirmation dialog
 */

import { useState, useMemo } from 'react';
import {
  Scale,
  CheckCircle2,
  ArrowRightLeft,
  CheckCheck,
  X,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { useOptionalHousehold } from '../../context/HouseholdContext';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { mockMembers } from '../../data/mockSeedData';
import type {
  Expense,
  HouseholdMember,
  SettlementSummary,
} from '../../types/finance';

export interface SettlementWidgetProps {
  summary?: SettlementSummary;
  members?: HouseholdMember[];
  expenses?: Expense[];
  onSettled?: () => void | Promise<void>;
  className?: string;
}

export function SettlementWidget({
  summary: propSummary,
  members: propMembers,
  expenses: propExpenses,
  onSettled,
  className = '',
}: SettlementWidgetProps) {
  const household = useOptionalHousehold();
  const overview = household?.overview;
  const ctxMembers = household?.members;
  const refreshHousehold = household?.refreshData;

  const [isConfirmOpen, setIsConfirmOpen] = useState<boolean>(false);
  const [isSettling, setIsSettling] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fallback members
  const members = useMemo(() => {
    if (propMembers && propMembers.length >= 2) return propMembers;
    if (ctxMembers && ctxMembers.length >= 2) return ctxMembers;
    if (overview?.members && overview.members.length >= 2) return overview.members;
    return mockMembers;
  }, [propMembers, ctxMembers, overview]);

  const m1 = members[0] || mockMembers[0];
  const m2 = members[1] || mockMembers[1];

  // Fallback summary
  const summary = useMemo<SettlementSummary>(() => {
    if (propSummary) return propSummary;
    if (overview?.settlementSummary) return overview.settlementSummary;
    return {
      netBalance: 0,
      debtorId: null,
      creditorId: null,
      settlementText: 'All settled up',
      member1OwesMember2: 0,
      member2OwesMember1: 0,
    };
  }, [propSummary, overview]);

  const isZero = summary.netBalance === 0;

  // Breakdown of shared payments
  const { m1Paid, m2Paid } = useMemo(() => {
    if (propExpenses && propExpenses.length > 0) {
      const p1 = propExpenses
        .filter((e) => e.is_shared && !e.settled && e.payer_id === m1.id)
        .reduce((sum, e) => sum + e.amount, 0);
      const p2 = propExpenses
        .filter((e) => e.is_shared && !e.settled && e.payer_id === m2.id)
        .reduce((sum, e) => sum + e.amount, 0);
      return {
        m1Paid: Math.round(p1 * 100) / 100,
        m2Paid: Math.round(p2 * 100) / 100,
      };
    }

    // Derive from summary owes when 50/50 split
    const p1 = summary.member2OwesMember1 * 2;
    const p2 = summary.member1OwesMember2 * 2;
    return {
      m1Paid: Math.round(p1 * 100) / 100,
      m2Paid: Math.round(p2 * 100) / 100,
    };
  }, [propExpenses, m1.id, m2.id, summary]);

  // Execute settlement
  const handleConfirmSettleUp = async () => {
    try {
      setIsSettling(true);
      setErrorMessage(null);
      await financeService.settleSharedExpenses(m1.id, m2.id);
      if (onSettled) {
        await onSettled();
      } else if (refreshHousehold) {
        await refreshHousehold();
      }
      setIsConfirmOpen(false);
    } catch (err: any) {
      console.error('Failed to settle shared expenses:', err);
      setErrorMessage(err.message || 'Failed to settle expenses');
    } finally {
      setIsSettling(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Shared Expense Settlement Center"
      className={`rounded-3xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 sm:p-7 shadow-xs transition-colors ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-5 border-b border-slate-100 dark:border-slate-800/80">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
            <Scale className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Running Settlement
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Couple shared expenses (50/50 split balance)
            </p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-800 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:text-slate-300">
          <ArrowRightLeft className="h-3 w-3" />
          <span>50 / 50 Split</span>
        </span>
      </div>

      {/* Main Status Display */}
      <div className="mt-5 rounded-2xl bg-slate-50 dark:bg-slate-800/50 p-5 border border-slate-200/60 dark:border-slate-700/60">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Settlement Status
            </span>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white">
                {formatSGD(summary.netBalance)}
              </span>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                net balance
              </span>
            </div>
            <p
              className={`mt-1 text-sm font-semibold flex items-center gap-1.5 ${
                isZero
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-amber-600 dark:text-amber-400'
              }`}
            >
              {isZero ? (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>All settled up</span>
                </>
              ) : (
                <>
                  <Scale className="h-4 w-4 shrink-0" />
                  <span>{summary.settlementText}</span>
                </>
              )}
            </p>
          </div>

          {/* Settle Up Action Button */}
          <div>
            <button
              type="button"
              disabled={isZero}
              onClick={() => setIsConfirmOpen(true)}
              className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold shadow-xs transition-all ${
                isZero
                  ? 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-600 cursor-not-allowed'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 active:scale-95 cursor-pointer'
              }`}
            >
              <CheckCheck className="h-4 w-4" />
              <span>Settle Up</span>
            </button>
          </div>
        </div>
      </div>

      {/* Partner Contributions Breakdown */}
      <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Member 1 Breakdown */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{m1.avatar_url || '👨'}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {m1.display_name}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Paid Shared</span>
          </div>
          <div className="mt-2 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            {formatSGD(m1Paid)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {m2.display_name} owes {formatSGD(summary.member2OwesMember1)}
          </p>
        </div>

        {/* Member 2 Breakdown */}
        <div className="rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{m2.avatar_url || '👩'}</span>
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {m2.display_name}
              </span>
            </div>
            <span className="text-[11px] font-semibold text-slate-400">Paid Shared</span>
          </div>
          <div className="mt-2 text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
            {formatSGD(m2Paid)}
          </div>
          <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
            {m1.display_name} owes {formatSGD(summary.member1OwesMember2)}
          </p>
        </div>
      </div>

      {/* Confirmation Modal */}
      {isConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="settle-dialog-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
        >
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-slate-900 p-6 shadow-2xl border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                  <CheckCheck className="h-4 w-4" />
                </div>
                <h4
                  id="settle-dialog-title"
                  className="text-base font-bold text-slate-900 dark:text-white"
                >
                  Confirm Settlement
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <p>
                Are you sure you want to mark all shared couple expenses between{' '}
                <strong className="text-slate-900 dark:text-white">{m1.display_name}</strong>{' '}
                and{' '}
                <strong className="text-slate-900 dark:text-white">{m2.display_name}</strong>{' '}
                as settled?
              </p>
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-800 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                  <span>
                    Current outstanding balance is{' '}
                    <strong>{formatSGD(summary.netBalance)}</strong>. After settling,
                    the net balance will reset to S$0.00.
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="rounded-xl bg-rose-50 p-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
                  {errorMessage}
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setIsConfirmOpen(false)}
                disabled={isSettling}
                className="rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSettleUp}
                disabled={isSettling}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-xs transition-colors cursor-pointer"
              >
                {isSettling ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Settling...</span>
                  </>
                ) : (
                  <span>Confirm Settlement</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SettlementWidget;
