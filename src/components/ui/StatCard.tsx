import React from 'react';
import { TooltipPopover } from './TooltipPopover';

export interface StatCardProps {
  title: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipTitle?: string;
  icon?: React.ReactNode;
  iconBg?: string;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function StatCard({
  title,
  value,
  subtitle,
  tooltip,
  tooltipTitle,
  icon,
  iconBg = 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  badge,
  footer,
  className = '',
  onClick,
}: StatCardProps) {
  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-left rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-5 shadow-xs transition-all ${
        onClick
          ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer active:scale-[0.99]'
          : 'hover:shadow-sm'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[11px] sm:text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 truncate">
            {title}
          </span>
          {tooltip && (
            <TooltipPopover
              title={tooltipTitle || (typeof title === 'string' ? title : 'Details')}
              ariaLabel={`${typeof title === 'string' ? title : 'Metric'} info`}
              align="left"
            >
              {tooltip}
            </TooltipPopover>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {badge}
          {icon && (
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-xl ${iconBg}`}
            >
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2">
        <div className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {value}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-[11px] sm:text-xs font-medium text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {footer && <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">{footer}</div>}
    </Component>
  );
}

export default StatCard;
