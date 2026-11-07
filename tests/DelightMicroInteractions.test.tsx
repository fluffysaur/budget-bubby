import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { haptics } from "../src/lib/haptics";
import { QuickDepositModal } from "../src/components/goals/QuickDepositModal";
import { MobileBottomNav } from "../src/components/layout/MobileBottomNav";
import { financeService } from "../src/services/financeService";
import { onAppEvent, type MilestoneDetail } from "../src/lib/appEvents";
import { resetFeedbackState } from "../src/lib/delight/feedback";
import type { SavingsGoal } from "../src/types/finance";

const goal: SavingsGoal = {
    id: "goal-1",
    household_id: "hh-1",
    title: "Japan Trip",
    target_amount: 1000,
    saved_so_far: 950,
    monthly_contribution: 100,
    emoji: "✈️",
    status: "on_track",
    target_date: "2026-12-31",
    created_at: new Date().toISOString(),
};

describe("delight micro-interactions", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        resetFeedbackState();
    });

    it("celebrates reaching a goal as a milestone", async () => {
        vi.spyOn(financeService, "updateGoal").mockResolvedValue({ ...goal, saved_so_far: 1050 });
        const milestones: MilestoneDetail[] = [];
        const off = onAppEvent("delight:milestone", (d) => milestones.push(d));

        render(<QuickDepositModal isOpen onClose={vi.fn()} goal={goal} onDepositSaved={vi.fn()} />);
        fireEvent.click(screen.getByRole("button", { name: /\+S\$100/i }));
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: /^deposit$/i }));
        });
        off();

        expect(milestones.map((m) => m.kind)).toEqual(["goal-complete"]);
        expect(milestones[0].title).toBe("Goal reached! 🎉");
    });

    it("ticks on the Quick Add FAB and still opens Quick Add", () => {
        const tick = vi.spyOn(haptics, "tick");
        const onQuickAdd = vi.fn();
        render(<MobileBottomNav activeTab="dashboard" onQuickAdd={onQuickAdd} />);

        fireEvent.click(screen.getByRole("button", { name: "Quick Add" }));

        expect(tick).toHaveBeenCalledTimes(1);
        expect(onQuickAdd).toHaveBeenCalledTimes(1);
    });
});
