import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import {
    PrivacyProvider,
    usePrivacy,
    PRIVACY_STORAGE_KEY,
} from "../src/context/PrivacyContext";
import { CurrencyText } from "../src/components/ui/CurrencyText";
import { StatCard } from "../src/components/ui/StatCard";
import { StatRow } from "../src/components/ui/StatRow";
import { CollapsibleSection } from "../src/components/ui/CollapsibleSection";
import { StackedBar } from "../src/components/ui/StackedBar";

function Probe() {
    const { isPrivacyMode, togglePrivacy } = usePrivacy();
    return (
        <div>
            <span data-testid="state">{String(isPrivacyMode)}</span>
            <button onClick={togglePrivacy}>toggle</button>
            <CurrencyText amount={1234.5} />
            <CurrencyText formatted="$99.00" />
            <input aria-label="field" />
        </div>
    );
}

const press = (target: Element | Window, key = "h") =>
    act(() => {
        fireEvent.keyDown(target, { key });
    });

describe("PrivacyContext", () => {
    beforeEach(() => localStorage.clear());

    it("renders amounts unmasked without a provider", () => {
        render(<CurrencyText formatted="$5.00" />);
        expect(screen.getByText("$5.00")).toBeInTheDocument();
    });

    it("masks both amount and formatted values, and persists", () => {
        render(
            <PrivacyProvider>
                <Probe />
            </PrivacyProvider>,
        );
        expect(screen.getByText("$99.00")).toBeInTheDocument();
        fireEvent.click(screen.getByText("toggle"));
        expect(screen.getAllByText("••••")).toHaveLength(2);
        expect(screen.queryByText("$99.00")).not.toBeInTheDocument();
        expect(localStorage.getItem(PRIVACY_STORAGE_KEY)).toBe("1");
    });

    it("restores persisted state", () => {
        localStorage.setItem(PRIVACY_STORAGE_KEY, "1");
        render(
            <PrivacyProvider>
                <Probe />
            </PrivacyProvider>,
        );
        expect(screen.getByTestId("state")).toHaveTextContent("true");
    });

    it("toggles on H but not while typing in an input", () => {
        render(
            <PrivacyProvider>
                <Probe />
            </PrivacyProvider>,
        );
        press(window);
        expect(screen.getByTestId("state")).toHaveTextContent("true");
        press(screen.getByLabelText("field"));
        expect(screen.getByTestId("state")).toHaveTextContent("true");
        press(window, "H");
        expect(screen.getByTestId("state")).toHaveTextContent("false");
    });
});

describe("StatCard / StatRow masking", () => {
    beforeEach(() => localStorage.setItem(PRIVACY_STORAGE_KEY, "1"));

    it("masks SGD amounts in value, subtitle and tooltip text but keeps other text", () => {
        render(
            <PrivacyProvider>
                <StatCard
                    title="Net worth"
                    value="S$12,345.60"
                    subtitle="-S$1,200 card debt · 3 cards"
                />
                <StatRow icon={<span />} label="Avg" value="S$2k" />
            </PrivacyProvider>,
        );
        expect(screen.queryByText("S$12,345.60")).not.toBeInTheDocument();
        expect(
            screen.getByText("•••• card debt · 3 cards"),
        ).toBeInTheDocument();
        expect(screen.getAllByText("••••").length).toBeGreaterThanOrEqual(2);
    });

    it("leaves values untouched when privacy is off", () => {
        localStorage.setItem(PRIVACY_STORAGE_KEY, "0");
        render(
            <PrivacyProvider>
                <StatCard title="Spent" value="S$50.00" />
            </PrivacyProvider>,
        );
        expect(screen.getByText("S$50.00")).toBeInTheDocument();
    });
});

describe("Section and bar masking", () => {
    it("masks amounts in CollapsibleSection subtitle and StackedBar label", () => {
        localStorage.setItem(PRIVACY_STORAGE_KEY, "1");
        render(
            <PrivacyProvider>
                <CollapsibleSection
                    title="Allocations"
                    subtitle="S$1,500/mo"
                    summaryRight="3-mo avg: S$2k"
                >
                    body
                </CollapsibleSection>
                <StackedBar
                    segments={[{ id: "a", label: "A", value: 5, tone: "ok" }]}
                    ariaLabel="Paid S$50.00"
                />
            </PrivacyProvider>,
        );
        expect(screen.getByText("••••/mo")).toBeInTheDocument();
        expect(screen.getByText("3-mo avg: ••••")).toBeInTheDocument();
        expect(screen.getByRole("img")).toHaveAttribute(
            "aria-label",
            "Paid ••••",
        );
    });
});
