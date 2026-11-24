/**
 * HaircutSettingsModal: edits the household investment haircut (how much
 * investments are discounted for goals due inside a window). Household
 * settings, shared by everyone on the plan. Roadmap decision 3.
 */

import { useEffect, useState, type FormEvent } from "react";
import { Percent } from "lucide-react";
import {
    AnimatedModal,
    ModalBody,
    ModalFooter,
    ModalHeader,
} from "../ui/AnimatedModal";
import { Alert } from "../ui/Alert";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { useUpdateHouseholdSettingsMutation } from "../../hooks/finance/budget";
import {
    DEFAULT_HAIRCUT_PERCENT,
    DEFAULT_HAIRCUT_WINDOW_MONTHS,
    MAX_HAIRCUT_WINDOW_MONTHS,
} from "../../lib/roadmap/goalSettings";

export interface HaircutSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Current discount as a 0-1 fraction. */
    haircutPct: number;
    haircutMonths: number;
}

export function HaircutSettingsModal({
    isOpen,
    onClose,
    haircutPct,
    haircutMonths,
}: HaircutSettingsModalProps) {
    const mutation = useUpdateHouseholdSettingsMutation();
    const [pct, setPct] = useState("");
    const [months, setMonths] = useState("");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen) return;
        setPct(String(Math.round(haircutPct * 1000) / 10));
        setMonths(String(haircutMonths));
        setError(null);
    }, [isOpen, haircutPct, haircutMonths]);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        const p = Number(pct);
        const m = Number(months);
        if (!Number.isFinite(p) || p < 0 || p > 100) {
            setError("Discount is 0–100%");
            return;
        }
        if (!Number.isInteger(m) || m < 0 || m > MAX_HAIRCUT_WINDOW_MONTHS) {
            setError(`Window is 0–${MAX_HAIRCUT_WINDOW_MONTHS} months`);
            return;
        }
        try {
            await mutation.mutateAsync({
                investment_haircut_pct: p,
                investment_haircut_months: m,
            });
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save");
        }
    };

    const resetDefaults = () => {
        setPct(String(DEFAULT_HAIRCUT_PERCENT));
        setMonths(String(DEFAULT_HAIRCUT_WINDOW_MONTHS));
    };

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-sm">
            <form
                onSubmit={handleSubmit}
                className="flex flex-col min-h-0 flex-1 overflow-hidden"
            >
                <ModalHeader
                    id="haircut-modal-title"
                    title="Investment Haircut"
                    icon={<Percent className="h-4.5 w-4.5" strokeWidth={2.5} />}
                    iconBgColor="bg-(--pastel-mint-light)"
                    onClose={onClose}
                />
                <ModalBody>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <p className="text-xs text-(--text-muted)">
                        Investments can drop before you sell, so near goals
                        count them at a discount.
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            id="haircut-pct"
                            label="Discount %"
                            type="number"
                            inputMode="decimal"
                            min={0}
                            max={100}
                            step="any"
                            mono
                            value={pct}
                            onChange={(e) => setPct(e.target.value)}
                        />
                        <Input
                            id="haircut-months"
                            label="Within months"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={MAX_HAIRCUT_WINDOW_MONTHS}
                            step={1}
                            mono
                            value={months}
                            onChange={(e) => setMonths(e.target.value)}
                        />
                    </div>
                    <p className="text-xs text-(--text-muted)">
                        Shared by your household.
                    </p>
                </ModalBody>
                <ModalFooter>
                    <Button
                        variant="ghost"
                        onClick={resetDefaults}
                        disabled={mutation.isPending}
                    >
                        Defaults
                    </Button>
                    <Button
                        type="submit"
                        variant="primary"
                        isLoading={mutation.isPending}
                        disabled={mutation.isPending}
                    >
                        Save
                    </Button>
                </ModalFooter>
            </form>
        </AnimatedModal>
    );
}

export default HaircutSettingsModal;
