import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, CheckCircle2, X } from 'lucide-react';
import { m, AnimatePresence } from 'motion/react';
import { pop } from '../../lib/motion';

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

  const isVisible = needRefresh || offlineReady;

  return (
    <AnimatePresence>
      {isVisible && (
        <m.aside
          key="pwa-update-toast"
          aria-label="Application update notification"
          {...pop}
          className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 right-4 z-50 max-w-sm rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-4 shadow-cute-lg"
        >
          <div className="flex items-start gap-3">
            <div className="shrink-0 mt-0.5">
              {needRefresh ? (
                <div className="p-1.5 rounded-lg border border-(--border-ink) bg-(--pastel-mint-light) text-(--accent-mint-ink)">
                  <RefreshCw className="w-4 h-4 animate-spin" />
                </div>
              ) : (
                <div className="p-1.5 rounded-lg border border-(--border-ink) bg-(--pastel-mint-light) text-(--accent-mint-ink)">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              )}
            </div>

            <div className="flex-1 pr-2">
              <p className="text-sm font-bold text-(--text-ink) font-display">
                {needRefresh ? 'New version available' : 'Ready for offline use'}
              </p>
              <p className="text-xs text-(--text-muted) mt-0.5">
                {needRefresh
                  ? 'An updated version of Budget Bubby is ready to reload.'
                  : 'App assets are cached. You can open Budget Bubby without network.'}
              </p>

              {needRefresh && (
                <div className="mt-3 flex items-center gap-2">
                  <button
                    onClick={() => updateServiceWorker(true)}
                    className="px-3 py-1.5 text-xs font-bold text-(--text-ink) bg-(--pastel-mint) hover:bg-(--pastel-mint-dark) border-2 border-(--border-ink) rounded-xl shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-press"
                  >
                    Update now
                  </button>
                  <button
                    onClick={close}
                    className="px-3 py-1.5 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) rounded-xl transition-colors"
                  >
                    Later
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={close}
              className="text-(--text-faint) hover:text-(--text-ink) p-1 rounded-md transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </m.aside>
      )}
    </AnimatePresence>
  );
};

