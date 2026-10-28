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
        className={`flex h-9 items-center gap-1.5 px-3 rounded-xl border-[1.5px] border-(--border-ink) bg-[#bbf7d0] text-[#14532d] shadow-(--shadow-cute-sm) transition-all hover:bg-[#86efac] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer font-bold text-xs ${className}`}
      >
        <Download className="h-4 w-4 shrink-0 stroke-[2.5]" />
        <span>Install App</span>
      </button>

      <IOSInstallModal
        isOpen={showIOSModal}
        onClose={() => setShowIOSModal(false)}
      />
    </>
  );
};

