import { Shield, CheckCircle2 } from "lucide-react";
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
import { recordExercise } from "../../lib/bubby/activity";
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
        recordExercise("month-end");
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
                <div className="rounded-2xl border-2 border-(--border-ink) bg-(--accent-butter-subtle) p-4 shadow-cute-sm flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border-2 border-(--border-ink) bg-(--accent-butter) text-(--text-ink)">
                        <Shield className="h-5 w-5" strokeWidth={2.5} />
                    </div>
                    <div>
                        <div className="font-bold text-sm text-(--text-ink)">
                            Reserve Cushion
                        </div>
                        <p className="text-xs text-(--text-muted) leading-relaxed mt-0.5">
                            Bank <CurrencyText amount={surplusAmount} /> to
                            cushion future overages.
                        </p>
                    </div>
                </div>

                {/* Destination */}
                <div className="rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) p-3 flex items-center justify-between text-xs">
                    <span className="text-(--text-muted)">Destination:</span>
                    <span className="font-bold text-(--text-ink) flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Banked Surplus
                    </span>
                </div>
            </ModalBody>

            <ModalFooter>
                <div className="flex items-center justify-between w-full">
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleConfirm}
                        leftIcon={
                            <Shield className="h-4 w-4" strokeWidth={2.5} />
                        }
                    >
                        Bank Surplus
                    </Button>
                </div>
            </ModalFooter>
        </AnimatedModal>
    );
}
