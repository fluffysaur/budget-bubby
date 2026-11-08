import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ConfirmModal } from "../ui/ConfirmModal";

export interface SignOutConfirmProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm?: () => void | Promise<void>;
}

export function SignOutConfirm({
    isOpen,
    onClose,
    onConfirm,
}: SignOutConfirmProps) {
    const { signOut } = useAuth();

    const handleConfirm = async () => {
        if (onConfirm) {
            await onConfirm();
        } else {
            await signOut();
        }
        onClose();
    };

    return (
        <ConfirmModal
            isOpen={isOpen}
            onClose={onClose}
            onConfirm={handleConfirm}
            title="Lock & Sign Out?"
            variant="danger"
            confirmLabel="Sign Out"
            icon={
                <LogOut
                    className="h-4.5 w-4.5 text-rose-600"
                    strokeWidth={2.5}
                />
            }
            maxWidth="max-w-sm"
        >
            <p className="text-sm text-(--text-muted)">
                You&apos;ll need your PIN to unlock.
            </p>
        </ConfirmModal>
    );
}

export default SignOutConfirm;
