import React from 'react';

export interface StatCardProps {
  title: React.ReactNode;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
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
      className={`w-full text-left rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs transition-all ${
        onClick
          ? 'hover:shadow-md hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer active:scale-[0.99]'
          : 'hover:shadow-sm'
      } ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </span>
        <div className="flex items-center gap-2">
          {badge}
          {icon && (
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconBg}`}
            >
              {icon}
            </div>
          )}
        </div>
      </div>

      <div className="mt-2.5">
        <div className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
          {value}
        </div>
        {subtitle && (
          <p className="mt-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            {subtitle}
          </p>
        )}
      </div>

      {footer && <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800">{footer}</div>}
    </Component>
  );
}

export default StatCard;
