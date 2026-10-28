/**
 * NotificationCenterPopover Component
 * 
 * Features:
 * - Bell icon with dynamic badge count of active reminders
 * - Popover menu displaying:
 *   - Daily spend check-in reminders with 1-tap "Check In Now" action
 *   - Monthly balance update reminders with "Update Balances" action
 *   - Credit card payment due alerts with "View CC Bill" action
 * - Quick action handling and permission opt-in for Service Worker PWA notifications
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bell,
  Flame,
  Landmark,
  CreditCard,
  CheckCircle2,
  X,
  ChevronRight,
} from 'lucide-react';
import {
  computeActiveReminders,
  requestNotificationPermission,
  type AppReminder,
} from '../../lib/notificationScheduler';
import { financeService } from '../../services/financeService';
import { getTodayDateString } from '../../lib/dateUtils';
import { playChaChingSound } from '../../lib/soundEffects';
import { useHousehold } from '../../context/HouseholdContext';

export interface NotificationCenterPopoverProps {
  className?: string;
  onNavigateTab?: (tab: string) => void;
  onOpenUpdateBalances?: () => void;
}

export function NotificationCenterPopover({
  className = '',
  onNavigateTab,
  onOpenUpdateBalances,
}: NotificationCenterPopoverProps) {
  const { activeMember, members, refreshData } = useHousehold();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [reminders, setReminders] = useState<AppReminder[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  const activeMemberId = activeMember?.id || members?.[0]?.id || 'mem-00000000-0011';

  // Check notification permission state
  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Load reminders
  const loadReminders = useCallback(async () => {
    try {
      const active = await computeActiveReminders({ memberId: activeMemberId });
      setReminders(active);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  }, [activeMemberId]);

  useEffect(() => {
    loadReminders();
  }, [loadReminders]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Escape key listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Filter out dismissed reminders
  const visibleReminders = reminders.filter((r) => !dismissedIds.has(r.id));
  const count = visibleReminders.length;

  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleRequestPermission = async () => {
    const res = await requestNotificationPermission();
    setPermission(res);
  };

  // Execute reminder action
  const handleAction = async (reminder: AppReminder) => {
    setIsProcessing(true);
    try {
      if (reminder.actionType === 'check_in') {
        const today = getTodayDateString();
        await financeService.recordDailyCheckin(activeMemberId, today, 'no_spend');
        playChaChingSound();
        handleDismiss(reminder.id);
        await refreshData();
        await loadReminders();
      } else if (reminder.actionType === 'update_balances') {
        setIsOpen(false);
        if (onOpenUpdateBalances) {
          onOpenUpdateBalances();
        } else if (onNavigateTab) {
          onNavigateTab('accounts');
        }
      } else if (reminder.actionType === 'view_cc') {
        setIsOpen(false);
        if (onNavigateTab) {
          onNavigateTab('expenses');
        }
      }
    } catch (err) {
      console.error('Failed to execute reminder action:', err);
    } finally {
      setIsProcessing(false);
    }
  };

  const getReminderIcon = (type: AppReminder['type']) => {
    switch (type) {
      case 'daily_checkin':
        return <Flame className="h-4 w-4 text-amber-500 shrink-0" />;
      case 'balance_update':
        return <Landmark className="h-4 w-4 text-blue-500 shrink-0" />;
      case 'credit_card_due':
        return <CreditCard className="h-4 w-4 text-rose-500 shrink-0" />;
      default:
        return <Bell className="h-4 w-4 text-emerald-500 shrink-0" />;
    }
  };

  return (
    <div ref={popoverRef} className={`relative inline-block ${className}`}>
      {/* Bell Icon Button */}
      <button
        type="button"
        data-testid="notification-bell-btn"
        aria-label={`Notifications and reminders (${count} active)`}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-(--shadow-cute-sm) transition-all hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none focus:outline-none cursor-pointer"
      >
        <Bell className="h-4 w-4 stroke-[2.2]" />

        {count > 0 && (
          <span
            data-testid="notification-badge-count"
            className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#f76b57] border border-(--border-ink) px-1 text-[10px] font-black text-white shadow-(--shadow-cute-sm) animate-in zoom-in-75 font-mono-num"
          >
            {count}
          </span>
        )}
      </button>

      {/* Popover Card */}
      {isOpen && (
        <div
          data-testid="notification-center-popover"
          role="region"
          aria-label="Notification center"
          className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-(--shadow-cute-lg) z-50 animate-in fade-in-50 zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b-[1.5px] border-(--border-subtle)">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)">
                <Bell className="h-4 w-4 stroke-[2.2]" />
              </div>
              <h3 className="text-xs font-black text-(--text-ink) font-display">
                Notifications &amp; Reminders
              </h3>
              {count > 0 && (
                <span className="rounded-full bg-(--bg-cream) border border-(--border-ink) px-2 py-0.5 text-[10px] font-black text-(--text-ink) font-mono-num">
                  {count}
                </span>
              )}
            </div>

            <button
              type="button"
              aria-label="Close notification center"
              onClick={() => setIsOpen(false)}
              className="rounded-lg p-1 text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Browser Permission Prompt Banner */}
          {permission === 'default' && (
            <div className="mt-3 flex items-center justify-between gap-2 p-2.5 rounded-xl bg-[#bbf7d0]/40 border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm)">
              <div className="text-[11px] text-[#14532d] dark:text-[#86efac] font-bold">
                Enable PWA reminders on this device?
              </div>
              <button
                type="button"
                data-testid="enable-push-notifications-btn"
                onClick={handleRequestPermission}
                className="px-2.5 py-1 rounded-lg bg-[#bbf7d0] text-[#14532d] border border-(--border-ink) text-[10px] font-black hover:bg-[#86efac] transition-colors cursor-pointer"
              >
                Enable
              </button>
            </div>
          )}

          {/* Reminders List */}
          <div className="mt-3 max-h-72 overflow-y-auto space-y-2.5 pr-0.5">
            {visibleReminders.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#bbf7d0] text-[#14532d] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) mb-2">
                  <CheckCircle2 className="h-5 w-5 stroke-[2.2]" />
                </div>
                <p className="text-xs font-black text-(--text-ink)">
                  All caught up!
                </p>
                <p className="text-[11px] text-(--text-muted) font-medium mt-0.5">
                  No pending check-ins or due reminders today.
                </p>
              </div>
            ) : (
              visibleReminders.map((reminder) => (
                <div
                  key={reminder.id}
                  data-testid={`reminder-card-${reminder.id}`}
                  className="rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) p-3 shadow-(--shadow-cute-sm) transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getReminderIcon(reminder.type)}
                      <h4 className="text-xs font-bold text-(--text-ink)">
                        {reminder.title}
                      </h4>
                    </div>

                    <button
                      type="button"
                      data-testid={`reminder-dismiss-${reminder.id}`}
                      aria-label="Dismiss reminder"
                      onClick={() => handleDismiss(reminder.id)}
                      className="text-(--text-muted) hover:text-(--text-ink) p-0.5 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <p className="mt-1 text-[11px] text-(--text-muted) font-medium leading-snug">
                    {reminder.message}
                  </p>

                  <div className="mt-2.5 flex items-center justify-end">
                    <button
                      type="button"
                      data-testid={`reminder-action-${reminder.actionType}`}
                      disabled={isProcessing}
                      onClick={() => handleAction(reminder)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none text-[11px] font-black transition-all cursor-pointer disabled:opacity-50"
                    >
                      <span>{reminder.actionLabel}</span>
                      <ChevronRight className="h-3 w-3 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationCenterPopover;
