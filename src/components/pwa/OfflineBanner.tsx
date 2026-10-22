import React, { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';
import { useOptionalHousehold } from '../../context/HouseholdContext';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState<boolean>(false);
  const household = useOptionalHousehold();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      if (household?.refreshData) {
        household.refreshData().catch(console.error);
      }
      const timer = setTimeout(() => {
        setShowReconnected(false);
      }, 3500);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [household]);

  if (isOnline && !showReconnected) {
    return null;
  }

  return (
    <div
      role="status"
      className={`w-full py-1.5 px-4 text-xs font-medium flex items-center justify-center gap-2 transition-colors z-40 ${
        isOnline
          ? 'bg-emerald-600 text-white'
          : 'bg-amber-500 text-slate-950 dark:bg-amber-600 dark:text-white'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-3.5 h-3.5" />
          <span>Back online. Financial data refreshed.</span>
        </>
      ) : (
        <>
          <WifiOff className="w-3.5 h-3.5" />
          <span>You are offline. Showing cached Budget Buddy view.</span>
        </>
      )}
    </div>
  );
};

