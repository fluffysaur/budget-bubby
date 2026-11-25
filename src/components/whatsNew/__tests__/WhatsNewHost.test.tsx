import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { WhatsNewHost } from "../WhatsNewHost";
import { RELEASE_NOTES } from "../../../data/releaseNotes";
import {
    WHATS_NEW_STORAGE_KEY,
    getVisibleReleaseNotes,
} from "../../../lib/releaseNotes";

const latest = getVisibleReleaseNotes(RELEASE_NOTES)[0];

function renderHost(blocked = false) {
    return render(
        <MemoryRouter>
            <WhatsNewHost blocked={blocked} />
        </MemoryRouter>,
    );
}

describe("WhatsNewHost", () => {
    beforeEach(() => localStorage.removeItem(WHATS_NEW_STORAGE_KEY));

    it("shows unseen notes after a pause and marks them seen on close", async () => {
        localStorage.setItem(WHATS_NEW_STORAGE_KEY, "0.0.1");
        renderHost();

        const modal = await screen.findByTestId(
            "whats-new-modal",
            {},
            { timeout: 3000 },
        );
        expect(modal).toBeInTheDocument();
        expect(
            screen.getByTestId(`whats-new-version-${latest.version}`),
        ).toBeInTheDocument();

        fireEvent.click(screen.getByRole("button", { name: "Got it" }));
        await waitFor(() =>
            expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe(
                latest.version,
            ),
        );
    });

    it("stays silent when everything is already seen", async () => {
        localStorage.setItem(WHATS_NEW_STORAGE_KEY, "999.0.0");
        renderHost();
        await new Promise((r) => setTimeout(r, 1700));
        expect(screen.queryByTestId("whats-new-modal")).toBeNull();
        expect(localStorage.getItem(WHATS_NEW_STORAGE_KEY)).toBe("999.0.0");
    });

    it("waits while blocked", async () => {
        localStorage.setItem(WHATS_NEW_STORAGE_KEY, "0.0.1");
        renderHost(true);
        await new Promise((r) => setTimeout(r, 1700));
        expect(screen.queryByTestId("whats-new-modal")).toBeNull();
    });
});
