import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { RecurringTypeBadge } from "../src/components/recurring/RecurringTypeBadge";
import { RECURRING_TYPE_SHORT_LABELS } from "../src/lib/recurringItems";

describe("RECURRING_TYPE_SHORT_LABELS", () => {
    it("defines concise abbreviated labels for recurring item types", () => {
        expect(RECURRING_TYPE_SHORT_LABELS.subscription).toBe("Sub");
        expect(RECURRING_TYPE_SHORT_LABELS.insurance).toBe("Ins");
        expect(RECURRING_TYPE_SHORT_LABELS.bill).toBe("Bill");
        expect(RECURRING_TYPE_SHORT_LABELS.tax).toBe("Tax");
        expect(RECURRING_TYPE_SHORT_LABELS.other).toBe("Other");
    });
});

describe("RecurringTypeBadge", () => {
    it("renders default full label when compactOnMobile is false or omitted", () => {
        render(<RecurringTypeBadge type="subscription" />);

        expect(screen.getByText("Subscription")).toBeInTheDocument();
        expect(screen.queryByText("Sub")).not.toBeInTheDocument();
    });

    it("renders responsive mobile abbreviation when compactOnMobile is true", () => {
        render(<RecurringTypeBadge type="subscription" compactOnMobile />);

        const badge = screen.getByRole("status");
        expect(badge).toHaveAttribute("aria-label", "Subscription");

        const mobileText = screen.getByText("Sub");
        const desktopText = screen.getByText("Subscription");

        expect(mobileText).toHaveClass("sm:hidden");
        expect(desktopText).toHaveClass("hidden", "sm:inline");
    });

    it("renders single label when type short label matches full label", () => {
        render(<RecurringTypeBadge type="bill" compactOnMobile />);

        const badge = screen.getByRole("status");
        expect(badge).toHaveAttribute("aria-label", "Bill");
        const label = screen.getByText("Bill");
        expect(label).toBeInTheDocument();
        // Should not have responsive hidden classes on the label itself
        expect(label).not.toHaveClass("sm:hidden");
        expect(label).not.toHaveClass("hidden");
    });
});
