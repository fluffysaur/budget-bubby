/**
 * DeleteAccountModal Component
 * Prompts for destructive confirmation before deleting an account and cascading its balance snapshots.
 */

import { useState } from "react";
import type { Account } from "../../types/finance";
import { financeService } from "../../services/financeService";
import { formatSGD } from "../../lib/currency";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Alert } from "../ui/Alert";

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
            subtitle="This action cannot be undone"
            confirmLabel="Delete Account"
            cancelLabel="Keep Account"
            variant="danger"
            isLoading={isDeleting}
            errorMessage={error}
        >
            <div className="space-y-3">
                <p className="text-xs sm:text-sm text-(--text-ink) leading-relaxed">
                    Are you sure you want to delete{" "}
                    <span className="font-bold">{account.name}</span>
                    {account.institution
                        ? ` (${account.institution})`
                        : ""}{" "}
                    with current balance of{" "}
                    <span className="font-bold text-(--text-ink) font-mono-num">
                        {formatSGD(account.balance)}
                    </span>
                    ?
                </p>

                <Alert variant="danger" title="Warning:">
                    Deleting this account will permanently remove all historical
                    balance snapshots, net worth timeline entries, and monthly
                    records associated with it.
                </Alert>
            </div>
        </ConfirmModal>
    );
}

export default DeleteAccountModal;
