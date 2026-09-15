/**
 * Perspective Banner Component
 * Visually confirms the active financial perspective (Combined Household vs Yi Jia vs Rachel).
 * Informs the user which assets, budgets, and personal deductions are currently in scope.
 */

import { Users, User, ShieldCheck } from 'lucide-react';
import { useHousehold } from '../../context/HouseholdContext';

export interface PerspectiveBannerProps {
  className?: string;
}

export function PerspectiveBanner({ className = '' }: PerspectiveBannerProps) {
  const { perspective, activeMember, members } = useHousehold();

  const isHousehold = perspective === 'household';

  // Find partner display names
  const yiJiaMember = members.find((m) =>
    m.display_name.toLowerCase().includes('yi jia')
  );
  const rachelMember = members.find((m) =>
    m.display_name.toLowerCase().includes('rachel')
  );

  const yiJiaName = yiJiaMember ? yiJiaMember.display_name : 'Yi Jia';
  const rachelName = rachelMember ? rachelMember.display_name : 'Rachel';

  if (isHousehold) {
    return (
      <div
        role="region"
        aria-label="Active Perspective Banner"
        className={`w-full bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-emerald-500/5 border-b border-emerald-200/60 dark:border-emerald-800/40 px-4 py-2.5 sm:px-6 transition-colors ${className}`}
      >
        <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-xs">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Combined Household
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  ({yiJiaName} &amp; {rachelName})
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Displaying pooled savings, joint &amp; individual accounts, combined cash flow, and 50/50 expense splits.
              </p>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300 bg-emerald-100/70 dark:bg-emerald-950/50 px-2.5 py-1 rounded-full">
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
      className={`w-full border-b px-4 py-2.5 sm:px-6 transition-colors ${
        isYiJia
          ? 'bg-gradient-to-r from-blue-500/10 via-sky-500/10 to-blue-500/5 border-blue-200/60 dark:border-blue-800/40'
          : 'bg-gradient-to-r from-rose-500/10 via-pink-500/10 to-rose-500/5 border-rose-200/60 dark:border-rose-800/40'
      } ${className}`}
    >
      <div className="mx-auto max-w-7xl flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-8 w-8 items-center justify-center rounded-lg text-white shadow-xs ${
              isYiJia ? 'bg-blue-600' : 'bg-rose-600'
            }`}
          >
            <span className="text-sm">{avatar}</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
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
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Displaying individual salary, 20% CPF deductions, personal budget categories, and owned accounts.
            </p>
          </div>
        </div>

        <div
          className={`hidden lg:flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
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
