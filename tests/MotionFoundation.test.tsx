import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { Button } from "../src/components/ui/Button";
import { SegmentedTabs } from "../src/components/ui/SegmentedTabs";
import {
    AnimatedModal,
    ModalBody,
    ModalHeader,
} from "../src/components/ui/AnimatedModal";
import { MobileBottomNav } from "../src/components/layout/MobileBottomNav";
import {
    HouseholdProvider,
    useHousehold,
} from "../src/context/HouseholdContext";
import {
    fadeRise,
    pop,
    collapse,
    listItem,
    springSnappy,
} from "../src/lib/motion";

describe("Motion Foundation & Touch Ergonomics", () => {
    it("gives Button size='sm' and size='icon-sm' a 44px hit area via after:-inset-2", () => {
        render(
            <div>
                <Button size="sm">Small Button</Button>
                <Button size="icon-sm" aria-label="Small Icon">
                    X
                </Button>
                <Button size="md">Medium Button</Button>
            </div>,
        );

        const smBtn = screen.getByRole("button", { name: "Small Button" });
        const iconSmBtn = screen.getByRole("button", { name: "Small Icon" });
        const mdBtn = screen.getByRole("button", { name: "Medium Button" });

        expect(smBtn.className).toContain("after:-inset-2");
        expect(smBtn.className).toContain("transition-press");
        expect(iconSmBtn.className).toContain("after:-inset-2");
        expect(iconSmBtn.className).not.toContain("transition-all");
        expect(mdBtn.className).not.toContain("after:-inset-2");
    });

    it("gives SegmentedTabs buttons a 44px hit area and active press feedback", () => {
        render(
            <SegmentedTabs
                tabs={[
                    { id: "expenses", label: "Expenses" },
                    { id: "budget", label: "Budget" },
                ]}
                activeTab="expenses"
                onChange={vi.fn()}
            />,
        );

        const tab = screen.getByRole("tab", { name: "Expenses" });
        expect(tab.className).toContain("after:-inset-2");
        expect(tab.className).toContain("transition-press");
    });

    it("locks both document.body and main scroller overflow when AnimatedModal is open", () => {
        const main = document.createElement("main");
        document.body.appendChild(main);

        const { unmount } = render(
            <AnimatedModal isOpen={true} onClose={vi.fn()}>
                <ModalHeader title="Scroll Lock Test" onClose={vi.fn()} />
                <ModalBody>Content</ModalBody>
            </AnimatedModal>,
        );

        expect(document.body.style.overflow).toBe("hidden");
        expect(main.style.overflow).toBe("hidden");

        unmount();
        expect(document.body.style.overflow).toBe("");
        expect(main.style.overflow).toBe("");
        document.body.removeChild(main);
    });

    it("does not double-fire Quick Add on MobileBottomNav and uses solid bg-(--bg-card)", () => {
        const onQuickAdd = vi.fn();
        render(<MobileBottomNav onQuickAdd={onQuickAdd} />);

        const nav = screen.getByRole("navigation", {
            name: "Mobile Navigation",
        });
        expect(nav.className).toContain("bg-(--bg-card)");
        expect(nav.className).not.toContain("backdrop-blur-lg");

        const fab = screen.getByRole("button", { name: "Quick Add" });
        fireEvent.click(fab);
        expect(onQuickAdd).toHaveBeenCalledTimes(1);
    });

    it("adds theme-transition class on documentElement for 200ms during toggleTheme", () => {
        vi.useFakeTimers();

        function ThemeToggleTester() {
            const { toggleTheme } = useHousehold();
            return (
                <button type="button" onClick={toggleTheme}>
                    Toggle
                </button>
            );
        }

        render(
            <HouseholdProvider>
                <ThemeToggleTester />
            </HouseholdProvider>,
        );

        const btn = screen.getByRole("button", { name: "Toggle" });
        fireEvent.click(btn);
        expect(
            document.documentElement.classList.contains("theme-transition"),
        ).toBe(true);

        act(() => {
            vi.advanceTimersByTime(200);
        });
        expect(
            document.documentElement.classList.contains("theme-transition"),
        ).toBe(false);

        vi.useRealTimers();
    });

    it("exports shared motion presets aligned with CSS tokens", () => {
        expect(fadeRise.transition.duration).toBe(0.18);
        expect(pop.transition.duration).toBe(0.16);
        expect(collapse.transition.duration).toBe(0.22);
        expect(listItem.layout).toBe(true);
        expect(springSnappy.type).toBe("spring");
    });
});
