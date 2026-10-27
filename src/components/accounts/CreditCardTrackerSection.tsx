/**
 * CreditCardTrackerSection Component
 * Full Credit Card Statements & Due Date Tracker:
 * - List configured credit cards (name, bank, last4, statement day, due day, limit, color)
 * - Select month (e.g. '2026-10') to see and log monthly statement balances
 * - Statement status: statement amount, due date ('Due in 4 days' or 'Overdue by 2 days'), and 1-tap Paid / Unpaid toggle with timestamp
 * - Summary cards: Total CC Bill Due this Month, Total Paid, Total Unpaid
 * - Add / Edit Credit Card modal to configure new cards or update billing/due days
 */

import { useState, useEffect, useCallback, useMemo, type FormEvent } from 'react';
import {
  CreditCard as CreditCardIcon,
  Plus,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Pencil,
  Trash2,
  ChevronLeft,
  ChevronRight,
  ReceiptText,
  DollarSign,
  X,
  FileCheck2,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { StatCard } from '../ui/StatCard';
import { AnimatedModal } from '../ui/AnimatedModal';
import { financeService } from '../../services/financeService';
import { formatSGD } from '../../lib/currency';
import { getCurrentMonth, getTodayDateString, formatDisplayMonth, formatDisplayDate, addMonths } from '../../lib/dateUtils';
import { AddEditCreditCardModal } from './AddEditCreditCardModal';
import type { CreditCard, CreditCardStatement, HouseholdMember, UpsertCreditCardStatementInput } from '../../types/finance';

export interface CreditCardTrackerSectionProps {
  members: HouseholdMember[];
  perspective?: string;
  activeMemberId?: string;
  className?: string;
}

export function getRelativeDueLabel(dueDateStr: string, isPaid: boolean, paidAt?: string | null): {
  label: string;
  isOverdue: boolean;
  isDueToday: boolean;
  daysDiff: number;
} {
  if (isPaid) {
    const formatted = paidAt ? formatDisplayDate(paidAt.slice(0, 10)) : '';
    return {
      label: formatted ? `Paid on ${formatted}` : 'Paid',
      isOverdue: false,
      isDueToday: false,
      daysDiff: 0,
    };
  }

  const todayStr = getTodayDateString();
  const todayParts = todayStr.split('-').map(Number);
  const dueParts = dueDateStr.split('-').map(Number);
  const today = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const due = new Date(dueParts[0], dueParts[1] - 1, dueParts[2]);

  const diffMs = due.getTime() - today.getTime();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays);
    return {
      label: `Overdue by ${overdue} day${overdue === 1 ? '' : 's'}`,
      isOverdue: true,
      isDueToday: false,
      daysDiff: diffDays,
    };
  } else if (diffDays === 0) {
    return {
      label: 'Due today',
      isOverdue: false,
      isDueToday: true,
      daysDiff: 0,
    };
  } else {
    return {
      label: `Due in ${diffDays} day${diffDays === 1 ? '' : 's'}`,
      isOverdue: false,
      isDueToday: false,
      daysDiff: diffDays,
    };
  }
}

