/**
 * TooltipPopover Component
 * Mobile-friendly interactive tooltip & popover that triggers on tap (mobile)
 * or click/hover (desktop) to reveal contextual explanations, breakdowns, or formulas
 * without cluttering the primary UI.
 */

import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';

export interface TooltipPopoverProps {
  title?: string;
  children: React.ReactNode;
  triggerLabel?: React.ReactNode;
  label?: string;
  ariaLabel?: string;
  align?: 'left' | 'right' | 'center';
  className?: string;
}

export function TooltipPopover({
  title,
  children,
  triggerLabel,
  label,
  ariaLabel,
  align = 'right',
  className = '',
}: TooltipPopoverProps) {
  const effectiveAriaLabel = ariaLabel || label || 'More information';
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  const alignmentClass =
    align === 'left'
      ? 'left-0'
      : align === 'center'
      ? 'left-1/2 -translate-x-1/2'
      : 'right-0';

  return (
    <div ref={containerRef} className={`relative inline-flex items-center ${className}`}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => !prev);
        }}
        aria-label={effectiveAriaLabel}
        aria-expanded={isOpen}
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
      >
        {triggerLabel || <HelpCircle className="h-3.5 w-3.5" />}
      </button>

      {isOpen && (
        <div
          role="tooltip"
          onClick={(e) => e.stopPropagation()}
          className={`absolute top-full mt-2 z-50 w-64 sm:w-72 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3.5 shadow-xl text-xs text-slate-600 dark:text-slate-300 animate-in fade-in zoom-in-95 duration-100 ${alignmentClass}`}
        >
          {title && (
            <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-slate-100 dark:border-slate-800">
              <span className="font-bold text-slate-900 dark:text-white">{title}</span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close tooltip"
                className="p-0.5 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          <div className="space-y-1.5 leading-relaxed">{children}</div>
        </div>
      )}
    </div>
  );
}

export default TooltipPopover;

