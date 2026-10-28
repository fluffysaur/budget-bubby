import { Shield, Sparkles, CheckCircle2 } from "lucide-react";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
    Button,
} from "../ui";
import { formatSGD } from "../../lib/currency";
import { formatDisplayMonth } from "../../lib/dateUtils";
import { playChaChingSound } from "../../lib/soundEffects";

export interface BankSurplusModalProps {
    isOpen: boolean;
    onClose: () => void;
    surplusAmount: number;
    month: string;
    onConfirm: () => void;
}

export function BankSurplusModal({
    isOpen,
    onClose,
    surplusAmount,
    month,
    onConfirm,
}: BankSurplusModalProps) {
    const handleConfirm = () => {
        playChaChingSound();
        onConfirm();
        onClose();
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose}>
            <ModalHeader
                title="Bank as Surplus"
                subtitle={`Reserve ${formatSGD(surplusAmount)} from ${formatDisplayMonth(month)}`}
                icon={<Shield className="h-5 w-5 text-indigo-600" />}
                onClose={onClose}
            />

            <ModalBody className="space-y-4">
                {/* Visual callout card */}
                <div className="rounded-2xl border-2 border-(--border-ink) bg-(--accent-butter-subtle) p-4 shadow-(--shadow-cute-sm) space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-(--text-ink)">
                        <Sparkles className="h-4 w-4 text-amber-500 fill-amber-400" />
                        <span>Reserve Cushion Confirmation</span>
                    </div>
                    <p className="text-xs text-(--text-muted) leading-relaxed">
                        Bank <strong className="text-(--text-ink)">{formatSGD(surplusAmount)}</strong> as Surplus?
                        This unspent budget will stay in your{" "}
                        <strong className="text-(--text-ink)">Banked Surplus</strong> reserve to cushion
                        future months or overages.
                    </p>
                </div>

                {/* Details Breakdown */}
                <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-(--text-muted)">Unspent Amount:</span>
                        <strong className="text-emerald-700 font-extrabold text-sm">
                            +{formatSGD(surplusAmount)}
                        </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-(--border-subtle) pt-2">
                        <span className="text-(--text-muted)">Destination:</span>
                        <span className="font-bold text-(--text-ink) flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Banked Surplus History
                        </span>
                    </div>
                </div>

                <p className="text-[11px] text-(--text-muted) text-center">
                    You can view or deploy this banked surplus to your savings goals anytime from the Budget tab.
                </p>
            </ModalBody>

            <ModalFooter>
                <div className="flex items-center justify-between w-full">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        leftIcon={<Shield className="h-4 w-4 stroke-[2.5]" />}
                    >
                        Confirm &amp; Bank as Surplus
                    </Button>
                </div>
            </ModalFooter>
        </AnimatedModal>
    );
}
