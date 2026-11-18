import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { haptics } from "../src/lib/haptics";
import { MobileBottomNav } from "../src/components/layout/MobileBottomNav";
import { resetFeedbackState } from "../src/lib/delight/feedback";

describe("delight micro-interactions", () => {
    beforeEach(() => {
        localStorage.clear();
        vi.restoreAllMocks();
        resetFeedbackState();
    });

    it("ticks on the Quick Add FAB and still opens Quick Add", () => {
        const tick = vi.spyOn(haptics, "tick");
        const onQuickAdd = vi.fn();
        render(
            <MobileBottomNav activeTab="dashboard" onQuickAdd={onQuickAdd} />,
        );

        fireEvent.click(screen.getByRole("button", { name: "Quick Add" }));

        expect(tick).toHaveBeenCalledTimes(1);
        expect(onQuickAdd).toHaveBeenCalledTimes(1);
    });
});
