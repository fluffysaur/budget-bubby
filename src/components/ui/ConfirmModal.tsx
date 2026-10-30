import React, { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
} from "./AnimatedModal";
import { Button } from "./Button";
import { Alert } from "./Alert";

export interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void | Promise<void>;
    title: string;
    subtitle?: string;
    children?: React.ReactNode;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: "danger" | "primary" | "warning";
    icon?: React.ReactNode;
    isLoading?: boolean;
    errorMessage?: string | null;
    maxWidth?: string;
}

export function ConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    title,
    subtitle,
    children,
    confirmLabel = "Delete",
    cancelLabel = "Cancel",
    variant = "danger",
    icon,
    isLoading: externalLoading,
    errorMessage: externalError,
    maxWidth = "max-w-md",
}: ConfirmModalProps) {
    const [internalLoading, setInternalLoading] = useState(false);
    const [internalError, setInternalError] = useState<string | null>(null);

    const isSubmitting = externalLoading ?? internalLoading;
    const error = externalError ?? internalError;

    const handleConfirm = async () => {
        try {
            setInternalLoading(true);
            setInternalError(null);
            await onConfirm();
        } catch (err) {
            setInternalError(
                err instanceof Error ? err.message : "Action failed",
            );
        } finally {
            setInternalLoading(false);
        }
    };

    const headerIcon =
        icon !== undefined ? (
            icon
        ) : variant === "danger" ? (
            <Trash2 className="h-4.5 w-4.5 text-rose-600" strokeWidth={2.5} />
        ) : (
            <AlertTriangle className="h-4.5 w-4.5 text-amber-600" strokeWidth={2.5} />
        );

    const headerIconBg =
        variant === "danger"
            ? "bg-(--pastel-coral-light)"
            : variant === "warning"
              ? "bg-(--pastel-butter-light)"
              : "bg-(--pastel-lilac-light)";

    const buttonVariant = variant === "danger" ? "danger" : "primary";

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth={maxWidth}>
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    title={title}
                    subtitle={subtitle}
                    icon={headerIcon}
                    iconBgColor={headerIconBg}
                    onClose={onClose}
                />

                <ModalBody>
                    {error && (
                        <Alert variant="danger" className="mb-3">
                            {error}
                        </Alert>
                    )}
                    {children}
                </ModalBody>

                <ModalFooter>
                    <Button
                        variant="ghost"
                        onClick={onClose}
                        disabled={isSubmitting}
                    >
                        {cancelLabel}
                    </Button>
                    <Button
                        variant={buttonVariant}
                        onClick={handleConfirm}
                        isLoading={isSubmitting}
                    >
                        {confirmLabel}
                    </Button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default ConfirmModal;
