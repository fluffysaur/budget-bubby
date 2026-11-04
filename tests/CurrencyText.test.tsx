import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { CurrencyText } from "../src/components/ui/CurrencyText";
import { MONEY_SIZE_CLASSES } from "../src/lib/moneyStyles";

describe("CurrencyText money scale", () => {
    it("formats the amount and inherits colour by default", () => {
        render(<CurrencyText amount={1234.5} />);
        const el = screen.getByText("S$1,234.50");
        expect(el.className).toContain("font-mono-num");
        expect(el.className).toContain(MONEY_SIZE_CLASSES.inline);
        expect(el.className).not.toMatch(/text-\(--text-ink\)/);
    });

    it.each(["hero", "lg", "md", "sm"] as const)("applies the %s size classes", (size) => {
        render(<CurrencyText amount={10} size={size} />);
        const el = screen.getByText("S$10.00");
        for (const cls of MONEY_SIZE_CLASSES[size].split(" ")) {
            expect(el.className).toContain(cls);
        }
    });

    it("shows a pre-formatted value when given", () => {
        render(<CurrencyText formatted="+S$100" tone="positive" />);
        expect(screen.getByText("+S$100").className).toContain("text-emerald-700");
    });
});
