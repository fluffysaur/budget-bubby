import React from 'react';
import { TooltipPopover } from './TooltipPopover';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  tooltip?: React.ReactNode;
  tooltipTitle?: string;
  badge?: React.ReactNode;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  subtitle,
  tooltip,
  tooltipTitle,
  badge,
  icon,
  actions,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${className}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          {icon && <div className="shrink-0">{icon}</div>}
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h1>
          {badge && <div className="shrink-0">{badge}</div>}
          {tooltip && (
            <TooltipPopover
              title={tooltipTitle || (typeof title === 'string' ? title : 'Details')}
              ariaLabel={`${typeof title === 'string' ? title : 'Page'} info`}
              align="left"
            >
              {tooltip}
            </TooltipPopover>
          )}
        </div>
        {subtitle && (
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {subtitle}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center flex-wrap gap-2 sm:gap-2.5">
          {actions}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
