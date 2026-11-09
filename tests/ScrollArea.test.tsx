import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { ScrollArea } from "../src/components/ui/ScrollArea";
import { ModalBody } from "../src/components/ui/AnimatedModal";
import { computeScrollFade } from "../src/components/ui/useScrollFade";

function setMetrics(
    el: HTMLElement,
    m: { scrollTop: number; scrollHeight: number; clientHeight: number },
) {
    Object.defineProperty(el, "scrollTop", {
        value: m.scrollTop,
        configurable: true,
        writable: true,
    });
    Object.defineProperty(el, "scrollHeight", {
        value: m.scrollHeight,
        configurable: true,
    });
    Object.defineProperty(el, "clientHeight", {
        value: m.clientHeight,
        configurable: true,
    });
}

describe("computeScrollFade", () => {
    it("fades nothing when content does not overflow", () => {
        expect(computeScrollFade(0, 100, 100)).toEqual({
            canScrollUp: false,
            canScrollDown: false,
        });
    });

    it("fades only the bottom at the top of an overflowing list", () => {
        expect(computeScrollFade(0, 300, 100)).toEqual({
            canScrollUp: false,
            canScrollDown: true,
        });
    });

    it("fades both edges mid-scroll", () => {
        expect(computeScrollFade(50, 300, 100)).toEqual({
            canScrollUp: true,
            canScrollDown: true,
        });
    });

    it("fades only the top at the bottom (sub-pixel tolerant)", () => {
        expect(computeScrollFade(199.5, 300, 100)).toEqual({
            canScrollUp: true,
            canScrollDown: false,
        });
    });
});

describe("ScrollArea", () => {
    it("applies a bottom-only mask when overflowing at the top", () => {
        render(<ScrollArea data-testid="area">content</ScrollArea>);
        const el = screen.getByTestId("area");
        setMetrics(el, { scrollTop: 0, scrollHeight: 300, clientHeight: 100 });
        fireEvent.scroll(el);

        expect(el.dataset.fadeTop).toBe("false");
        expect(el.dataset.fadeBottom).toBe("true");
        expect(el.style.maskImage).toContain("linear-gradient");
    });

    it("fades the top once scrolled down", () => {
        render(<ScrollArea data-testid="area">content</ScrollArea>);
        const el = screen.getByTestId("area");
        setMetrics(el, { scrollTop: 50, scrollHeight: 300, clientHeight: 100 });
        fireEvent.scroll(el);

        expect(el.dataset.fadeTop).toBe("true");
        expect(el.dataset.fadeBottom).toBe("true");
    });

    it("applies no mask when content does not overflow", () => {
        render(<ScrollArea data-testid="area">content</ScrollArea>);
        const el = screen.getByTestId("area");
        setMetrics(el, { scrollTop: 0, scrollHeight: 100, clientHeight: 100 });
        fireEvent.scroll(el);

        expect(el.dataset.fadeTop).toBe("false");
        expect(el.dataset.fadeBottom).toBe("false");
        expect(el.style.maskImage).toBe("");
    });
});

describe("ModalBody scroll fade", () => {
    it("does not use fade masking by default", () => {
        render(
            <ModalBody>
                <p>body</p>
            </ModalBody>,
        );
        expect(screen.getByText("body").parentElement).not.toHaveAttribute(
            "data-fade-top",
        );
    });

    it("opts in to fade masking via scrollFade", () => {
        render(
            <ModalBody scrollFade>
                <p>body</p>
            </ModalBody>,
        );
        expect(screen.getByText("body").parentElement).toHaveAttribute(
            "data-fade-top",
        );
    });
});
