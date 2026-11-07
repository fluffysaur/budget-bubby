import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../src/lib/queryClient";
import { AutoCaptureSection } from "../src/components/settings/AutoCaptureSection";
import { mockFinanceService } from "../src/services/mockFinanceService";
import { financeService } from "../src/services/financeService";
import { sha256Hex, CAPTURE_TOKEN_PATTERN } from "../src/lib/capture/token";

const MEMBER = "mem-00000000-0011";

function renderSection() {
    return render(
        <QueryClientProvider client={queryClient}>
            <AutoCaptureSection memberId={MEMBER} />
        </QueryClientProvider>,
    );
}

describe("AutoCaptureSection", () => {
    beforeEach(() => {
        localStorage.clear();
        mockFinanceService.resetData();
    });
    afterEach(() => vi.restoreAllMocks());

    it("creates a token, shows it once and stores only the hash", async () => {
        renderSection();
        const newButton = await screen.findByRole("button", { name: /New Token/i });
        await waitFor(() => expect(newButton).toBeEnabled());
        fireEvent.click(newButton);
        fireEvent.click(await screen.findByRole("button", { name: "Create" }));

        const shown = await screen.findByTestId("new-capture-token");
        const token = shown.textContent ?? "";
        expect(token).toMatch(CAPTURE_TOKEN_PATTERN);
        expect(screen.getByText("Shown once")).toBeInTheDocument();

        const rows = mockFinanceService.inbox.getStoredTokenRows();
        expect(rows).toHaveLength(1);
        expect(rows[0].token_hash).toBe(await sha256Hex(token));
        expect(JSON.stringify(rows)).not.toContain(token);
        expect(localStorage.getItem("budget_bubby_mock_inbox_v1") ?? "").not.toContain(token);

        fireEvent.click(screen.getByRole("button", { name: "Done" }));
        await waitFor(() => expect(screen.queryByTestId("new-capture-token")).not.toBeInTheDocument());
        const list = await screen.findByRole("list", { name: "Capture tokens" });
        expect(within(list).getByText(`•••• ${token.slice(-4)}`)).toBeInTheDocument();
        expect(within(list).getByText("Never used")).toBeInTheDocument();
    });

    it("revokes through a confirmation", async () => {
        await mockFinanceService.createCaptureToken("Pixel", MEMBER);
        renderSection();
        fireEvent.click(await screen.findByRole("button", { name: "Revoke Pixel token" }));
        expect(await screen.findByText("Revoke Token?")).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: "Revoke" }));
        await waitFor(() =>
            expect(screen.queryByRole("list", { name: "Capture tokens" })).not.toBeInTheDocument(),
        );
        expect(mockFinanceService.inbox.getStoredTokenRows()[0].revoked_at).toBeTruthy();
    });

    it("disables New Token at the 3-token limit", async () => {
        for (const label of ["a", "b", "c"]) {
            await mockFinanceService.createCaptureToken(label, MEMBER);
        }
        await expect(mockFinanceService.createCaptureToken("d", MEMBER)).rejects.toThrow(/up to 3/);
        renderSection();
        await screen.findByRole("list", { name: "Capture tokens" });
        expect(screen.getByRole("button", { name: /New Token/i })).toBeDisabled();
    });

    it("shows the database alert before the migration", async () => {
        vi.spyOn(financeService, "listCaptureTokens").mockResolvedValue({ available: false, tokens: [] });
        renderSection();
        expect(await screen.findByText("Not available")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /New Token/i })).toBeDisabled();
    });

    it("orders setup steps with Android first on Android user agents and iPhone first on iOS", async () => {
        const uaSpy = vi
            .spyOn(window.navigator, "userAgent", "get")
            .mockReturnValue("Mozilla/5.0 (Linux; Android 14; Pixel 8)");

        const { unmount } = renderSection();
        const stepsContainer = await screen.findByTestId("auto-capture-setup-steps");
        const buttons = within(stepsContainer).getAllByRole("button");
        expect(buttons[0]).toHaveTextContent("Android Setup");
        expect(buttons[0]).toHaveAttribute("aria-expanded", "true");
        expect(buttons[1]).toHaveTextContent("iPhone Setup");
        expect(buttons[1]).toHaveAttribute("aria-expanded", "false");
        expect(within(stepsContainer).getByRole("link", { name: /issue #44/i })).toBeInTheDocument();

        unmount();
        uaSpy.mockReturnValue("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)");
        renderSection();
        const iosSteps = await screen.findByTestId("auto-capture-setup-steps");
        const iosButtons = within(iosSteps).getAllByRole("button");
        expect(iosButtons[0]).toHaveTextContent("iPhone Setup");
        expect(iosButtons[0]).toHaveAttribute("aria-expanded", "true");
        expect(iosButtons[1]).toHaveTextContent("Android Setup");
        expect(iosButtons[1]).toHaveAttribute("aria-expanded", "false");
    });
});
