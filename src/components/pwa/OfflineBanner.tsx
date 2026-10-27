import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Loader2, CheckCircle2 } from 'lucide-react';
import { useOptionalHousehold } from '../../context/HouseholdContext';
import { getPendingSyncCount } from '../../services/offlineSyncQueue';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pendingCount, setPendingCount] = useState<number>(() => getPendingSyncCount());
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [showSyncedConfirmation, setShowSyncedConfirmation] = useState<boolean>(false);
  const household = useOptionalHousehold();
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Listen to offlineSyncStatusChanged custom event
    const handleSyncStatus = (event: Event) => {
      if (!isMounted) return;
      const customEvent = event as CustomEvent<{
        pendingCount: number;
        isSyncing: boolean;
        lastSyncedCount?: number;
      }>;
      if (customEvent.detail) {
        setPendingCount(customEvent.detail.pendingCount);
        if (customEvent.detail.isSyncing !== undefined) {
          setIsSyncing(customEvent.detail.isSyncing);
        }
        if (
          !customEvent.detail.isSyncing &&
          customEvent.detail.lastSyncedCount !== undefined &&
          customEvent.detail.lastSyncedCount > 0
        ) {
          setShowSyncedConfirmation(true);
          if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
          hideTimerRef.current = setTimeout(() => {
            if (isMounted) setShowSyncedConfirmation(false);
          }, 3500);
        }
      }
    };

    const handleOnline = () => {
      if (!isMounted) return;
      setIsOnline(true);
      const count = getPendingSyncCount();
      if (count > 0) {
        setIsSyncing(true);
      } else {
        // Connection returned with no pending mutations to flush: show synced pill
        setShowSyncedConfirmation(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => {
          if (isMounted) setShowSyncedConfirmation(false);
        }, 3500);
      }

      if (household?.refreshData) {
        household.refreshData().catch(console.error);
      }
    };

    const handleOffline = () => {
      if (!isMounted) return;
      setIsOnline(false);
      setIsSyncing(false);
      setShowSyncedConfirmation(false);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setPendingCount(getPendingSyncCount());
    };

    window.addEventListener('offlineSyncStatusChanged', handleSyncStatus);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      isMounted = false;
      window.removeEventListener('offlineSyncStatusChanged', handleSyncStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    };
  }, [household]);

  if (isOnline && !isSyncing && !showSyncedConfirmation) {
    return null;
  }

  // 1. Offline Mode alert bar
  if (!isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition-colors z-40 bg-amber-500 text-slate-950 dark:bg-amber-600 dark:text-white"
      >
        <WifiOff className="w-3.5 h-3.5 shrink-0" />
        <span>
          {pendingCount > 0
            ? `Offline Mode — ${pendingCount} ${
                pendingCount === 1 ? 'expense' : 'expenses'
              } queued locally. Will sync automatically when back online.`
            : 'You are offline. Showing cached Budget Bubby view.'}
        </span>
      </div>
    );
  }

  // 2. Syncing in progress spinner
  if (isSyncing) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition-colors z-40 bg-sky-600 text-white"
      >
        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
        <span>Syncing offline changes to Supabase...</span>
      </div>
    );
  }

  // 3. Reconnected and synced confirmation pill (visible for 3.5s)
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition-colors z-40 bg-emerald-600 text-white"
    >
      <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-200" />
      <span>✓ All changes synced to Supabase</span>
    </div>
  );
};
