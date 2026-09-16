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
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/60 dark:border-blue-800/40"
          >
            <Shield className="w-3 h-3" />
            Insurance
          </span>
        );
      case 'tax':
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200/60 dark:border-purple-800/40"
          >
            <FileText className="w-3 h-3" />
            Tax
          </span>
        );
      case 'subscription':
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/60 dark:border-amber-800/40"
          >
            <Repeat className="w-3 h-3" />
            Subscription
          </span>
        );
      default:
        return (
          <span
            role="status"
            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search policies or notes..."
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              Clear
            </button>
          )}
        </div>

        {/* Type pills */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
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
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900 shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
                }`}
              >
                {labels[type]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/75 dark:bg-slate-800/50 text-xs font-semibold text-slate-600 dark:text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-4">Policy Name</th>
              <th className="py-3.5 px-4">Type</th>
              <th className="py-3.5 px-4">Owner</th>
              <th className="py-3.5 px-4">Frequency</th>
              <th className="py-3.5 px-4 text-right">Premium</th>
              <th className="py-3.5 px-4 text-right">Monthly Amortized</th>
              <th className="py-3.5 px-4">Renewal</th>
              <th className="py-3.5 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-sm">
            {filteredPolicies.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-500 dark:text-slate-400">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2 text-slate-400 opacity-60" />
                  <p className="font-medium">No policies found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    Try adjusting your search query or filter selection.
                  </p>
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

                return (
                  <tr
                    key={policy.id}
                    className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    {/* Policy Name & Notes */}
                    <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-white">
                      <div>
                        <span>{policy.name}</span>
                        {policy.notes && (
                          <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-1 font-normal">
                            {policy.notes}
                          </p>
                        )}
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderTypeBadge(policy.type)}
                    </td>

                    {/* Owner / Insured */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <span className="inline-flex items-center gap-1.5 font-medium">
                        <span className="text-xs">
                          {getOwnerLabel(policy.owner_id) === 'Yi Jia' ? '👨' : '👩'}
                        </span>
                        {getOwnerLabel(policy.owner_id)}
                      </span>
                    </td>

                    {/* Frequency */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300 capitalize">
                      {policy.frequency}
                    </td>

                    {/* Premium Amount */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right font-semibold text-slate-900 dark:text-white">
                      {formatSGD(policy.amount)}
                    </td>

                    {/* Monthly Amortized Outflow */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right text-slate-700 dark:text-slate-300 font-medium">
                      {formatSGD(policy.monthly_amortized_amount)}
                      <span className="text-xs text-slate-400 font-normal">/mo</span>
                    </td>

                    {/* Renewal Month */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600 dark:text-slate-300">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          isMonthly
                            ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                            : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                        }`}
                      >
                        {renewalMonthText}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        {onEdit && (
                          <button
                            type="button"
                            aria-label={`Edit ${policy.name}`}
                            onClick={() => onEdit(policy)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors"
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
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:text-rose-400 dark:hover:text-rose-300 dark:hover:bg-rose-950/40 transition-colors"
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