export function CreditCardTrackerSection({
  members,
  perspective = 'household',
  activeMemberId,
  className = '',
}: CreditCardTrackerSectionProps) {
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default to 2026-10 or current month
    const cur = getCurrentMonth();
    return cur.startsWith('2026') ? cur : '2026-10';
  });

  const [cards, setCards] = useState<CreditCard[]>([]);
  const [statements, setStatements] = useState<CreditCardStatement[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Card modal states
  const [isAddEditCardOpen, setIsAddEditCardOpen] = useState<boolean>(false);
  const [cardToEdit, setCardToEdit] = useState<CreditCard | null>(null);

  // Statement modal states
  const [isLogStatementOpen, setIsLogStatementOpen] = useState<boolean>(false);
  const [statementCard, setStatementCard] = useState<CreditCard | null>(null);
  const [existingStatement, setExistingStatement] = useState<CreditCardStatement | null>(null);
  const [stmtAmountInput, setStmtAmountInput] = useState<string>('');
  const [stmtDueDateInput, setStmtDueDateInput] = useState<string>('');
  const [stmtNotesInput, setStmtNotesInput] = useState<string>('');
  const [stmtError, setStmtError] = useState<string | null>(null);
  const [isSavingStmt, setIsSavingStmt] = useState<boolean>(false);

  // Delete card confirmation
  const [cardToDelete, setCardToDelete] = useState<CreditCard | null>(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [allCards, monthStatements] = await Promise.all([
        financeService.getCreditCards(),
        financeService.getCreditCardStatements(selectedMonth),
      ]);
      setCards(allCards || []);
      setStatements(monthStatements || []);
    } catch (err) {
      console.error('Failed to load credit cards or statements:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Filter cards by perspective
  const filteredCards = useMemo(() => {
    return cards.filter((c) => {
      if (perspective === 'household') return true;
      return !c.owner_id || c.owner_id === activeMemberId;
    });
  }, [cards, perspective, activeMemberId]);

  // Map card_id to statement for current month
  const statementMap = useMemo(() => {
    const map = new Map<string, CreditCardStatement>();
    for (const stmt of statements) {
      map.set(stmt.card_id, stmt);
    }
    return map;
  }, [statements]);

  // Financial Summaries for the selected month
  const { totalBillDue, totalPaid, totalUnpaid } = useMemo(() => {
    let dueSum = 0;
    let paidSum = 0;
    let unpaidSum = 0;

    for (const card of filteredCards) {
      const stmt = statementMap.get(card.id);
      if (stmt) {
        dueSum += stmt.statement_amount;
        if (stmt.is_paid) {
          paidSum += stmt.statement_amount;
        } else {
          unpaidSum += stmt.statement_amount;
        }
      }
    }

    return {
      totalBillDue: Math.round(dueSum * 100) / 100,
      totalPaid: Math.round(paidSum * 100) / 100,
      totalUnpaid: Math.round(unpaidSum * 100) / 100,
    };
  }, [filteredCards, statementMap]);

  // 1-Tap Toggle Paid / Unpaid
  const handleTogglePaid = async (stmt: CreditCardStatement) => {
    try {
      const nextPaid = !stmt.is_paid;
      const input: UpsertCreditCardStatementInput = {
        card_id: stmt.card_id,
        month: stmt.month,
        statement_amount: stmt.statement_amount,
        due_date: stmt.due_date,
        is_paid: nextPaid,
        paid_at: nextPaid ? new Date().toISOString() : null,
        notes: stmt.notes,
      };
      await financeService.upsertCreditCardStatement(input);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle statement paid status:', err);
    }
  };

  // Open Log/Edit Statement Modal
  const handleOpenLogStatement = (card: CreditCard) => {
    const stmt = statementMap.get(card.id);
    setStatementCard(card);
    setExistingStatement(stmt || null);
    if (stmt) {
      setStmtAmountInput(String(stmt.statement_amount));
      setStmtDueDateInput(stmt.due_date);
      setStmtNotesInput(stmt.notes || '');
    } else {
      setStmtAmountInput('');
      // Calculate sensible default due date: next month on card's due_day
      const nextMonthStr = addMonths(selectedMonth, 1);
      const safeDay = String(Math.min(28, card.due_day || 5)).padStart(2, '0');
      setStmtDueDateInput(`${nextMonthStr}-${safeDay}`);
      setStmtNotesInput('');
    }
    setStmtError(null);
    setIsLogStatementOpen(true);
  };

  const handleSaveStatement = async (e: FormEvent) => {
    e.preventDefault();
    if (!statementCard) return;
    setStmtError(null);

    const amount = parseFloat(stmtAmountInput);
    if (isNaN(amount) || amount < 0) {
      setStmtError('Please enter a valid statement balance amount (e.g. 842.50)');
      return;
    }

    if (!stmtDueDateInput) {
      setStmtError('Please choose a due date');
      return;
    }

    try {
      setIsSavingStmt(true);
      await financeService.upsertCreditCardStatement({
        card_id: statementCard.id,
        month: selectedMonth,
        statement_amount: Math.round(amount * 100) / 100,
        due_date: stmtDueDateInput,
        notes: stmtNotesInput.trim() ? stmtNotesInput.trim() : null,
        is_paid: existingStatement ? existingStatement.is_paid : false,
        paid_at: existingStatement ? existingStatement.paid_at : null,
      });
      await loadData();
      setIsLogStatementOpen(false);
    } catch (err: unknown) {
      setStmtError(err instanceof Error ? err.message : 'Failed to save statement');
    } finally {
      setIsSavingStmt(false);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    try {
      await financeService.deleteCreditCard(cardId);
      setCardToDelete(null);
      await loadData();
    } catch (err) {
      console.error('Failed to delete credit card:', err);
    }
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="credit-card-tracker-section">
      {/* Month Navigation & Add Card Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
            <ReceiptText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white">
              Credit Card Statements &amp; Due Dates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Track monthly billing statements, 1-tap paid status, and payment due days
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Month Stepper */}
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 p-1">
            <button
              type="button"
              aria-label="Previous Month"
              onClick={() => setSelectedMonth((m) => addMonths(m, -1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="px-2 text-xs font-bold text-slate-800 dark:text-slate-200 min-w-[90px] text-center">
              {formatDisplayMonth(selectedMonth)}
            </div>
            <button
              type="button"
              aria-label="Next Month"
              onClick={() => setSelectedMonth((m) => addMonths(m, 1))}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <Button
            variant="primary"
            size="sm"
            aria-label="Add Credit Card"
            leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
            onClick={() => {
              setCardToEdit(null);
              setIsAddEditCardOpen(true);
            }}
          >
            Add Card
          </Button>
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          title="Total CC Bill Due this Month"
          value={formatSGD(totalBillDue)}
          subtitle={`Across ${filteredCards.length} configured card${filteredCards.length === 1 ? '' : 's'}`}
          icon={<ReceiptText className="h-4 w-4" />}
          iconBg="bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400"
        />

        <StatCard
          title="Total Paid"
          value={formatSGD(totalPaid)}
          subtitle="Cleared statements"
          icon={<FileCheck2 className="h-4 w-4" />}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
        />

        <StatCard
          title="Total Unpaid"
          value={formatSGD(totalUnpaid)}
          subtitle={totalUnpaid > 0 ? 'Pending payment' : 'All clear for this month!'}
          icon={<AlertTriangle className="h-4 w-4" />}
          iconBg={totalUnpaid > 0 ? 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}
        />
      </div>

      {/* Card Listing */}
      {isLoading ? (
        <div className="flex items-center justify-center p-12 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-400 text-xs">
          Loading credit cards &amp; statements...
        </div>
      ) : filteredCards.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-10 text-center">
          <CreditCardIcon className="h-10 w-10 text-slate-400 mb-3" />
          <h3 className="text-sm font-bold text-slate-800 dark:text-white">No Credit Cards Configured</h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1">
            Add your DBS, OCBC, UOB, or Citi credit cards to track statement billing cycles and payment due dates.
          </p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => {
              setCardToEdit(null);
              setIsAddEditCardOpen(true);
            }}
          >
            Add Your First Card
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="credit-card-list">
          {filteredCards.map((card) => {
            const stmt = statementMap.get(card.id);
            const owner = members.find((m) => m.id === card.owner_id);
            const dueStatus = stmt
              ? getRelativeDueLabel(stmt.due_date, stmt.is_paid, stmt.paid_at)
              : null;

            return (
              <div
                key={card.id}
                data-testid={`credit-card-card-${card.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs hover:shadow-md transition-all dark:border-slate-800 dark:bg-slate-900 relative overflow-hidden"
              >
                {/* Color Top Stripe */}
                <div
                  className="absolute top-0 left-0 right-0 h-1.5"
                  style={{ backgroundColor: card.color || '#0284c7' }}
                />

                <div>
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-2 mt-1">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold text-xs shadow-xs shrink-0"
                        style={{ backgroundColor: card.color || '#0284c7' }}
                      >
                        {card.bank.slice(0, 4)}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-1" title={card.name}>
                          {card.name}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {card.last4 && (
                            <span className="font-mono text-[11px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded-md">
                              •••• {card.last4}
                            </span>
                          )}
                          <span>{card.bank}</span>
                          {owner && (
                            <>
                              <span>•</span>
                              <span>{owner.display_name}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        aria-label={`Edit ${card.name}`}
                        onClick={() => {
                          setCardToEdit(card);
                          setIsAddEditCardOpen(true);
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:text-slate-200 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete ${card.name}`}
                        onClick={() => setCardToDelete(card)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:text-rose-400 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Card Configuration Specs */}
                  <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl bg-slate-50 dark:bg-slate-800/40 p-2.5 text-center text-xs">
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Statement Day</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{card.billing_day}th</span>
                    </div>
                    <div className="border-x border-slate-200 dark:border-slate-700/60">
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Due Day</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">{card.due_day}th</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-semibold text-slate-400 block">Limit</span>
                      <span className="font-bold text-slate-700 dark:text-slate-200">
                        {card.credit_limit ? formatSGD(card.credit_limit) : 'No limit'}
                      </span>
                    </div>
                  </div>

                  {/* Statement Information for Selected Month */}
                  <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {stmt ? (
                      <div className="space-y-2.5">
                        <div className="flex items-baseline justify-between">
                          <span className="text-xs text-slate-500 dark:text-slate-400">Statement Amount</span>
                          <span className="text-base font-extrabold text-slate-900 dark:text-white">
                            {formatSGD(stmt.statement_amount)}
                          </span>
                        </div>

                        {/* Due Date & Relative Status */}
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                            <Calendar className="h-3.5 w-3.5" />
                            <span>Due {formatDisplayDate(stmt.due_date)}</span>
                          </div>

                          {dueStatus && (
                            <span
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                stmt.is_paid
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                                  : dueStatus.isOverdue
                                  ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                                  : dueStatus.isDueToday
                                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                  : 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800'
                              }`}
                            >
                              {stmt.is_paid ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : dueStatus.isOverdue ? (
                                <AlertTriangle className="h-3 w-3" />
                              ) : (
                                <Clock className="h-3 w-3" />
                              )}
                              <span>{dueStatus.label}</span>
                            </span>
                          )}
                        </div>

                        {stmt.notes && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-1">
                            &ldquo;{stmt.notes}&rdquo;
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                        No statement logged for {formatDisplayMonth(selectedMonth)}
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Actions: 1-Tap Paid / Unpaid Toggle & Log Statement */}
                <div className="mt-4 border-t border-slate-100 dark:border-slate-800 pt-3 flex items-center justify-between gap-2">
                  {stmt ? (
                    <>
                      <button
                        type="button"
                        aria-label={stmt.is_paid ? `Mark ${card.name} statement as Unpaid` : `Mark ${card.name} statement as Paid`}
                        onClick={() => handleTogglePaid(stmt)}
                        className={`flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                          stmt.is_paid
                            ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs'
                            : 'bg-slate-100 dark:bg-slate-800 hover:bg-emerald-50 text-slate-700 dark:text-slate-200 hover:text-emerald-600 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        <CheckCircle2 className={`h-3.5 w-3.5 ${stmt.is_paid ? 'text-white' : 'text-slate-400'}`} />
                        <span>{stmt.is_paid ? 'Paid' : 'Mark as Paid'}</span>
                      </button>

                      <button
                        type="button"
                        aria-label={`Edit ${card.name} statement`}
                        onClick={() => handleOpenLogStatement(card)}
                        className="py-1.5 px-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/80 dark:text-slate-300 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer shrink-0"
                      >
                        Edit
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      aria-label={`Log statement for ${card.name}`}
                      onClick={() => handleOpenLogStatement(card)}
                      className="w-full inline-flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-xl text-xs font-bold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-900/50 border border-indigo-200/60 dark:border-indigo-800 transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Log Statement</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Card Modal */}
      <AddEditCreditCardModal
        isOpen={isAddEditCardOpen}
        onClose={() => setIsAddEditCardOpen(false)}
        card={cardToEdit}
        members={members}
        defaultOwnerId={activeMemberId}
        onCardSaved={loadData}
      />

      {/* Log / Edit Statement Modal */}
      <AnimatedModal
        isOpen={isLogStatementOpen}
        onClose={() => setIsLogStatementOpen(false)}
        maxWidth="max-w-md"
      >
        <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-indigo-600" />
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  {existingStatement ? 'Edit Statement' : 'Log Monthly Statement'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {statementCard?.name} • {formatDisplayMonth(selectedMonth)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsLogStatementOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSaveStatement} className="p-5 space-y-4">
            {stmtError && (
              <div className="p-3 text-xs font-semibold rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50">
                {stmtError}
              </div>
            )}

            <div>
              <label htmlFor="stmt-amount" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-slate-400" />
                <span>Statement Balance (SGD) *</span>
              </label>
              <input
                id="stmt-amount"
                type="number"
                step="0.01"
                min="0"
                value={stmtAmountInput}
                onChange={(e) => setStmtAmountInput(e.target.value)}
                placeholder="e.g. 842.50"
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-base font-bold text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                required
                autoFocus
              />
            </div>

            <div>
              <label htmlFor="stmt-due-date" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-slate-400" />
                <span>Payment Due Date *</span>
              </label>
              <input
                id="stmt-due-date"
                type="date"
                value={stmtDueDateInput}
                onChange={(e) => setStmtDueDateInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label htmlFor="stmt-notes" className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Notes (Optional)
              </label>
              <input
                id="stmt-notes"
                type="text"
                value={stmtNotesInput}
                onChange={(e) => setStmtNotesInput(e.target.value)}
                placeholder="e.g. Miles & dining, Shopee rebate"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-hidden dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" type="button" onClick={() => setIsLogStatementOpen(false)}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" disabled={isSavingStmt}>
                {isSavingStmt ? 'Saving...' : 'Save Statement'}
              </Button>
            </div>
          </form>
        </div>
      </AnimatedModal>

      {/* Delete Card Confirmation Modal */}
      {cardToDelete && (
        <AnimatedModal
          isOpen={true}
          onClose={() => setCardToDelete(null)}
          maxWidth="max-w-sm"
        >
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Delete Credit Card</h3>
                <p className="text-xs text-slate-500">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300">
              Are you sure you want to delete <span className="font-bold">{cardToDelete.name}</span>? All logged monthly statements for this card will also be removed.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setCardToDelete(null)}>
                Cancel
              </Button>
              <button
                type="button"
                onClick={() => handleDeleteCard(cardToDelete.id)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition-colors cursor-pointer"
              >
                Delete Card
              </button>
            </div>
          </div>
        </AnimatedModal>
      )}
    </div>
  );
}
