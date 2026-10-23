/**
 * GoalsPage Component
 * Milestone savings goals and pacing tracker:
 * - 4 Summary metric cards: Total Target, Total Saved, Overall Progress, Monthly Savings Pace
 * - Filter tabs: All Goals, In Progress, Achieved
 * - Responsive grid of GoalCards with status pacing
 * - AddEditGoalModal for creating/updating goals
 * - QuickDepositModal for instant incremental savings
 * - Auto-refresh on data mutation
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Target,
  Plus,
  PiggyBank,
  Sparkles,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { GoalCard } from '../components/goals/GoalCard';
import { AddEditGoalModal } from '../components/goals/AddEditGoalModal';
import { QuickDepositModal } from '../components/goals/QuickDepositModal';
import type { SavingsGoal } from '../types/finance';

export interface GoalsPageProps {
  className?: string;
  embedded?: boolean;
}

type GoalFilterTab = 'all' | 'in_progress' | 'achieved';

export function GoalsPage({ className = '', embedded = false }: GoalsPageProps) {
  const { perspective, activeMember, overview } = useHousehold();

  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<GoalFilterTab>('all');

  // Modal states
  const [isAddEditOpen, setIsAddEditOpen] = useState<boolean>(false);
  const [editingGoal, setEditingGoal] = useState<SavingsGoal | null>(null);
  const [isDepositOpen, setIsDepositOpen] = useState<boolean>(false);
  const [depositGoal, setDepositGoal] = useState<SavingsGoal | null>(null);

  // Load goals from service
  const loadGoals = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await financeService.getGoals();
      setGoals(data || []);
    } catch (err: unknown) {
      console.error('Failed to load savings goals:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load savings goals');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGoals();
  }, [loadGoals]);

  // Perspective-filtered goals if applicable
  const perspectiveGoals = useMemo(() => {
    return goals.filter((g) => {
      if (perspective === 'household') return true;
      // Joint or assigned to active member
      return !g.owner_id || g.owner_id === activeMember?.id;
    });
  }, [goals, perspective, activeMember]);

  // High-Level Summary Metrics
  const { totalTarget, totalSaved, overallProgress, totalMonthlyContributions } = useMemo(() => {
    const target = perspectiveGoals.reduce((sum, g) => sum + (g.target_amount || 0), 0);
    const saved = perspectiveGoals.reduce((sum, g) => sum + (g.saved_so_far || 0), 0);
    const monthly = perspectiveGoals.reduce((sum, g) => sum + (g.monthly_contribution || 0), 0);
    const progress = target > 0 ? Math.min(100, Math.round((saved / target) * 100)) : 0;

    return {
      totalTarget: target,
      totalSaved: saved,
      overallProgress: progress,
      totalMonthlyContributions: monthly,
    };
  }, [perspectiveGoals]);

  // Filtered by Active Tab
  const inProgressGoals = useMemo(() => {
    return perspectiveGoals.filter((g) => g.saved_so_far < g.target_amount && g.status !== 'achieved');
  }, [perspectiveGoals]);

  const achievedGoals = useMemo(() => {
    return perspectiveGoals.filter((g) => g.saved_so_far >= g.target_amount || g.status === 'achieved');
  }, [perspectiveGoals]);

  const displayedGoals = useMemo(() => {
    if (activeTab === 'in_progress') return inProgressGoals;
    if (activeTab === 'achieved') return achievedGoals;
    return perspectiveGoals;
  }, [perspectiveGoals, activeTab, inProgressGoals, achievedGoals]);

  // Handlers
  const handleOpenCreateModal = () => {
    setEditingGoal(null);
    setIsAddEditOpen(true);
  };

  const handleOpenEditModal = (goal: SavingsGoal) => {
    setEditingGoal(goal);
    setIsAddEditOpen(true);
  };

  const handleOpenDepositModal = (goal: SavingsGoal) => {
    setDepositGoal(goal);
    setIsDepositOpen(true);
  };

  const handleGoalSaved = () => {
    loadGoals();
  };

  const handleDepositSaved = () => {
    loadGoals();
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Page Header (Compact if embedded) */}
      {!embedded ? (
        <PageHeader
          title="Savings Goals & Milestones"
          subtitle="Track joint wedding, HDB down payment, renovation, and couple aspirations with real-time monthly pacing"
          actions={
            <Button
              variant="primary"
              aria-label="+ New Goal"
              leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
              onClick={handleOpenCreateModal}
            >
              New Goal
            </Button>
          }
        />
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Savings Goals &amp; Milestones — track wedding, HDB down payment, and pacing
          </p>
          <Button
            variant="primary"
            size="sm"
            aria-label="+ New Goal"
            leftIcon={<Plus className="h-3.5 w-3.5 stroke-[2.5]" />}
            onClick={handleOpenCreateModal}
          >
            New Goal
          </Button>
        </div>
      )}

      {/* Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-4 text-sm font-medium text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-500" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Target */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Target</span>
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <Target className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {formatSGD(totalTarget)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Across {perspectiveGoals.length} milestone {perspectiveGoals.length === 1 ? 'goal' : 'goals'}
          </div>
        </div>

        {/* Card 2: Total Saved */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Saved</span>
            <div className="rounded-xl bg-emerald-50 p-2 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <PiggyBank className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            {formatSGD(totalSaved)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {formatSGD(Math.max(0, totalTarget - totalSaved))} remaining
          </div>
        </div>

        {/* Card 3: Overall Progress */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Overall Progress</span>
            <div className="rounded-xl bg-amber-50 p-2 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {overallProgress}%
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className="h-full rounded-full bg-amber-500 transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
        </div>

        {/* Card 4: Total Monthly Contributions */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Monthly Savings Pace</span>
            <div className="rounded-xl bg-purple-50 p-2 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
              <Calendar className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {formatSGD(totalMonthlyContributions)}/mo
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Active monthly savings budget
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
        <div role="tablist" className="flex items-center gap-2">
          <button
            role="tab"
            aria-selected={activeTab === 'all'}
            aria-controls="goals-tabpanel"
            onClick={() => setActiveTab('all')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'all'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <span>All Goals</span>
            <span className="rounded-full bg-black/10 dark:bg-white/20 px-1.5 py-0.5 text-[10px]">
              {perspectiveGoals.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'in_progress'}
            aria-controls="goals-tabpanel"
            onClick={() => setActiveTab('in_progress')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'in_progress'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <span>In Progress</span>
            <span className="rounded-full bg-black/10 dark:bg-white/20 px-1.5 py-0.5 text-[10px]">
              {inProgressGoals.length}
            </span>
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'achieved'}
            aria-controls="goals-tabpanel"
            onClick={() => setActiveTab('achieved')}
            className={`flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer ${
              activeTab === 'achieved'
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700'
            }`}
          >
            <span>Achieved</span>
            <span className="rounded-full bg-black/10 dark:bg-white/20 px-1.5 py-0.5 text-[10px]">
              {achievedGoals.length}
            </span>
          </button>
        </div>
      </div>

      {/* Content Area: Loader, Empty State, or Grid */}
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            <span className="text-xs font-semibold">Loading savings goals...</span>
          </div>
        </div>
      ) : displayedGoals.length === 0 ? (
        <div
          id="goals-tabpanel"
          role="tabpanel"
          className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center dark:border-slate-800"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl dark:bg-slate-800">
            🎯
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-800 dark:text-white">
            {activeTab === 'all'
              ? 'No savings goals found'
              : activeTab === 'in_progress'
              ? 'No goals currently in progress'
              : 'No goals achieved yet'}
          </h3>
          <p className="mt-1 max-w-sm text-xs text-slate-500 dark:text-slate-400">
            {activeTab === 'all'
              ? 'Set milestones for your wedding, HDB down payment, renovation, or honeymoon to calculate required monthly pacing.'
              : 'Try changing your filter tab to see your other savings goals.'}
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-blue-700 focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4 stroke-[2.5]" />
            <span>Create your first goal</span>
          </button>
        </div>
      ) : (
        <div id="goals-tabpanel" role="tabpanel" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayedGoals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              onEdit={handleOpenEditModal}
              onQuickDeposit={handleOpenDepositModal}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Goal Modal */}
      <AddEditGoalModal
        isOpen={isAddEditOpen}
        onClose={() => setIsAddEditOpen(false)}
        goal={editingGoal}
        onGoalSaved={handleGoalSaved}
        householdId={overview?.household.id}
      />

      {/* Quick Deposit Modal */}
      <QuickDepositModal
        isOpen={isDepositOpen}
        onClose={() => setIsDepositOpen(false)}
        goal={depositGoal}
        onDepositSaved={handleDepositSaved}
      />
    </div>
  );
}
