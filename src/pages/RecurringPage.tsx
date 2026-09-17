/**
 * RecurringPage Component
 * Recurring Policies, Taxes & Annual Renewal Calendar Center:
 * - 4 Summary metric cards: Total Annual Outflow, Monthly Amortized Outflow, Upcoming Renewal, Heaviest Month
 * - Perspective filtering (Combined Household vs Yi Jia vs Rachel)
 * - 12-Month RenewalCalendar timeline
 * - PolicyTable with search, type filters, edit, and delete
 * - AddPolicyModal integration
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Plus,
  DollarSign,
  TrendingDown,
  CalendarCheck,
  Flame,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useHousehold } from '../context/HouseholdContext';
import { PageHeader, Button, Badge } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getSingaporeDate } from '../lib/dateUtils';
import { PolicyTable } from '../components/recurring/PolicyTable';
import { RenewalCalendar } from '../components/recurring/RenewalCalendar';
import { AddPolicyModal } from '../components/recurring/AddPolicyModal';
import type { RecurringPolicy, CreatePolicyInput } from '../types/finance';

export interface RecurringPageProps {
  className?: string;
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function RecurringPage({ className = '' }: RecurringPageProps) {
  const { perspective, activeMember, members } = useHousehold();

  const [policies, setPolicies] = useState<RecurringPolicy[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingPolicy, setEditingPolicy] = useState<RecurringPolicy | null>(null);

  // Load policies
  const loadPolicies = useCallback(async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const data = await financeService.getPolicies();
      setPolicies(data || []);
    } catch (err: any) {
      console.error('Failed to load recurring policies:', err);
      setErrorMessage(err.message || 'Failed to load recurring policies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  // Perspective filtering
  const inScopePolicies = useMemo(() => {
    return policies.filter((policy) => {
      if (perspective === 'household') {
        return true;
      }
      if (perspective === 'yijia') {
        const yiJia = members.find((m) =>
          m.display_name.toLowerCase().includes('yi jia')
        );
        const yjId = yiJia?.id || 'mem-00000000-0011';
        return policy.owner_id === yjId || policy.owner_id === 'joint';
      }
      if (perspective === 'rachel') {
        const rachel = members.find((m) =>
          m.display_name.toLowerCase().includes('rachel')
        );
        const rcId = rachel?.id || 'mem-00000000-0012';
        return policy.owner_id === rcId || policy.owner_id === 'joint';
      }
      return !policy.owner_id || policy.owner_id === activeMember?.id;
    });
  }, [policies, perspective, activeMember, members]);

  // Metric 1: Total Annual Outflow
  // For annual: amount; For monthly: amount * 12
  const totalAnnualOutflow = useMemo(() => {
    return inScopePolicies.reduce((sum, p) => {
      if (p.frequency === 'monthly') {
        return sum + p.amount * 12;
      }
      return sum + p.amount;
    }, 0);
  }, [inScopePolicies]);

  // Metric 2: Monthly Amortized Outflow
  const monthlyAmortizedOutflow = useMemo(() => {
    return inScopePolicies.reduce((sum, p) => sum + p.monthly_amortized_amount, 0);
  }, [inScopePolicies]);

  // Metric 3 & 4: Monthly Outlay Map, Heaviest Month & Upcoming Renewal
  const { heaviestMonthName, heaviestMonthAmount, upcomingRenewalText } = useMemo(() => {
    const monthlyTotals = Array(12).fill(0);
    const sgNow = getSingaporeDate();
    const currentMonthNum = sgNow.getMonth() + 1; // 1-12

    for (const p of inScopePolicies) {
      if (p.frequency === 'monthly') {
        for (let m = 0; m < 12; m++) {
          monthlyTotals[m] += p.amount;
        }
      } else if (p.payment_month && p.payment_month >= 1 && p.payment_month <= 12) {
        monthlyTotals[p.payment_month - 1] += p.amount;
      }
    }

    // Heaviest Month
    const maxVal = Math.max(...monthlyTotals, 0);
    const maxIdx = monthlyTotals.indexOf(maxVal);
    const heaviestName = maxVal > 0 ? MONTH_NAMES[maxIdx] : 'None';

    // Upcoming Renewal: closest annual renewal month >= currentMonthNum, or wrap around
    const annualPolicies = inScopePolicies.filter(
      (p) => p.frequency === 'annually' && p.payment_month
    );

    let nextPolicy: RecurringPolicy | null = null;
    let minDistance = 999;

    for (const p of annualPolicies) {
      const pMonth = p.payment_month!;
      let distance = pMonth - currentMonthNum;
      if (distance < 0) {
        distance += 12; // Next calendar year
      }
      if (distance < minDistance) {
        minDistance = distance;
        nextPolicy = p;
      }
    }

    let upcomingText = 'None upcoming';
    if (nextPolicy && nextPolicy.payment_month) {
      const dueMonthStr = MONTH_NAMES[nextPolicy.payment_month - 1];
      upcomingText = `${nextPolicy.name} (${dueMonthStr.slice(0, 3)}, ${formatSGD(nextPolicy.amount)})`;
    } else if (inScopePolicies.some((p) => p.frequency === 'monthly')) {
      upcomingText = 'Monthly Active Subscriptions';
    }

    return {
      heaviestMonthName: heaviestName,
      heaviestMonthAmount: maxVal,
      upcomingRenewalText: upcomingText,
    };
  }, [inScopePolicies]);

  // Handlers
  const handleOpenAddModal = () => {
    setEditingPolicy(null);
    setIsModalOpen(true);
  };

  const handleEditPolicy = (policy: RecurringPolicy) => {
    setEditingPolicy(policy);
    setIsModalOpen(true);
  };

  const handleDeletePolicy = async (policyId: string) => {
    try {
      await financeService.deletePolicy(policyId);
      await loadPolicies();
    } catch (err: any) {
      console.error('Failed to delete policy:', err);
      setErrorMessage(err.message || 'Failed to delete policy');
    }
  };

  const handleSavePolicy = async (payload: CreatePolicyInput & { id?: string }) => {
    if (payload.id) {
      await financeService.updatePolicy(payload.id, payload);
    } else {
      await financeService.addPolicy(payload);
    }
    await loadPolicies();
  };

  return (
    <div className={`space-y-6 pb-20 md:pb-12 ${className}`}>
      {/* Page Title & Actions */}
      <PageHeader
        title="Recurring Policies & Taxes"
        badge={
          <Badge variant="emerald" size="sm">
            Annual Calendar
          </Badge>
        }
        subtitle="Track insurance coverage, IRAS tax schedules, and recurring household obligations"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={loadPolicies}
              title="Refresh policies"
              leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
            />
            <Button
              variant="primary"
              leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
              onClick={handleOpenAddModal}
            >
              Add Policy
            </Button>
          </>
        }
      />

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="flex-1">{errorMessage}</p>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Total Annual Outflow */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Total Annual Outflow
            </span>
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            {formatSGD(totalAnnualOutflow)}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
            Across {inScopePolicies.length} tracked policies
          </span>
        </div>

        {/* Metric 2: Monthly Amortized Outflow */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Monthly Amortized Outflow
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
              <TrendingDown className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
            {formatSGD(monthlyAmortizedOutflow)}
            <span className="text-sm font-semibold text-slate-400 ml-1">/mo</span>
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
            Monthly budget deduction impact
          </span>
        </div>

        {/* Metric 3: Upcoming Renewal */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Upcoming Renewal
            </span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400">
              <CalendarCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="text-base font-bold text-slate-900 dark:text-white truncate" title={upcomingRenewalText}>
            {upcomingRenewalText}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
            Next scheduled payment obligation
          </span>
        </div>

        {/* Metric 4: Heaviest Month */}
        <div className="p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">
              Heaviest Month
            </span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
              <Flame className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl font-black text-rose-600 dark:text-rose-400 tracking-tight">
            {heaviestMonthName}
            {heaviestMonthAmount > 0 && (
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300 ml-1.5">
                ({formatSGD(heaviestMonthAmount)})
              </span>
            )}
          </p>
          <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
            Highest lump-sum cash demand
          </span>
        </div>
      </div>

      {/* 12-Month Renewal Calendar */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <RenewalCalendar policies={inScopePolicies} />
      </div>

      {/* Policy Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">
            Active Policies &amp; Schedules
          </h2>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {inScopePolicies.length} policy records in scope
          </span>
        </div>

        <PolicyTable
          policies={inScopePolicies}
          onEdit={handleEditPolicy}
          onDelete={handleDeletePolicy}
        />
      </div>

      {/* Add / Edit Policy Modal */}
      <AddPolicyModal
        isOpen={isModalOpen}
        initialPolicy={editingPolicy}
        onClose={() => setIsModalOpen(false)}
        onSave={handleSavePolicy}
      />
    </div>
  );
}

export default RecurringPage;
