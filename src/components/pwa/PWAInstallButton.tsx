import React from 'react';
import { Download } from 'lucide-react';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { IOSInstallModal } from './IOSInstallModal';

interface PWAInstallButtonProps {
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ className = '' }) => {
  const { canInstall, isInstalled, showIOSModal, setShowIOSModal, promptInstall } = usePWAInstall();

  if (isInstalled || !canInstall) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={promptInstall}
        title="Install Budget Bubby App"
        aria-label="Install Budget Bubby App"
        className={`flex h-9 items-center gap-1.5 px-2.5 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 shadow-xs transition-all hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:hover:bg-emerald-900/60 cursor-pointer font-medium text-xs ${className}`}
      >
        <Download className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
        <span className="hidden sm:inline">Install</span>
      </button>

      <IOSInstallModal
        isOpen={showIOSModal}
        onClose={() => setShowIOSModal(false)}
      />
    </>
  );
};

