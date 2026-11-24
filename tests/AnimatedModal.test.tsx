import { StrictMode, useRef, useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import {
    AnimatedModal,
    ModalHeader,
    ModalBody,
    ModalFooter,
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

        expect(
            screen.getByRole("heading", { name: "Test Drawer" }),
        ).toBeInTheDocument();
        expect(screen.getByText("Drawer content")).toBeInTheDocument();
    });

    it("closes when dragging down past 80px threshold when at top", () => {
        const handleClose = vi.fn();
        render(
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDrawerOnMobile={true}
            >
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
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDrawerOnMobile={true}
            >
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
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDrawerOnMobile={true}
            >
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
            <AnimatedModal
                isOpen={true}
                onClose={handleClose}
                isDrawerOnMobile={true}
            >
                <ModalHeader title="Exempt Elements" onClose={handleClose} />
                <ModalBody>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        data-testid="range-slider"
                    />
                    <div data-drag-ignore="true" data-testid="ignored-box">
                        Ignore Me
                    </div>
                </ModalBody>
            </AnimatedModal>,
        );

        const slider = screen.getByTestId("range-slider");
        fireEvent.touchStart(slider, {
            touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchMove(slider, {
            touches: [{ clientX: 100, clientY: 220 }],
        });
        fireEvent.touchEnd(slider, {
            changedTouches: [{ clientX: 100, clientY: 220 }],
        });
        expect(handleClose).not.toHaveBeenCalled();

        const ignored = screen.getByTestId("ignored-box");
        fireEvent.touchStart(ignored, {
            touches: [{ clientX: 100, clientY: 100 }],
        });
        fireEvent.touchMove(ignored, {
            touches: [{ clientX: 100, clientY: 220 }],
        });
        fireEvent.touchEnd(ignored, {
            changedTouches: [{ clientX: 100, clientY: 220 }],
        });
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
        expect(
            screen.getByText("Discard unsaved changes?"),
        ).toBeInTheDocument();

        // Click Keep editing
        const keepEditingBtn = screen.getByRole("button", {
            name: /keep editing/i,
        });
        fireEvent.click(keepEditingBtn);

        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(handleClose).not.toHaveBeenCalled();
        expect(input.value).toBe("New Expense");

        // Try closing via close button in header
        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        fireEvent.click(closeBtn);

        expect(screen.getByRole("alertdialog")).toBeInTheDocument();

        // Click Discard changes
        const discardBtn = screen.getByRole("button", {
            name: /discard changes/i,
        });
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
                <ModalHeader
                    title="Dirty Backdrop Modal"
                    onClose={handleClose}
                />
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
                <ModalHeader
                    title="Custom Dirty Drawer"
                    onClose={handleClose}
                />
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

    it("only closes the top-most stacked modal on Escape and keeps body overflow hidden until the last modal closes (L6)", () => {
        document.body.style.overflow = "auto";
        const closeBottom = vi.fn();
        const closeTop = vi.fn();

        const { rerender } = render(
            <>
                <AnimatedModal isOpen={true} onClose={closeBottom}>
                    <ModalHeader title="Bottom Modal" onClose={closeBottom} />
                    <ModalBody>
                        <p>Bottom content</p>
                    </ModalBody>
                </AnimatedModal>
                <AnimatedModal isOpen={true} onClose={closeTop}>
                    <ModalHeader title="Top Modal" onClose={closeTop} />
                    <ModalBody>
                        <p>Top content</p>
                    </ModalBody>
                </AnimatedModal>
            </>,
        );

        expect(document.body.style.overflow).toBe("hidden");

        // Pressing Escape when both are open closes only the top modal
        fireEvent.keyDown(window, { key: "Escape" });
        expect(closeTop).toHaveBeenCalledTimes(1);
        expect(closeBottom).not.toHaveBeenCalled();

        // Simulate top modal closing while bottom modal remains open
        rerender(
            <>
                <AnimatedModal isOpen={true} onClose={closeBottom}>
                    <ModalHeader title="Bottom Modal" onClose={closeBottom} />
                    <ModalBody>
                        <p>Bottom content</p>
                    </ModalBody>
                </AnimatedModal>
                <AnimatedModal isOpen={false} onClose={closeTop}>
                    <ModalHeader title="Top Modal" onClose={closeTop} />
                    <ModalBody>
                        <p>Top content</p>
                    </ModalBody>
                </AnimatedModal>
            </>,
        );

        // Body overflow stays hidden while bottom modal is still open
        expect(document.body.style.overflow).toBe("hidden");

        // Pressing Escape now closes the bottom modal
        fireEvent.keyDown(window, { key: "Escape" });
        expect(closeBottom).toHaveBeenCalledTimes(1);

        // Close bottom modal and verify body overflow is restored
        rerender(
            <>
                <AnimatedModal isOpen={false} onClose={closeBottom}>
                    <ModalHeader title="Bottom Modal" onClose={closeBottom} />
                    <ModalBody>
                        <p>Bottom content</p>
                    </ModalBody>
                </AnimatedModal>
                <AnimatedModal isOpen={false} onClose={closeTop}>
                    <ModalHeader title="Top Modal" onClose={closeTop} />
                    <ModalBody>
                        <p>Top content</p>
                    </ModalBody>
                </AnimatedModal>
            </>,
        );

        expect(document.body.style.overflow).toBe("auto");
    });
});

describe("AnimatedModal - Focus Trap, Initial Focus, and Restore", () => {
    function ModalHarness({
        useInitialFocusRef = false,
        variant = "modal" as const,
        isDirty = false,
    }: {
        useInitialFocusRef?: boolean;
        variant?: "modal" | "side-sheet" | "popover" | "fullscreen";
        isDirty?: boolean;
    }) {
        const [open, setOpen] = useState(false);
        const inputRef = useRef<HTMLInputElement>(null);

        return (
            <div>
                <button type="button" onClick={() => setOpen(true)}>
                    Open Modal
                </button>
                <button type="button">Outside Button</button>
                <AnimatedModal
                    isOpen={open}
                    onClose={() => setOpen(false)}
                    variant={variant}
                    isDirty={isDirty}
                    initialFocusRef={useInitialFocusRef ? inputRef : undefined}
                    ariaLabel="Focus Trap Test"
                >
                    <ModalHeader
                        title="Focus Test"
                        onClose={() => setOpen(false)}
                    />
                    <ModalBody>
                        <input
                            ref={inputRef}
                            aria-label="Name"
                            defaultValue=""
                        />
                    </ModalBody>
                    <ModalFooter>
                        <button type="button" onClick={() => setOpen(false)}>
                            Save
                        </button>
                    </ModalFooter>
                </AnimatedModal>
            </div>
        );
    }

    it("focuses the first focusable element on open, traps Tab/Shift+Tab inside the modal, and restores focus to the trigger on close", () => {
        render(<ModalHarness />);

        const trigger = screen.getByRole("button", { name: "Open Modal" });
        trigger.focus();
        expect(document.activeElement).toBe(trigger);

        fireEvent.click(trigger);

        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        const nameInput = screen.getByLabelText("Name");
        const saveBtn = screen.getByRole("button", { name: "Save" });

        // First focusable element receives focus on open
        expect(document.activeElement).toBe(closeBtn);

        // Shift+Tab from first element wraps to last element (Save)
        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(saveBtn);

        // Tab from last element wraps back to first element (Close modal)
        fireEvent.keyDown(window, { key: "Tab" });
        expect(document.activeElement).toBe(closeBtn);

        // Tab on middle element is not intercepted (lets browser advance)
        nameInput.focus();
        const midEvent = new KeyboardEvent("keydown", {
            key: "Tab",
            bubbles: true,
            cancelable: true,
        });
        window.dispatchEvent(midEvent);
        expect(midEvent.defaultPrevented).toBe(false);

        // Tab if focus escaped to outside button pulls back into modal
        const outsideBtn = screen.getByRole("button", {
            name: "Outside Button",
        });
        outsideBtn.focus();
        fireEvent.keyDown(window, { key: "Tab" });
        expect(document.activeElement).toBe(closeBtn);

        // Closing via Escape restores focus to trigger
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
        expect(document.activeElement).toBe(trigger);
    });

    it("focuses initialFocusRef on open when provided", () => {
        render(<ModalHarness useInitialFocusRef />);

        const trigger = screen.getByRole("button", { name: "Open Modal" });
        trigger.focus();
        fireEvent.click(trigger);

        expect(document.activeElement).toBe(screen.getByLabelText("Name"));

        fireEvent.click(screen.getByRole("button", { name: "Save" }));
        expect(document.activeElement).toBe(trigger);
    });

    it("traps Tab inside the discard alertdialog and restores focus back to the modal when dismissed", () => {
        render(<ModalHarness isDirty />);

        const trigger = screen.getByRole("button", { name: "Open Modal" });
        trigger.focus();
        fireEvent.click(trigger);

        const nameInput = screen.getByLabelText("Name");
        nameInput.focus();

        // Trigger discard confirmation via Escape
        fireEvent.keyDown(window, { key: "Escape" });

        const keepBtn = screen.getByRole("button", { name: "Keep editing" });
        const discardBtn = screen.getByRole("button", {
            name: "Discard changes",
        });
        expect(document.activeElement).toBe(keepBtn);

        // Shift+Tab wraps inside alertdialog
        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(discardBtn);

        // Tab wraps back to Keep editing
        fireEvent.keyDown(window, { key: "Tab" });
        expect(document.activeElement).toBe(keepBtn);

        // Dismiss discard dialog returns focus to previously focused input inside modal
        fireEvent.click(keepBtn);
        expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
        expect(document.activeElement).toBe(nameInput);
    });

    it("traps focus in side-sheet variant and restores focus to trigger on close", () => {
        render(<ModalHarness variant="side-sheet" />);

        const trigger = screen.getByRole("button", { name: "Open Modal" });
        trigger.focus();
        fireEvent.click(trigger);

        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        const saveBtn = screen.getByRole("button", { name: "Save" });
        expect(document.activeElement).toBe(closeBtn);

        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(saveBtn);

        fireEvent.keyDown(window, { key: "Escape" });
        expect(document.activeElement).toBe(trigger);
    });

    it("manages focus across stacked modals and returns focus to each trigger in order", () => {
        function StackedHarness() {
            const [outerOpen, setOuterOpen] = useState(false);
            const [innerOpen, setInnerOpen] = useState(false);
            return (
                <div>
                    <button type="button" onClick={() => setOuterOpen(true)}>
                        Outer Trigger
                    </button>
                    <AnimatedModal
                        isOpen={outerOpen}
                        onClose={() => setOuterOpen(false)}
                    >
                        <ModalHeader
                            title="Outer"
                            onClose={() => setOuterOpen(false)}
                        />
                        <ModalBody>
                            <button
                                type="button"
                                onClick={() => setInnerOpen(true)}
                            >
                                Inner Trigger
                            </button>
                        </ModalBody>
                    </AnimatedModal>
                    <AnimatedModal
                        isOpen={innerOpen}
                        onClose={() => setInnerOpen(false)}
                    >
                        <ModalHeader
                            title="Inner"
                            onClose={() => setInnerOpen(false)}
                        />
                        <ModalBody>
                            <button
                                type="button"
                                onClick={() => setInnerOpen(false)}
                            >
                                Inner Action
                            </button>
                        </ModalBody>
                    </AnimatedModal>
                </div>
            );
        }

        render(<StackedHarness />);
        const outerTrigger = screen.getByRole("button", {
            name: "Outer Trigger",
        });
        outerTrigger.focus();
        fireEvent.click(outerTrigger);

        const innerTrigger = screen.getByRole("button", {
            name: "Inner Trigger",
        });
        innerTrigger.focus();
        fireEvent.click(innerTrigger);

        const innerAction = screen.getByRole("button", {
            name: "Inner Action",
        });
        const closeButtons = screen.getAllByRole("button", {
            name: /close modal/i,
        });
        const innerCloseBtn = closeButtons[closeButtons.length - 1];
        expect(document.activeElement).toBe(innerCloseBtn);

        // Tab cycles strictly within inner modal
        fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
        expect(document.activeElement).toBe(innerAction);

        // Escape closes inner modal and restores focus to innerTrigger inside outer modal
        fireEvent.keyDown(window, { key: "Escape" });
        expect(document.activeElement).toBe(innerTrigger);

        // Escape closes outer modal and restores focus to outerTrigger
        fireEvent.keyDown(window, { key: "Escape" });
        expect(document.activeElement).toBe(outerTrigger);
    });

    it("restores focus to the trigger under React StrictMode", () => {
        render(
            <StrictMode>
                <ModalHarness />
            </StrictMode>,
        );

        const trigger = screen.getByRole("button", { name: "Open Modal" });
        trigger.focus();
        fireEvent.click(trigger);

        const closeBtn = screen.getByRole("button", { name: /close modal/i });
        expect(document.activeElement).toBe(closeBtn);

        fireEvent.keyDown(window, { key: "Escape" });
        expect(document.activeElement).toBe(trigger);
    });
});
