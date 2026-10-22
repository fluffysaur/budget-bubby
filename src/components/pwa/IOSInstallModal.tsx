import React from 'react';
import { X, Share, PlusSquare, Smartphone } from 'lucide-react';

interface IOSInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
            <Smartphone className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-base">
              Install Budget Buddy
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Save to your iPhone or iPad home screen
            </p>
          </div>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mb-4 leading-relaxed">
          Install Budget Buddy as a standalone app on your home screen for full-screen mode and faster access:
        </p>

        <div className="space-y-3 mb-5">
          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <Share className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                1. Tap the Share button
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Located in Safari&apos;s bottom toolbar on iPhone or top right on iPad.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 mt-0.5">
              <PlusSquare className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                2. Select &apos;Add to Home Screen&apos;
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Scroll down the share sheet and tap the &apos;Add to Home Screen&apos; option.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800">
            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-bold mt-0.5">
              3
            </div>
            <div>
              <p className="text-xs font-medium text-slate-900 dark:text-slate-100">
                3. Tap &apos;Add&apos;
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Confirm in the top-right corner to place the app on your home screen.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onClose}
          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm transition-colors shadow-sm"
        >
          Got it
        </button>
      </div>
    </div>
  );
};

