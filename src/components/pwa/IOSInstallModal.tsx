import React from "react";
import { Share, PlusSquare } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { Button } from "../ui/Button";

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

                <ModalBody className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink)">
                        <div className="p-1.5 rounded-lg bg-(--accent-lilac-subtle) text-(--text-ink) border border-(--border-ink) shrink-0">
                            <Share className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-(--text-ink)">
                            1. Tap Share
                        </p>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink)">
                        <div className="p-1.5 rounded-lg bg-(--accent-lilac-subtle) text-(--text-ink) border border-(--border-ink) shrink-0">
                            <PlusSquare className="w-4 h-4" />
                        </div>
                        <p className="text-xs font-bold text-(--text-ink)">
                            2. Add to Home Screen
                        </p>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-xl bg-(--bg-cream) border-2 border-(--border-ink)">
                        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-(--pastel-lilac) text-(--text-ink) border border-(--border-ink) text-xs font-bold shrink-0">
                            3
                        </div>
                        <p className="text-xs font-bold text-(--text-ink)">
                            3. Tap Add
                        </p>
                    </div>
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="primary"
                        type="button"
                        onClick={onClose}
                        className="w-full"
                    >
                        Got it
                    </Button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
};
