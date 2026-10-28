/**
 * DeleteAccountModal Component
 * Prompts for destructive confirmation before deleting an account and cascading its balance snapshots.
 */

import { useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import type { Account } from "../../types/finance";
import { financeService } from "../../services/financeService";
import { formatSGD } from "../../lib/currency";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";

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
            setError(err instanceof Error ? err.message : "Failed to delete account");
            setIsDeleting(false);
        }
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-md">
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                <ModalHeader
                    id="delete-account-title"
                    title="Delete Account?"
                    subtitle="This action cannot be undone"
                    icon={<AlertTriangle className="h-4.5 w-4.5 stroke-[2.2] text-rose-600" />}
                    iconBgColor="bg-(--pastel-coral-light)"
                    onClose={onClose}
                />

                <ModalBody>
                    <p className="text-xs sm:text-sm text-(--text-ink) leading-relaxed">
                        Are you sure you want to delete{" "}
                        <span className="font-bold">{account.name}</span>
                        {account.institution ? ` (${account.institution})` : ""} with current balance of{" "}
                        <span className="font-bold text-(--text-ink) font-mono-num">
                            {formatSGD(account.balance)}
                        </span>
                        ?
                    </p>

                    <div className="p-3.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-coral-light) text-xs font-medium text-rose-800 shadow-cute-sm">
                        <p className="font-bold mb-1">Warning:</p>
                        <p>
                            Deleting this account will permanently remove all historical balance snapshots, net worth
                            timeline entries, and monthly records associated with it.
                        </p>
                    </div>

                    {error && (
                        <div className="p-3 rounded-xl border-2 border-(--border-ink) bg-rose-100 text-rose-800 text-xs font-bold">
                            {error}
                        </div>
                    )}
                </ModalBody>

                <ModalFooter>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="rounded-xl px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                    >
                        Keep Account
                    </button>
                    <button
                        type="button"
                        onClick={handleDelete}
                        disabled={isDeleting}
                        className="inline-flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-coral) px-5 py-2.5 text-xs font-black text-white shadow-cute-sm hover:bg-rose-700 active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 transition-all cursor-pointer"
                    >
                        {isDeleting ? (
                            <>
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                <span>Deleting...</span>
                            </>
                        ) : (
                            <>
                                <Trash2 className="h-4 w-4" />
                                <span>Delete Account</span>
                            </>
                        )}
                    </button>
                </ModalFooter>
            </div>
        </AnimatedModal>
    );
}

export default DeleteAccountModal;
