import React from "react";
import { Share, PlusSquare } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";

interface IOSInstallModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const IOSInstallModal: React.FC<IOSInstallModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-sm">
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title="Install Budget Bubby"
                    subtitle="Save to your iPhone or iPad home screen"
                    icon={
                        <img
                            src="/icon.svg"
                            alt="Budget Bubby"
                            className="w-5 h-5 object-contain"
                        />
                    }
                    iconBgColor="bg-white"
                    onClose={onClose}
                />

                <ModalBody className="p-4 sm:p-5 space-y-4">
                    <p className="text-xs text-(--text-muted) leading-relaxed">
                        Install Budget Bubby as a standalone app on your home screen for full-screen mode and faster access:
                    </p>

                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink)">
                            <div className="p-1.5 rounded-lg bg-(--accent-lilac-subtle) text-(--text-ink) border border-(--border-ink) mt-0.5 shrink-0">
                                <Share className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-(--text-ink)">
                                    1. Tap the Share button
                                </p>
                                <p className="text-[11px] text-(--text-muted)">
                                    Located in Safari&apos;s bottom toolbar on iPhone or top right on iPad.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink)">
                            <div className="p-1.5 rounded-lg bg-(--accent-lilac-subtle) text-(--text-ink) border border-(--border-ink) mt-0.5 shrink-0">
                                <PlusSquare className="w-4 h-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-(--text-ink)">
                                    2. Select &apos;Add to Home Screen&apos;
                                </p>
                                <p className="text-[11px] text-(--text-muted)">
                                    Scroll down the share sheet and tap the &apos;Add to Home Screen&apos; option.
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 p-2.5 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink)">
                            <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) text-xs font-bold mt-0.5 shrink-0">
                                3
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="text-xs font-semibold text-(--text-ink)">
                                    3. Tap &apos;Add&apos;
                                </p>
                                <p className="text-[11px] text-(--text-muted)">
                                    Confirm in the top-right corner to place the app on your home screen.
                                </p>
                            </div>
                        </div>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full py-2.5 px-4 rounded-xl bg-(--pastel-lilac) hover:bg-(--pastel-lilac-dark) text-(--text-ink) font-bold text-sm border-2 border-(--border-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                    >
                        Got it
                    </button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
};
