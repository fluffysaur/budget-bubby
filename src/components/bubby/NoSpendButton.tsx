/**
 * One-tap "No Spend" check-in (food for Bubby), shown under the "Log today"
 * quest while it is still pending.
 */

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "../ui/Button";
import { useLoggedInMember } from "../../hooks/useLoggedInMember";
import { financeService } from "../../services/financeService";
import { feedback } from "../../lib/delight/feedback";
import { emitAppEvent } from "../../lib/appEvents";
import { toSgtDateString } from "../../lib/bubby/dates";

export function NoSpendButton() {
    const { me } = useLoggedInMember();
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!me) return null;

    const handleNoSpend = async () => {
        if (isSubmitting) return;
        try {
            setIsSubmitting(true);
            const today = toSgtDateString();
            await financeService.recordDailyCheckin(me.id, today, "no_spend");
            // Cha-ching, celebrate haptic and Bubby munching
            feedback.routine("no-spend");
            emitAppEvent("day:logged", {
                memberId: me.id,
                date: today,
                source: "no_spend",
                firstForDate: true,
            });
        } catch (err) {
            console.error("Failed to record no-spend day:", err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Button
            variant="secondary"
            size="sm"
            data-testid="no-spend-checkin-btn"
            isLoading={isSubmitting}
            leftIcon={<Sparkles className="h-3.5 w-3.5" strokeWidth={2.5} />}
            onClick={handleNoSpend}
        >
            No Spend
        </Button>
    );
}

export default NoSpendButton;
