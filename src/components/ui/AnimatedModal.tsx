/**
 * AnimatedModal Component
 * Reusable modal/drawer container with smooth entry and exit transitions:
 * - On mobile: Slides up from bottom on open, slides down on close
 * - On desktop: Fades and scales in on open, fades and scales out on close
 * - Handles backdrop blur, ESC key dismiss, and outside clicks
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';

export interface AnimatedModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string; // e.g. 'max-w-md', 'max-w-lg', 'max-w-2xl'
  className?: string;
  isDrawerOnMobile?: boolean;
}

const SM_MAX_WIDTH_MAP: Record<string, string> = {
  'max-w-sm': 'sm:max-w-sm',
  'max-w-md': 'sm:max-w-md',
  'max-w-lg': 'sm:max-w-lg',
  'max-w-xl': 'sm:max-w-xl',
  'max-w-2xl': 'sm:max-w-2xl',
};

export function AnimatedModal({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-md',
  className = '',
  isDrawerOnMobile = true,
}: AnimatedModalProps) {
  const [shouldRender, setShouldRender] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (closingTimerRef.current) {
        clearTimeout(closingTimerRef.current);
        closingTimerRef.current = null;
      }
      setShouldRender(true);
      setIsClosing(false);
    } else if (shouldRender && !isClosing) {
      setIsClosing(true);
      closingTimerRef.current = setTimeout(() => {
        setShouldRender(false);
        setIsClosing(false);
        closingTimerRef.current = null;
      }, 190);
    }
  }, [isOpen, shouldRender, isClosing]);

  const handleRequestClose = useCallback(() => {
    if (isClosing) return;
    onClose();
  }, [isClosing, onClose]);

  // Handle ESC key
  useEffect(() => {
    if (!shouldRender || isClosing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleRequestClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shouldRender, isClosing, handleRequestClose]);

  // Prevent background scrolling when modal/drawer is open
  useEffect(() => {
    if (shouldRender && !isClosing) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [shouldRender, isClosing]);

  if (!shouldRender) return null;

  const modalNode = (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          handleRequestClose();
        }
      }}
      className={`fixed inset-0 z-50 flex overflow-x-hidden ${
        isDrawerOnMobile ? 'items-end sm:items-center' : 'items-center'
      } justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-200 ${
        isClosing ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      <div
        className={`w-full max-w-full ${SM_MAX_WIDTH_MAP[maxWidth] || `sm:${maxWidth}`} ${
          isDrawerOnMobile
            ? `max-h-[92dvh] sm:max-h-[90dvh] rounded-t-3xl sm:rounded-2xl ${
                isClosing ? 'animate-drawer-out sm:animate-modal-out' : 'animate-drawer-in sm:animate-modal-in'
              }`
            : `max-h-[90dvh] rounded-2xl ${isClosing ? 'animate-modal-out' : 'animate-modal-in'}`
        } bg-white dark:bg-slate-900 border-t sm:border border-slate-200 dark:border-slate-800 shadow-2xl flex flex-col overflow-hidden transition-all pb-[env(safe-area-inset-bottom,0px)] ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {isDrawerOnMobile && (
          <div className="sm:hidden flex justify-center pt-2.5 pb-1 shrink-0">
            <div className="h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
          </div>
        )}
        {children}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalNode, document.body) : modalNode;
}

export default AnimatedModal;

