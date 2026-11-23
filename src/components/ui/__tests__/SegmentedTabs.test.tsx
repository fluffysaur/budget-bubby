import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SegmentedTabs } from "../SegmentedTabs";

describe("SegmentedTabs", () => {
    it("scrolls horizontally only and lets vertical swipes pass through", () => {
        render(
            <SegmentedTabs
                tabs={[
                    { id: "a", label: "A" },
                    { id: "b", label: "B" },
                ]}
                activeTab="a"
                onChange={vi.fn()}
            />,
        );
        const nav = screen.getByRole("navigation");
        expect(nav.className).toContain("overflow-x-auto");
        expect(nav.className).toContain("overflow-y-hidden");
        expect(nav.className).toContain("touch-pan-x");
    });
});
