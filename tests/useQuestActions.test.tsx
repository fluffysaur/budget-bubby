import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { useQuestActions } from "../src/hooks/useQuestActions";
import type { Quest } from "../src/lib/bubby/quests";

const pet = vi.fn();

vi.mock("../src/hooks/useBubby", () => ({
    useBubby: () => ({ pet }),
}));

const quest = (id: string, done = false): Quest => ({
    id,
    label: id,
    reward: "food",
    done,
});

function wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={["/"]}>{children}</MemoryRouter>;
}

function renderActions(onDone?: () => void) {
    return renderHook(
        () => ({ select: useQuestActions(onDone), loc: useLocation() }),
        { wrapper },
    );
}

describe("useQuestActions", () => {
    beforeEach(() => {
        pet.mockClear();
    });

    it("opens quick add for the log quest and then calls onDone", () => {
        const onDone = vi.fn();
        const listener = vi.fn();
        window.addEventListener("openQuickAdd", listener);
        const { result } = renderActions(onDone);

        result.current.select(quest("log"));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(onDone).toHaveBeenCalledTimes(1);
        window.removeEventListener("openQuickAdd", listener);
    });

    it("pets Bubby without calling onDone (sheet stays open)", () => {
        const onDone = vi.fn();
        const { result } = renderActions(onDone);

        result.current.select(quest("pet"));

        expect(pet).toHaveBeenCalledTimes(1);
        expect(onDone).not.toHaveBeenCalled();
    });

    it.each([
        ["inbox", "/inbox"],
        ["balances", "/accounts"],
    ])("navigates for the %s quest", (id, path) => {
        const onDone = vi.fn();
        const { result } = renderActions(onDone);

        act(() => result.current.select(quest(id)));

        expect(onDone).toHaveBeenCalledTimes(1);
        // MemoryRouter's navigator pushes onto its history
        expect(result.current.loc.pathname).toBe(path);
    });

    it("scrolls to the recap card when it is on the page", () => {
        const scroll = vi.fn();
        const el = document.createElement("div");
        el.id = "weekly-recap";
        el.scrollIntoView = scroll;
        document.body.appendChild(el);

        const { result } = renderActions();
        result.current.select(quest("recap"));
        expect(scroll).toHaveBeenCalledTimes(1);

        el.remove();
    });

    it("ignores quests that are already done", () => {
        const onDone = vi.fn();
        const { result } = renderActions(onDone);

        result.current.select(quest("pet", true));

        expect(pet).not.toHaveBeenCalled();
        expect(onDone).not.toHaveBeenCalled();
    });
});
