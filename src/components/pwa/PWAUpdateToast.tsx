import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';

export const PWAUpdateToast: React.FC = () => {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for SW updates periodically (e.g. every hour)
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000);
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  if (!needRefresh && !offlineReady) {
    return null;
  }

  return (
    <aside
      aria-label="Application update notification"
      className="fixed bottom-20 md:bottom-6 right-4 z-50 max-w-sm rounded-xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 p-4 shadow-xl backdrop-blur-md transition-all animate-slide-up"
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          {needRefresh ? (
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <RefreshCw className="w-4 h-4 animate-spin" />
            </div>
          ) : (
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
        </div>

        <div className="flex-1 pr-2">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {needRefresh ? 'New version available' : 'Ready for offline use'}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {needRefresh
              ? 'An updated version of Budget Bubby is ready to reload.'
              : 'App assets are cached. You can open Budget Bubby without network.'}
          </p>

          {needRefresh && (
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={() => updateServiceWorker(true)}
                className="px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-sm transition-colors"
              >
                Update now
              </button>
              <button
                onClick={close}
                className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Later
              </button>
            </div>
          )}
        </div>

        <button
          onClick={close}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </aside>
  );
};

