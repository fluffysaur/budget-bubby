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
import { feedback } from "../../lib/delight/feedback";
import { CurrencyText } from "../ui/CurrencyText";

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
        // Banking is a milestone too, but confetti is kept for sweeps
        feedback.milestone("sweep", { big: false });
        onConfirm();
        onClose();
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose}>
            <ModalHeader
                title="Bank Surplus"
                subtitle={`Reserve ${formatSGD(surplusAmount)} from ${formatDisplayMonth(month)}`}
                icon={<Shield className="h-5 w-5 text-indigo-600" />}
                onClose={onClose}
            />

            <ModalBody className="space-y-4">
                {/* Visual callout card */}
                <div className="rounded-2xl border-2 border-(--border-ink) bg-(--accent-butter-subtle) p-4 shadow-(--shadow-cute-sm) space-y-2">
                    <div className="flex items-center gap-2 font-bold text-sm text-(--text-ink)">
                        <Sparkles className="h-4 w-4 text-amber-500 fill-amber-400" />
                        <span>Reserve Cushion</span>
                    </div>
                    <p className="text-xs text-(--text-muted) leading-relaxed">
                        Bank <strong className="text-(--text-ink)"><CurrencyText amount={surplusAmount} /></strong> to cushion
                        future months against unexpected overages.
                    </p>
                </div>

                {/* Details Breakdown */}
                <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-(--text-muted)">Unspent Amount:</span>
                        <strong className="text-emerald-700 font-extrabold text-sm">
                            +<CurrencyText amount={surplusAmount} />
                        </strong>
                    </div>
                    <div className="flex items-center justify-between text-xs border-t border-(--border-subtle) pt-2">
                        <span className="text-(--text-muted)">Destination:</span>
                        <span className="font-bold text-(--text-ink) flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                            Banked Surplus
                        </span>
                    </div>
                </div>

                <p className="text-[11px] text-(--text-muted) text-center">
                    Deploy banked surplus to savings goals anytime from Budget.
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
                        leftIcon={<Shield className="h-4 w-4" strokeWidth={2.5} />}
                    >
                        Bank Surplus
                    </Button>
                </div>
            </ModalFooter>
        </AnimatedModal>
    );
}
