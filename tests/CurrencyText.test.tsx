import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CurrencyText } from "../src/components/ui/CurrencyText";
import { MONEY_SIZE_CLASSES } from "../src/lib/moneyStyles";

describe("CurrencyText money scale", () => {
    it("formats the amount and inherits colour by default", () => {
        render(<CurrencyText amount={1234.5} />);
        const el = screen.getByText("S$1,234.50");
        expect(el.className).toContain("font-mono-num");
        expect(el.className).toContain("tabular-nums");
        expect(el.className).toContain(MONEY_SIZE_CLASSES.inline);
        expect(el.className).not.toMatch(/text-\(--text-ink\)/);
    });

    it.each(["hero", "lg", "md", "sm"] as const)(
        "applies the %s size classes",
        (size) => {
            render(<CurrencyText amount={10} size={size} />);
            const el = screen.getByText("S$10.00");
            expect(el.className).toContain("tabular-nums");
            for (const cls of MONEY_SIZE_CLASSES[size].split(" ")) {
                expect(el.className).toContain(cls);
            }
        },
    );

    it("shows a pre-formatted value when given", () => {
        render(<CurrencyText formatted="+S$100" tone="positive" />);
        expect(screen.getByText("+S$100").className).toContain(
            "text-emerald-700",
        );
        expect(screen.getByText("+S$100").className).toContain("tabular-nums");
    });
});

describe("CurrencyText animation", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("renders initial value without animating", () => {
        render(<CurrencyText amount={50} animate />);
        expect(screen.getByText("S$50.00")).toBeInTheDocument();
    });

    it("tweens to the new value over time when animate is true", async () => {
        const { rerender } = render(<CurrencyText amount={100} animate />);
        expect(screen.getByText("S$100.00")).toBeInTheDocument();

        await act(async () => {
            rerender(<CurrencyText amount={200} animate />);
        });

        // Halfway through tween
        await act(async () => {
            vi.advanceTimersByTime(110);
        });

        // S$100.00 should no longer be shown; intermediate value should be present
        expect(screen.queryByText("S$100.00")).not.toBeInTheDocument();
        expect(screen.queryByText("S$200.00")).not.toBeInTheDocument();

        // Complete the animation
        await act(async () => {
            vi.advanceTimersByTime(200);
        });
        expect(screen.getByText("S$200.00")).toBeInTheDocument();
    });

    it("snaps instantly when animate is false", async () => {
        const { rerender } = render(<CurrencyText amount={100} />);
        expect(screen.getByText("S$100.00")).toBeInTheDocument();

        await act(async () => {
            rerender(<CurrencyText amount={200} />);
        });

        expect(screen.getByText("S$200.00")).toBeInTheDocument();
    });

    it("respects prefers-reduced-motion by snapping instantly even when animate is true", async () => {
        const originalMatchMedia = window.matchMedia;
        window.matchMedia = vi.fn().mockImplementation((query: string) => ({
            matches: query.includes("prefers-reduced-motion: reduce"),
            media: query,
            onchange: null,
            addListener: vi.fn(),
            removeListener: vi.fn(),
            addEventListener: vi.fn(),
            removeEventListener: vi.fn(),
            dispatchEvent: vi.fn(),
        }));

        try {
            const { rerender } = render(<CurrencyText amount={100} animate />);
            expect(screen.getByText("S$100.00")).toBeInTheDocument();

            await act(async () => {
                rerender(<CurrencyText amount={300} animate />);
            });

            // Immediately snaps to S$300.00 without timer advancement
            expect(screen.getByText("S$300.00")).toBeInTheDocument();
        } finally {
            window.matchMedia = originalMatchMedia;
        }
    });

    it("preserves formatted prop precedence even when animate is true", async () => {
        const { rerender } = render(
            <CurrencyText amount={100} formatted="+S$100" animate />,
        );
        expect(screen.getByText("+S$100")).toBeInTheDocument();

        await act(async () => {
            rerender(<CurrencyText amount={200} formatted="+S$200" animate />);
        });

        expect(screen.getByText("+S$200")).toBeInTheDocument();
    });
});
