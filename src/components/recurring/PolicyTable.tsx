/**
 * PolicyTable Component
 * Table displaying recurring insurance policies, taxes, and subscriptions.
 * Features:
 * - Columns: Policy Name, Type badge, Insured/Owner, Frequency, Premium Amount, Monthly Amortized Outflow, Renewal Month, Actions
 * - Search by policy name or notes
 * - Filter by policy type (All, Insurance, Tax, Subscription)
 * - Empty state with clear filters option
 * - Edit and Delete actions
 */

import { useState, useMemo } from 'react';
import {
  Shield,
  FileText,
  Repeat,
  Pencil,
  Trash2,
  Search,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { formatSGD } from '../../lib/currency';
import type { RecurringPolicy, RecurringPolicyType } from '../../types/finance';

export interface PolicyTableProps {
  policies: RecurringPolicy[];
  onEdit?: (policy: RecurringPolicy) => void;
  onDelete?: (policyId: string) => void;
  className?: string;
}

const MONTH_NAMES = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

export function PolicyTable({
  policies,
  onEdit,
  onDelete,
  className = '',
}: PolicyTableProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedType, setSelectedType] = useState<'all' | RecurringPolicyType>('all');

  // Filtered policies
  const filteredPolicies = useMemo(() => {
    return policies.filter((policy) => {
      // Type filter
      if (selectedType !== 'all' && policy.type !== selectedType) {
        return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesName = policy.name.toLowerCase().includes(query);
        const matchesNotes = policy.notes?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesNotes) {
          return false;
        }
      }

      return true;
    });
  }, [policies, selectedType, searchTerm]);

  // Helper for owner label
  const getOwnerLabel = (ownerId: string) => {
    if (ownerId.includes('0011') || ownerId.toLowerCase().includes('yj') || ownerId.toLowerCase().includes('yijia')) {
      return 'Yi Jia';
    }
    if (ownerId.includes('0012') || ownerId.toLowerCase().includes('rc') || ownerId.toLowerCase().includes('rachel')) {
      return 'Rachel';
    }
    return 'Joint';
  };

  // Type badge styling
  const renderTypeBadge = (type: RecurringPolicyType) => {
    switch (type) {
      case 'insurance':
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--pastel-lilac-subtle) text-purple-900 dark:text-purple-200 border-[1.5px] border-(--border-ink)"
          >
            <Shield className="w-3 h-3 text-purple-600 dark:text-purple-300" />
            Insurance
          </span>
        );
      case 'tax':
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--pastel-butter-subtle) text-amber-900 dark:text-amber-200 border-[1.5px] border-(--border-ink)"
          >
            <FileText className="w-3 h-3 text-amber-700 dark:text-amber-400" />
            Tax
          </span>
        );
      case 'subscription':
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-(--pastel-mint-subtle) text-emerald-900 dark:text-emerald-200 border-[1.5px] border-(--border-ink)"
          >
            <Repeat className="w-3 h-3 text-emerald-700 dark:text-emerald-400" />
            Subscription
          </span>
        );
      default:
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-[1.5px] border-(--border-ink)"
          >
            <HelpCircle className="w-3 h-3" />
            {type}
          </span>
        );
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-(--color-ink)/50" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search policies or notes..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border-[1.5px] border-(--border-ink) bg-white dark:bg-slate-900 text-(--color-ink) dark:text-white placeholder-slate-400 shadow-cute-sm focus:outline-none focus:shadow-cute transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-(--color-ink)/50 hover:text-(--color-ink) dark:hover:text-white"
            >
              Clear
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {(['all', 'insurance', 'tax', 'subscription'] as const).map((type) => {
            const isActive = selectedType === type;
            const labels: Record<string, string> = {
              all: 'All',
              insurance: 'Insurance',
              tax: 'Tax',
              subscription: 'Subscription',
            };
            return (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType(type)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer border-[1.5px] border-(--border-ink) ${
                  isActive
                    ? 'bg-(--pastel-butter) text-(--color-ink) shadow-cute-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-(--canvas-cream)'
                }`}
              >
                {labels[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border-[1.5px] border-(--border-ink) bg-white dark:bg-slate-900 shadow-cute">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b-[1.5px] border-(--border-ink) bg-(--canvas-cream) dark:bg-slate-800/80 text-xs font-bold text-(--color-ink) dark:text-slate-300 uppercase tracking-wider font-display">
              <th scope="col" className="py-3.5 px-4">Policy Name</th>
              <th scope="col" className="py-3.5 px-4">Type</th>
              <th scope="col" className="py-3.5 px-4">Owner</th>
              <th scope="col" className="py-3.5 px-4">Frequency</th>
              <th scope="col" className="py-3.5 px-4 text-right">Premium</th>
              <th scope="col" className="py-3.5 px-4 text-right">Monthly Amortized</th>
              <th scope="col" className="py-3.5 px-4">Renewal</th>
              <th scope="col" className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
            {filteredPolicies.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                  <p className="font-bold text-base text-(--color-ink) dark:text-white">No policies found</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Try adjusting your search query or filter selection.
                  </p>
                  {(searchTerm || selectedType !== 'all') && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setSelectedType('all');
                      }}
                      className="mt-3 inline-flex items-center text-xs font-bold text-(--color-ink) underline cursor-pointer"
                    >
                      Clear active filters
                    </button>
                  )}
                </td>
              </tr>
            ) : (
              filteredPolicies.map((policy) => {
                const isMonthly = policy.frequency === 'monthly';
                const renewalMonthText = isMonthly
                  ? 'Monthly'
                  : policy.payment_month && policy.payment_month >= 1 && policy.payment_month <= 12
                  ? `${MONTH_NAMES[policy.payment_month - 1]} (M${policy.payment_month})`
                  : 'N/A';
                const owner = getOwnerLabel(policy.owner_id);
                const ownerIcon = owner === 'Yi Jia' ? '👨' : owner === 'Rachel' ? '👩' : '👥';

                return (
                  <tr
                    key={policy.id}
                    className="hover:bg-(--canvas-cream)/50 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Policy Name & Notes */}
                    <td className="py-3.5 px-4 font-bold text-(--color-ink) dark:text-white">
                      <div>
                        <span className="font-display">{policy.name}</span>
                        {policy.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 font-normal">
                            {policy.notes}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3 px-4 whitespace-nowrap">
                      {renderTypeBadge(policy.type)}
                    </td>

                    {/* Owner / Insured */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      <span className="inline-flex items-center gap-2 font-bold">
                        <span className="text-xs">{ownerIcon}</span>
                        {owner}
                      </span>
                    </td>

                    {/* Frequency */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 font-medium capitalize">
                      {policy.frequency}
                    </td>

                    {/* Premium Amount */}
                    <td className="py-3 px-4 whitespace-nowrap text-right font-bold font-mono-num text-(--color-ink) dark:text-white">
                      {formatSGD(policy.amount)}
                    </td>

                    {/* Monthly Amortized Outflow */}
                    <td className="py-3 px-4 whitespace-nowrap text-right text-slate-700 dark:text-slate-300 font-bold font-mono-num">
                      {formatSGD(policy.monthly_amortized_amount)}
                      <span className="text-xs text-slate-400 font-normal ml-0.5">/mo</span>
                    </td>

                    {/* Renewal Month */}
                    <td className="py-3 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-bold border-[1.5px] border-(--border-ink) ${
                          isMonthly
                            ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                            : 'bg-(--pastel-mint-subtle) text-emerald-900 dark:text-emerald-200'
                        }`}
                      >
                        {renewalMonthText}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {onEdit && (
                          <button
                            type="button"
                            aria-label={`Edit ${policy.name}`}
                            onClick={() => onEdit(policy)}
                            className="p-1.5 rounded-lg border-[1.5px] border-transparent hover:border-(--border-ink) hover:bg-(--pastel-butter) text-slate-600 hover:text-(--color-ink) transition-all cursor-pointer"
                            title="Edit policy"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                        )}
                        {onDelete && (
                          <button
                            type="button"
                            aria-label={`Delete ${policy.name}`}
                            onClick={() => onDelete(policy.id)}
                            className="p-1.5 rounded-lg border-[1.5px] border-transparent hover:border-(--border-ink) hover:bg-(--pastel-coral-subtle) text-rose-500 hover:text-rose-700 transition-all cursor-pointer"
                            title="Delete policy"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default PolicyTable;
