/**
 * DeleteAccountModal Component
 * Prompts for destructive confirmation before deleting an account and cascading its balance snapshots.
 */

import { useState } from "react";
import type { Account } from "../../types/finance";
import { financeService } from "../../services/financeService";
import { ConfirmModal } from "../ui/ConfirmModal";

export interface DeleteAccountModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account | null;
    onAccountDeleted?: (accountId: string) => void;
}

export function DeleteAccountModal({
    isOpen,
    onClose,
    account,
    onAccountDeleted,
}: DeleteAccountModalProps) {
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen || !account) return null;

    const handleDelete = async () => {
        try {
            setIsDeleting(true);
            setError(null);
            await financeService.deleteAccount(account.id);
            onAccountDeleted?.(account.id);
            onClose();
        } catch (err: unknown) {
            setError(
                err instanceof Error ? err.message : "Failed to delete account",
            );
            setIsDeleting(false);
        }
    };

    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleDelete}
            title="Delete Account?"
            confirmLabel="Delete"
            cancelLabel="Keep Account"
            variant="danger"
            isLoading={isDeleting}
            errorMessage={error}
        >
            <p className="text-xs sm:text-sm text-(--text-muted) leading-relaxed">
                Removes its balance history.
            </p>
        </ConfirmModal>
    );
}

export default DeleteAccountModal;
