/**
 * Perspective Banner Component
 * Visually confirms the active financial perspective (Combined vs Yi Jia vs Rachel).
 * Uses a slim single-line layout on mobile with a TooltipPopover for scope details.
 */

import { Users, User, ShieldCheck } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';
import { TooltipPopover } from '../ui/TooltipPopover';

export interface PerspectiveBannerProps {
  className?: string;
}

export function PerspectiveBanner({ className = '' }: PerspectiveBannerProps) {
  const { perspective, activeMember, members } = useHousehold();

  const isHousehold = perspective === 'household';

  // Build household members label dynamically
  const membersLabel =
    members && members.length > 0
      ? members.map((m) => m.display_name).join(' & ')
      : 'Yi Jia & Rachel';

  if (isHousehold) {
    return (
      <div
        role="region"
        aria-label="Active Perspective Banner"
        className={`w-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border-b border-emerald-200/60 dark:border-emerald-800/40 px-4 py-1.5 sm:py-2 transition-colors ${className}`}
      >
        <div className="w-full flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Users className="h-3.5 w-3.5" />
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Combined
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                ({membersLabel})
              </span>
              <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
                — Pooled accounts, combined cash flow &amp; 50/50 shared splits
              </span>
              <TooltipPopover
                label="Combined Scope Info"
                title="Combined Household Scope"
              >
                Displaying pooled savings, joint &amp; individual accounts, combined cash flow, and 50/50 expense splits.
              </TooltipPopover>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50 px-2.5 py-0.5 rounded-full shrink-0">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>Joint &amp; Personal Scope</span>
          </div>
        </div>
      </div>
    );
  }

  // Personal perspective
  const displayName = activeMember ? activeMember.display_name : perspective;
  const avatar = activeMember?.avatar_url || '👤';
  const isYiJia = displayName.toLowerCase().includes('yi jia');

  return (
    <div
      role="region"
      aria-label="Active Perspective Banner"
      className={`w-full border-b px-4 py-1.5 sm:py-2 transition-colors ${
        isYiJia
          ? 'bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-blue-500/5 border-blue-200/60 dark:border-blue-800/40'
          : 'bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-rose-500/5 border-rose-200/60 dark:border-rose-800/40'
      } ${className}`}
    >
      <div className="w-full flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`flex h-6 w-6 sm:h-7 sm:w-7 shrink-0 items-center justify-center rounded-lg text-white shadow-xs ${
              isYiJia ? 'bg-blue-600' : 'bg-rose-600'
            }`}
          >
            <span className="text-xs">{avatar}</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                isYiJia
                  ? 'text-blue-800 dark:text-blue-300'
                  : 'text-rose-800 dark:text-rose-300'
              }`}
            >
              {displayName}&apos;s Personal Perspective
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              (Individual Mode)
            </span>
            <span className="hidden md:inline text-xs text-slate-500 dark:text-slate-400">
              — Individual salary, 20% CPF, personal budget &amp; 50% share of joint expenses
            </span>
            <TooltipPopover
              label="Personal Scope Info"
              title={`${displayName}'s Personal Scope`}
            >
              Displaying individual salary, 20% CPF deductions, personal budget categories, owned accounts, and your 50% share of shared household expenses.
            </TooltipPopover>
          </div>
        </div>

        <div
          className={`hidden lg:flex items-center gap-1.5 text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${
            isYiJia
              ? 'bg-blue-100/70 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300'
              : 'bg-rose-100/70 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
          }`}
        >
          <User className="h-3.5 w-3.5" />
          <span>Personal Scope</span>
        </div>
      </div>
    </div>
  );
}

export default PerspectiveBanner;
