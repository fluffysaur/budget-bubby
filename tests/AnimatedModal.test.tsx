import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
} from "../src/components/ui/AnimatedModal";

describe("AnimatedModal - Swipe Down to Close & Discard Confirmation", () => {
    it("renders modal when isOpen is true", () => {
        render(
            <AnimatedModal isOpen={true} onClose={vi.fn()}>
                <ModalHeader title="Test Drawer" onClose={vi.fn()} />
                <ModalBody>
                    <p>Drawer content</p>
                </ModalBody>
            </AnimatedModal>,
        );

        expect(screen.getByRole("heading", { name: "Test Drawer" })).toBeInTheDocument();
        expect(screen.getByText("Drawer content")).toBeInTheDocument();
    });

    it("closes when dragging down past 80px threshold when at top", () => {
        const handleClose = vi.fn();
        render(
            <AnimatedModal isOpen={true} onClose={handleClose} isDrawerOnMobile={true}>
                <ModalHeader title="Draggable Drawer" onClose={handleClose} />
                <ModalBody>
                    <p>Body at top</p>
                </ModalBody>
            </AnimatedModal>,
        );

        const bodyText = screen.getByText("Body at top");

        fireEvent.touchStart(bodyText, {
            touches: [{ clientX: 150, clientY: 100 }],
        });

        fireEvent.touchMove(bodyText, {
            touches: [{ clientX: 150, clientY: 200 }],
            cancelable: true,
        });

        fireEvent.touchEnd(bodyText, {
            changedTouches: [{ clientX: 150, clientY: 200 }],
        });

        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("does not close when dragging down below threshold (deltaY < 80px with low velocity)", () => {
        const handleClose = vi.fn();
        render(
            <AnimatedModal isOpen={true} onClose={handleClose} isDrawerOnMobile={true}>
                <ModalHeader title="Draggable Drawer" onClose={handleClose} />
                <ModalBody>
                    <p>Body at top</p>
                </ModalBody>
            </AnimatedModal>,
        );

        const bodyText = screen.getByText("Body at top");

        fireEvent.touchStart(bodyText, {
            touches: [{ clientX: 150, clientY: 100 }],
        });

        fireEvent.touchMove(bodyText, {
            touches: [{ clientX: 150, clientY: 130 }],
            cancelable: true,
        });

        fireEvent.touchEnd(bodyText, {
            changedTouches: [{ clientX: 150, clientY: 130 }],
        });

        expect(handleClose).not.toHaveBeenCalled();
    });

    it("does not drag drawer down when inner scrollable container is scrolled down (scrollTop > 0)", () => {
        const handleClose = vi.fn();
        render(
            <AnimatedModal isOpen={true} onClose={handleClose} isDrawerOnMobile={true}>
                <ModalHeader title="Scrollable Drawer" onClose={handleClose} />
                <ModalBody className="overflow-y-auto">
                    <div data-testid="scrollable-content">Long content</div>
                </ModalBody>
            </AnimatedModal>,
        );

        const content = screen.getByTestId("scrollable-content");
        const scrollParent = content.parentElement!;

        // Simulate that the scroll container is scrolled down by 50px
        Object.defineProperty(scrollParent, "scrollTop", {
            value: 50,
            writable: true,
        });

        fireEvent.touchStart(content, {
            touches: [{ clientX: 150, clientY: 100 }],
        });

        fireEvent.touchMove(content, {
            touches: [{ clientX: 150, clientY: 200 }],
            cancelable: true,
        });

        fireEvent.touchEnd(content, {
            changedTouches: [{ clientX: 150, clientY: 200 }],
        });

        expect(handleClose).not.toHaveBeenCalled();
    });

    it("ignores drag when touching exempt elements like range inputs or data-drag-ignore", () => {
        const handleClose = vi.fn();
        render(
            <AnimatedModal isOpen={true} onClose={handleClose} isDrawerOnMobile={true}>
                <ModalHeader title="Exempt Elements" onClose={handleClose} />
                <ModalBody>
                    <input type="range" min="0" max="100" data-testid="range-slider" />
                    <div data-drag-ignore="true" data-testid="ignored-box">Ignore Me</div>
                </ModalBody>
            </AnimatedModal>,
        );

        const slider = screen.getByTestId("range-slider");
        fireEvent.touchStart(slider, { touches: [{ clientX: 100, clientY: 100 }] });
        fireEvent.touchMove(slider, { touches: [{ clientX: 100, clientY: 220 }] });
        fireEvent.touchEnd(slider, { changedTouches: [{ clientX: 100, clientY: 220 }] });
        expect(handleClose).not.toHaveBeenCalled();

        const ignored = screen.getByTestId("ignored-box");
        fireEvent.touchStart(ignored, { touches: [{ clientX: 100, clientY: 100 }] });
        fireEvent.touchMove(ignored, { touches: [{ clientX: 100, clientY: 220 }] });
        fireEvent.touchEnd(ignored, { changedTouches: [{ clientX: 100, clientY: 220 }] });
        expect(handleClose).not.toHaveBeenCalled();
    });

    it("shows discard confirmation dialog when form is dirty and user swipes down", () => {
        const handleClose = vi.fn();
        const handleDiscard = vi.fn();

        render(
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                onDiscard={handleDiscard}
                isDrawerOnMobile={true}
            >
                <ModalHeader title="Form Drawer" onClose={handleClose} />
                <ModalBody>
                    <form>
                        <label htmlFor="test-input">Item Name</label>
                        <input id="test-input" defaultValue="" />
                    </form>
                </ModalBody>
            </AnimatedModal>,
        );

        const input = screen.getByLabelText("Item Name") as HTMLInputElement;
        fireEvent.change(input, { target: { value: "New Expense" } });
        expect(input.value).toBe("New Expense");

        // Swiping down past threshold
        fireEvent.touchStart(input, {
            touches: [{ clientX: 150, clientY: 100 }],
        });

        fireEvent.touchMove(input, {
            touches: [{ clientX: 150, clientY: 210 }],
            cancelable: true,
        });

        fireEvent.touchEnd(input, {
            changedTouches: [{ clientX: 150, clientY: 210 }],
        });

        // Should NOT close immediately
        expect(handleClose).not.toHaveBeenCalled();

        // Should show discard confirmation
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
        expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();

        // Click Keep editing
        const keepEditingBtn = screen.getByRole("button", { name: /keep editing/i });
        fireEvent.click(keepEditingBtn);

        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(handleClose).not.toHaveBeenCalled();
        expect(input.value).toBe("New Expense");

        // Try closing via close button in header
        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        fireEvent.click(closeBtn);

        expect(screen.getByRole("alertdialog")).toBeInTheDocument();

        // Click Discard changes
        const discardBtn = screen.getByRole("button", { name: /discard changes/i });
        fireEvent.click(discardBtn);

        expect(handleDiscard).toHaveBeenCalledTimes(1);
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("shows discard confirmation when clicking backdrop or pressing Escape while dirty", () => {
        const handleClose = vi.fn();

        render(
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDirty={true}
                isDrawerOnMobile={true}
            >
                <ModalHeader title="Dirty Backdrop Modal" onClose={handleClose} />
                <ModalBody>
                    <p>Unsaved content</p>
                </ModalBody>
            </AnimatedModal>,
        );

        const dialog = screen.getByRole("dialog");
        // Click on the backdrop (dialog background itself)
        fireEvent.click(dialog);

        expect(handleClose).not.toHaveBeenCalled();
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();

        // Press Escape to dismiss discard dialog
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(handleClose).not.toHaveBeenCalled();
    });

    it("respects explicit isDirty={false} prop to allow immediate close", () => {
        const handleClose = vi.fn();

        render(
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDirty={false}
                isDrawerOnMobile={true}
            >
                <ModalHeader title="Clean Drawer" onClose={handleClose} />
                <ModalBody>
                    <input defaultValue="Something" />
                </ModalBody>
            </AnimatedModal>,
        );

        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        fireEvent.click(closeBtn);

        expect(handleClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    });

    it("respects explicit isDirty={true} prop even without modified DOM inputs", () => {
        const handleClose = vi.fn();

        render(
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDirty={true}
                isDrawerOnMobile={true}
            >
                <ModalHeader title="Custom Dirty Drawer" onClose={handleClose} />
                <ModalBody>
                    <p>Some state managed outside form inputs</p>
                </ModalBody>
            </AnimatedModal>,
        );

        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        fireEvent.click(closeBtn);

        expect(handleClose).not.toHaveBeenCalled();
        expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
});
