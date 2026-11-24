import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "../src/App";
import { AuthProvider } from "../src/context/AuthContext";
import { PinLoginScreen } from "../src/components/auth/PinLoginScreen";
import { THEME_STORAGE_KEY } from "../src/lib/theme";
import { PRIVACY_POLICY, TERMS_OF_USE } from "../src/data/legalContent";

describe("Legal pages", () => {
    afterEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove("dark");
    });

    it("applies the saved dark theme on public legal routes", async () => {
        localStorage.setItem(THEME_STORAGE_KEY, "dark");
        render(
            <App initialEntries={["/privacy"]} initialAuthenticated={false} />,
        );
        await screen.findByTestId("legal-page-privacy");
        await waitFor(() =>
            expect(document.documentElement.classList.contains("dark")).toBe(
                true,
            ),
        );
    });

    it("renders the privacy policy publicly when logged out", async () => {
        render(
            <App initialEntries={["/privacy"]} initialAuthenticated={false} />,
        );
        expect(
            await screen.findByTestId("legal-page-privacy"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", {
                level: 1,
                name: PRIVACY_POLICY.title,
            }),
        ).toBeInTheDocument();
        expect(
            screen.queryByText(/Not yet reviewed by the owner/i),
        ).not.toBeInTheDocument();
        expect(screen.queryByText(/\[Owner:/)).not.toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: TERMS_OF_USE.title }),
        ).toHaveAttribute("href", "/terms");
    });

    it("renders the terms of use publicly when logged out", async () => {
        render(
            <App initialEntries={["/terms"]} initialAuthenticated={false} />,
        );
        expect(
            await screen.findByTestId("legal-page-terms"),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("heading", { level: 1, name: TERMS_OF_USE.title }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("link", { name: PRIVACY_POLICY.title }),
        ).toHaveAttribute("href", "/privacy");
    });

    it("links both pages from the login screen", () => {
        render(
            <MemoryRouter>
                <AuthProvider initialAuthenticated={false}>
                    <PinLoginScreen />
                </AuthProvider>
            </MemoryRouter>,
        );
        expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute(
            "href",
            "/privacy",
        );
        expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute(
            "href",
            "/terms",
        );
    });
});
