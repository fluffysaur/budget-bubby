import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { PinLoginScreen } from "../src/components/auth/PinLoginScreen";
import { HouseholdProvider, useHousehold } from "../src/context/HouseholdContext";
import { AppHeader } from "../src/components/layout/AppHeader";

function AuthTestComponent() {
    const { loggedInPartner, isAuthenticated, signInWithPin, signOut, authError } = useAuth();
    const { perspective } = useHousehold();

    return (
        <div>
            <div data-testid="is-authenticated">{isAuthenticated ? "yes" : "no"}</div>
            <div data-testid="partner">{loggedInPartner || "none"}</div>
            <div data-testid="perspective">{perspective}</div>
            <div data-testid="auth-error">{authError || "none"}</div>
            <button onClick={() => signInWithPin("123456")}>Sign In Yi Jia</button>
            <button onClick={() => signInWithPin("234567")}>Sign In Rachel</button>
            <button onClick={() => signInWithPin("000000")}>Sign In Wrong</button>
            <button onClick={signOut}>Sign Out</button>
        </div>
    );
}

describe("PIN Authentication & Access Control", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it("renders 6-digit PIN screen with 6 empty dots and interactive numpad", () => {
        render(
            <AuthProvider initialAuthenticated={false}>
                <PinLoginScreen />
            </AuthProvider>,
        );

        expect(screen.getByText("Budget Buddy")).toBeInTheDocument();
        expect(screen.getByText("Enter your 6-digit PIN to unlock")).toBeInTheDocument();

        for (let i = 0; i < 6; i++) {
            expect(screen.getByTestId(`pin-dot-${i}`)).toBeInTheDocument();
        }

        // Numbers 0-9 buttons
        for (let i = 0; i <= 9; i++) {
            expect(screen.getByRole("button", { name: `Digit ${i}` })).toBeInTheDocument();
        }
    });

    it("enters digits via numpad and fills dots accordingly", () => {
        render(
            <AuthProvider initialAuthenticated={false}>
                <PinLoginScreen />
            </AuthProvider>,
        );

        const btn1 = screen.getByRole("button", { name: "Digit 1" });
        const btn2 = screen.getByRole("button", { name: "Digit 2" });

        fireEvent.click(btn1);
        expect(screen.getByTestId("pin-dot-0")).toHaveClass("bg-emerald-400");
        expect(screen.getByTestId("pin-dot-1")).not.toHaveClass("bg-emerald-400");

        fireEvent.click(btn2);
        expect(screen.getByTestId("pin-dot-1")).toHaveClass("bg-emerald-400");
        expect(screen.getByTestId("pin-dot-2")).not.toHaveClass("bg-emerald-400");

        // Backspace
        const backspaceBtn = screen.getByRole("button", { name: "Backspace" });
        fireEvent.click(backspaceBtn);
        expect(screen.getByTestId("pin-dot-1")).not.toHaveClass("bg-emerald-400");

        // Clear
        const clearBtn = screen.getByRole("button", { name: "Clear PIN" });
        fireEvent.click(btn1);
        fireEvent.click(clearBtn);
        expect(screen.getByTestId("pin-dot-0")).not.toHaveClass("bg-emerald-400");
    });

    it("auto-submits upon entering the 6th digit", async () => {
        const onSuccess = vi.fn();
        render(
            <AuthProvider initialAuthenticated={false}>
                <PinLoginScreen onSuccess={onSuccess} />
            </AuthProvider>,
        );

        const btn1 = screen.getByRole("button", { name: "Digit 1" });
        // Click 6 times
        for (let i = 0; i < 6; i++) {
            fireEvent.click(btn1);
        }

        await waitFor(() => {
            expect(onSuccess).toHaveBeenCalled();
        });
    });

    it("identifies partner and sets default perspective accordingly", async () => {
        render(
            <AuthProvider initialAuthenticated={true}>
                <HouseholdProvider defaultPerspective="yijia">
                    <AuthTestComponent />
                </HouseholdProvider>
            </AuthProvider>,
        );

        expect(screen.getByTestId("perspective")).toHaveTextContent("yijia");

        // Simulate Rachel PIN sign in
        await act(async () => {
            fireEvent.click(screen.getByText("Sign In Rachel"));
        });
        expect(screen.getByTestId("partner")).toHaveTextContent("rachel");
    });

    it("Lock/Sign Out button renders in AppHeader and triggers signOut via modal portal", async () => {
        render(
            <AuthProvider initialAuthenticated={true}>
                <HouseholdProvider>
                    <AppHeader />
                </HouseholdProvider>
            </AuthProvider>,
        );

        const lockBtn = screen.getByRole("button", { name: /lock budget buddy/i });
        expect(lockBtn).toBeInTheDocument();

        // Click lock button to open confirmation modal
        fireEvent.click(lockBtn);
        expect(screen.getByRole("heading", { name: /lock & sign out\?/i })).toBeInTheDocument();

        // Cancel button closes the modal
        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(screen.queryByRole("heading", { name: /lock & sign out\?/i })).not.toBeInTheDocument();

        // Open again and dismiss via Escape key
        fireEvent.click(lockBtn);
        expect(screen.getByRole("heading", { name: /lock & sign out\?/i })).toBeInTheDocument();
        fireEvent.keyDown(window, { key: "Escape" });
        expect(screen.queryByRole("heading", { name: /lock & sign out\?/i })).not.toBeInTheDocument();

        // Open again and click Sign Out
        fireEvent.click(lockBtn);
        expect(screen.getByRole("heading", { name: /lock & sign out\?/i })).toBeInTheDocument();
        fireEvent.click(screen.getByRole("button", { name: /^sign out$/i }));
        expect(screen.queryByRole("heading", { name: /lock & sign out\?/i })).not.toBeInTheDocument();
    });
});
