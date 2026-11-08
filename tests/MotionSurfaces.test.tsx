import { describe, it, expect, vi } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import React from "react";
import { LazyMotion, domAnimation } from "motion/react";
import { CollapsibleSection } from "../src/components/ui/CollapsibleSection";
import { SegmentedTabs } from "../src/components/ui/SegmentedTabs";
import { Input } from "../src/components/ui/Input";
import { Select } from "../src/components/ui/Select";
import { Textarea } from "../src/components/ui/Textarea";
import { Button } from "../src/components/ui/Button";
import { PullToRefresh } from "../src/components/ui/PullToRefresh";
import { RouteSkeletonLoader } from "../src/App";
import { InboxCardSkeleton } from "../src/components/inbox/InboxCard";

function renderWithMotion(ui: React.ReactElement) {
    return render(
        <LazyMotion features={domAnimation} strict>
            {ui}
        </LazyMotion>,
    );
}

describe("PR #7 Motion Surfaces & UI Polish", () => {
    it("RouteSkeletonLoader delays minimal header skeleton by 150ms", () => {
        vi.useFakeTimers();
        const { unmount } = render(<RouteSkeletonLoader />);

        // Initially hidden visual pulse bars
        expect(screen.queryByTestId("route-skeleton-bars")).toBeNull();

        // Advance 150ms
        act(() => {
            vi.advanceTimersByTime(160);
        });

        expect(screen.getByTestId("route-skeleton-bars")).toBeInTheDocument();
        unmount();
        vi.useRealTimers();
    });

    it("SegmentedTabs renders sliding indicator with layoutId", () => {
        renderWithMotion(
            <SegmentedTabs
                tabs={[
                    { id: "tab1", label: "Tab 1" },
                    { id: "tab2", label: "Tab 2" },
                ]}
                activeTab="tab1"
                onChange={() => {}}
                layoutId="test-tabs"
            />,
        );

        const tab1 = screen.getByRole("tab", { name: "Tab 1" });
        expect(tab1).toHaveAttribute("aria-selected", "true");
        // Active tab renders indicator pill inside
        expect(tab1.querySelector(".absolute.inset-0")).not.toBeNull();
        expect(tab1.querySelector(".absolute.inset-0")).toHaveClass(
            "bg-(--pastel-lilac)",
        );
    });

    it("CollapsibleSection renders collapsed content when opened", () => {
        renderWithMotion(
            <CollapsibleSection title="Advanced">
                <div>Collapsible Inner Body</div>
            </CollapsibleSection>,
        );

        expect(screen.queryByText("Collapsible Inner Body")).toBeNull();

        const trigger = screen.getByRole("button", { name: /Advanced/i });
        act(() => {
            trigger.click();
        });

        expect(screen.getByText("Collapsible Inner Body")).toBeInTheDocument();
    });

    it("Input, Select, Textarea render error with collapse animation", () => {
        renderWithMotion(
            <div>
                <Input label="Name" error="Name is required" />
                <Select
                    label="Type"
                    error="Type is required"
                    options={[{ value: "a", label: "A" }]}
                />
                <Textarea label="Notes" error="Notes too short" />
            </div>,
        );

        expect(screen.getByText("Name is required")).toBeInTheDocument();
        expect(screen.getByText("Type is required")).toBeInTheDocument();
        expect(screen.getByText("Notes too short")).toBeInTheDocument();
    });

    it("Button loading spinner preserves icon slot width (4x4)", () => {
        renderWithMotion(<Button isLoading>Save</Button>);

        const button = screen.getByRole("button", { name: "Save" });
        expect(button).toBeDisabled();
        const iconSlot = button.querySelector(".w-4.h-4");
        expect(iconSlot).not.toBeNull();
    });

    it("PullToRefresh renders indicator on pull with motion transition", () => {
        const { container } = renderWithMotion(
            <PullToRefresh onRefresh={async () => {}}>
                <div>PTR Content</div>
            </PullToRefresh>,
        );

        const main = container.querySelector("main") || container.firstChild;
        fireEvent.touchStart(main!, { touches: [{ clientY: 100 }] });
        fireEvent.touchMove(main!, { touches: [{ clientY: 140 }] });

        const indicator = screen.getByText("Pull down to refresh");
        expect(indicator).toBeInTheDocument();
    });

    it("InboxCardSkeleton renders structured skeleton shapes", () => {
        renderWithMotion(<InboxCardSkeleton />);
        expect(screen.getByLabelText("Loading inbox")).toBeInTheDocument();
    });
});
