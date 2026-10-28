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
import { PageHeader, Button, StatCard } from '../components/ui';
import { financeService } from '../services/financeService';
import { formatSGD } from '../lib/currency';
import { getSingaporeDate } from '../lib/dateUtils';
import { PolicyTable } from '../components/recurring/PolicyTable';
import { RenewalCalendar } from '../components/recurring/RenewalCalendar';
import { AddPolicyModal } from '../components/recurring/AddPolicyModal';
import type { RecurringPolicy, CreatePolicyInput } from '../types/finance';

export interface RecurringPageProps {
  className?: string;
  embedded?: boolean;
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

export function RecurringPage({ className = '', embedded = false }: RecurringPageProps) {
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
    } catch (err: unknown) {
      console.error('Failed to load recurring policies:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to load recurring policies');
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

  // Metric 1: Total Annual Outflow (Insurance & Tax policies)
  const totalAnnualOutflow = useMemo(() => {
    return inScopePolicies
      .filter((p) => p.type !== 'subscription')
      .reduce((sum, p) => {
        if (p.frequency === 'monthly') {
          return sum + p.amount * 12;
        }
        return sum + p.amount;
      }, 0);
  }, [inScopePolicies]);

  // Metric 2: Monthly Amortized Outflow
  const monthlyAmortizedOutflow = useMemo(() => {
    return inScopePolicies
      .filter((p) => p.type !== 'subscription')
      .reduce((sum, p) => sum + p.monthly_amortized_amount, 0);
  }, [inScopePolicies]);

  // Metric 3 & 4: Monthly Outlay Map, Heaviest Month & Upcoming Renewal
  const { heaviestMonthName, heaviestMonthAmount, upcomingRenewalText, upcomingRenewalSub } = useMemo(() => {
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

    let upcomingPolicyName = 'None upcoming';
    let upcomingPolicySub = 'No upcoming renewals';
    if (nextPolicy && nextPolicy.payment_month) {
      const dueMonthStr = MONTH_NAMES[nextPolicy.payment_month - 1];
      upcomingPolicyName = nextPolicy.name;
      upcomingPolicySub = `${dueMonthStr.slice(0, 3)} • ${formatSGD(nextPolicy.amount)}`;
    } else if (inScopePolicies.some((p) => p.frequency === 'monthly')) {
      upcomingPolicyName = 'Active Subscriptions';
      upcomingPolicySub = 'Billed monthly';
    }

    return {
      heaviestMonthName: heaviestName,
      heaviestMonthAmount: maxVal,
      upcomingRenewalText: upcomingPolicyName,
      upcomingRenewalSub: upcomingPolicySub,
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
    } catch (err: unknown) {
      console.error('Failed to delete policy:', err);
      setErrorMessage(err instanceof Error ? err.message : 'Failed to delete policy');
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
      {/* Page Title & Actions (Compact if embedded) */}
      {!embedded ? (
        <PageHeader
          title="Recurring Policies & Taxes"
          actions={
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="secondary"
                onClick={loadPolicies}
                title="Refresh policies"
                leftIcon={<RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />}
              />
              <Button
                variant="primary"
                className="w-full sm:w-auto"
                leftIcon={<Plus className="w-4 h-4 stroke-[2.5]" />}
                onClick={handleOpenAddModal}
              >
                Add Policy
              </Button>
            </div>
          }
        />
      ) : (
        <div className="flex items-center justify-end w-full">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Button
              variant="secondary"
              size="sm"
              onClick={loadPolicies}
              title="Refresh policies"
              leftIcon={<RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />}
            />
            <Button
              variant="primary"
              size="sm"
              className="flex-1 sm:flex-initial whitespace-nowrap"
              leftIcon={<Plus className="w-3.5 h-3.5 stroke-[2.5]" />}
              onClick={handleOpenAddModal}
            >
              Add Policy
            </Button>
          </div>
        </div>
      )}

      {/* Error Banner */}
      {errorMessage && (
        <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900 dark:text-rose-200 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
          <p className="flex-1">{errorMessage}</p>
        </div>
      )}

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Metric 1: Annual Outflow */}
        <StatCard
          title="Annual Outflow"
          value={formatSGD(totalAnnualOutflow)}
          subtitle={`${inScopePolicies.length} tracked policies`}
          icon={<DollarSign className="w-4 h-4" />}
          iconBg="bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
        />

        {/* Metric 2: Monthly Amortized Outflow */}
        <StatCard
          title="Monthly Amortized"
          value={`${formatSGD(monthlyAmortizedOutflow)}/mo`}
          subtitle="Monthly deduction impact"
          icon={<TrendingDown className="w-4 h-4" />}
          iconBg="bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
        />

        {/* Metric 3: Upcoming Renewal */}
        <StatCard
          title="Next Renewal"
          value={<span className="text-base sm:text-lg truncate block" title={upcomingRenewalText}>{upcomingRenewalText}</span>}
          subtitle={upcomingRenewalSub}
          icon={<CalendarCheck className="w-4 h-4" />}
          iconBg="bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
        />

        {/* Metric 4: Heaviest Month */}
        <StatCard
          title="Heaviest Month"
          value={<span className="text-base sm:text-lg text-rose-600 dark:text-rose-400 truncate block">{heaviestMonthName}</span>}
          subtitle={heaviestMonthAmount > 0 ? `${formatSGD(heaviestMonthAmount)} total` : 'No annual policies'}
          icon={<Flame className="w-4 h-4" />}
          iconBg="bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
        />
      </div>

      {/* 12-Month Renewal Calendar */}
      <div className="p-4 sm:p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
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
