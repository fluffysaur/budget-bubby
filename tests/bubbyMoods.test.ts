import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useBubbyReaction } from "../src/hooks/useBubby";
import { emitAppEvent } from "../src/lib/appEvents";
import { MOOD_FACE } from "../src/lib/bubby/moods";

describe("mood faces", () => {
    it("only the normal mood has no overlay", () => {
        expect(MOOD_FACE.normal.overlay).toBeUndefined();
        expect(MOOD_FACE.rumbly.overlay).toBe("rumble");
        expect(MOOD_FACE.teary.overlay).toBe("tears");
        expect(MOOD_FACE.missyou.overlay).toBe("sign");
    });
});

describe("reactions", () => {
    afterEach(() => {
        vi.useRealTimers();
    });

    it("override then clear within 400ms", () => {
        vi.useFakeTimers();
        const { result } = renderHook(() => useBubbyReaction());
        expect(result.current).toBeNull();
        act(() => emitAppEvent("bubby:react", { kind: "reunion" }));
        expect(result.current).toBe("reunion");
        act(() => {
            vi.advanceTimersByTime(400);
        });
        expect(result.current).toBeNull();
    });
});
