import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RangeSlider } from "../src/components/ui/RangeSlider";

// jsdom has no PointerEvent; without it pointerType/clientX are dropped.
class TestPointerEvent extends MouseEvent {
    pointerId: number;
    pointerType: string;
    constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
    }
}
beforeAll(() => {
    vi.stubGlobal("PointerEvent", TestPointerEvent);
});
afterAll(() => {
    vi.unstubAllGlobals();
});

function setup() {
    const onValueChange = vi.fn();
    render(
        <RangeSlider
            data-testid="slider"
            min={0}
            max={100}
            step={1}
            value={50}
            onValueChange={onValueChange}
        />,
    );
    return { slider: screen.getByTestId("slider"), onValueChange };
}

const touch = (x: number, y: number) => ({
    pointerId: 1,
    pointerType: "touch",
    clientX: x,
    clientY: y,
});

describe("RangeSlider", () => {
    it("passes keyboard / programmatic changes straight through", () => {
        const { slider, onValueChange } = setup();
        fireEvent.change(slider, { target: { value: "60" } });
        expect(onValueChange).toHaveBeenCalledWith("60");
    });

    it("passes mouse changes straight through", () => {
        const { slider, onValueChange } = setup();
        fireEvent.pointerDown(slider, {
            pointerId: 1,
            pointerType: "mouse",
            clientX: 10,
            clientY: 10,
        });
        fireEvent.change(slider, { target: { value: "70" } });
        expect(onValueChange).toHaveBeenCalledWith("70");
    });

    it("ignores the track jump when a touch turns into a vertical swipe", () => {
        const { slider, onValueChange } = setup();
        fireEvent.pointerDown(slider, touch(100, 100));
        fireEvent.change(slider, { target: { value: "80" } });
        fireEvent.pointerMove(slider, touch(102, 130));
        fireEvent.pointerUp(slider, touch(102, 130));
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it("discards the jump when the browser cancels the touch to scroll", () => {
        const { slider, onValueChange } = setup();
        fireEvent.pointerDown(slider, touch(100, 100));
        fireEvent.change(slider, { target: { value: "80" } });
        fireEvent.pointerCancel(slider, touch(100, 100));
        expect(onValueChange).not.toHaveBeenCalled();
    });

    it("commits the jump on a tap with no movement", () => {
        const { slider, onValueChange } = setup();
        fireEvent.pointerDown(slider, touch(100, 100));
        fireEvent.change(slider, { target: { value: "80" } });
        fireEvent.pointerUp(slider, touch(100, 100));
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledWith("80");
    });

    it("commits and keeps updating on a horizontal drag", () => {
        const { slider, onValueChange } = setup();
        fireEvent.pointerDown(slider, touch(100, 100));
        fireEvent.change(slider, { target: { value: "55" } });
        fireEvent.pointerMove(slider, touch(130, 102));
        expect(onValueChange).toHaveBeenLastCalledWith("55");
        fireEvent.change(slider, { target: { value: "65" } });
        expect(onValueChange).toHaveBeenLastCalledWith("65");
    });

    it("opts the track into vertical panning", () => {
        const { slider } = setup();
        expect(slider.className).toContain("touch-pan-y");
    });
});
