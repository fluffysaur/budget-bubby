import React from "react";
import { X, Share, PlusSquare } from "lucide-react";

interface IOSInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-hidden">
            <div className="relative w-full max-w-sm rounded-2xl bg-(--bg-card) p-6 shadow-(--shadow-cute) border-2 border-(--border-ink)">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 p-1.5 rounded-lg text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors"
                    aria-label="Close"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="flex items-center gap-3 mb-4">
                    <img
                        src="/icon.svg"
                        alt="Budget Bubby"
                        className="w-12 h-12 rounded-xl shadow-(--shadow-cute-sm) border-2 border-(--border-ink) object-contain shrink-0"
                    />
                    <div>
                        <h3 className="font-bold text-(--text-ink) text-base font-display">Install Budget Bubby</h3>
                        <p className="text-xs text-(--text-muted)">
                            Save to your iPhone or iPad home screen
                        </p>
                    </div>
                </div>

                <p className="text-xs text-(--text-muted) mb-4 leading-relaxed">
                    Install Budget Bubby as a standalone app on your home screen for full-screen mode and faster access:
                </p>

                <div className="space-y-3 mb-5">
                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-(--bg-cream) border border-(--border-subtle)">
                        <div className="p-1.5 rounded-lg bg-(--accent-lilac-subtle) text-(--text-ink) border border-(--border-ink) mt-0.5 shrink-0">
                            <Share className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-(--text-ink)">
                                1. Tap the Share button
                            </p>
                            <p className="text-[11px] text-(--text-muted)">
                                Located in Safari&apos;s bottom toolbar on iPhone or top right on iPad.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-(--bg-cream) border border-(--border-subtle)">
                        <div className="p-1.5 rounded-lg bg-(--accent-lilac-subtle) text-(--text-ink) border border-(--border-ink) mt-0.5 shrink-0">
                            <PlusSquare className="w-4 h-4" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-(--text-ink)">
                                2. Select &apos;Add to Home Screen&apos;
                            </p>
                            <p className="text-[11px] text-(--text-muted)">
                                Scroll down the share sheet and tap the &apos;Add to Home Screen&apos; option.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-start gap-3 p-2.5 rounded-xl bg-(--bg-cream) border border-(--border-subtle)">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-(--accent-lilac) text-(--text-ink) border border-(--border-ink) text-xs font-bold mt-0.5 shrink-0">
                            3
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-(--text-ink)">
                                3. Tap &apos;Add&apos;
                            </p>
                            <p className="text-[11px] text-(--text-muted)">
                                Confirm in the top-right corner to place the app on your home screen.
                            </p>
                        </div>
                    </div>
                </div>

                <button
                    onClick={onClose}
                    className="w-full py-2.5 px-4 rounded-xl bg-(--accent-lilac) hover:bg-[#d0a4fe] text-(--text-ink) font-bold text-sm border-2 border-(--border-ink) shadow-(--shadow-cute-sm) active:translate-x-0.5 active:translate-y-0.5 transition-all"
                >
                    Got it
                </button>
            </div>
        </div>
    );
};
