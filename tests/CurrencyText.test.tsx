import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { CurrencyText } from "../src/components/ui/CurrencyText";

vi.mock("../src/context/PrivacyContext", () => ({
    PRIVACY_MASK: "S$••••",
    usePrivacy: () => ({ isPrivacyMode: false }),
}));

describe("CurrencyText", () => {
    it("renders with whitespace-nowrap so negative signs do not wrap onto their own line", () => {
        render(<CurrencyText amount={-13551.75} size="sm" />);
        const el = screen.getByText("-S$13,551.75");
        expect(el.className).toContain("whitespace-nowrap");
    });

    it("steps down sized variants when the formatted amount is long", () => {
        const { rerender } = render(<CurrencyText amount={415.92} size="sm" />);
        expect(screen.getByText("S$415.92").className).toContain("text-xs");

        rerender(<CurrencyText amount={1401.12} size="sm" />);
        expect(screen.getByText("S$1,401.12").className).toContain(
            "text-[11px]",
        );

        rerender(<CurrencyText amount={-13551.75} size="sm" />);
        expect(screen.getByText("-S$13,551.75").className).toContain(
            "text-[10px]",
        );
    });

    it("respects autoShrink={false} on sized variants", () => {
        render(
            <CurrencyText amount={-13551.75} size="sm" autoShrink={false} />,
        );
        expect(screen.getByText("-S$13,551.75").className).toContain("text-xs");
    });

    it("does not shrink inline amounts by default", () => {
        render(<CurrencyText amount={-13551.75} />);
        const el = screen.getByText("-S$13,551.75");
        expect(el.className).toContain("font-bold");
        expect(el.className).not.toContain("text-[10px]");
    });
});
