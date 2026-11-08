import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SignOutConfirm } from "../src/components/auth/SignOutConfirm";
import * as AuthContextModule from "../src/context/AuthContext";
const { AuthProvider } = AuthContextModule;

describe("SignOutConfirm", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("does not render when isOpen is false", () => {
        render(
            <AuthProvider>
                <SignOutConfirm isOpen={false} onClose={vi.fn()} />
            </AuthProvider>,
        );

        expect(
            screen.queryByRole("heading", { name: /lock & sign out\?/i }),
        ).not.toBeInTheDocument();
    });

    it("renders modal with standard copy and icon when isOpen is true", () => {
        render(
            <AuthProvider>
                <SignOutConfirm isOpen={true} onClose={vi.fn()} />
            </AuthProvider>,
        );

        expect(
            screen.getByRole("heading", { name: /lock & sign out\?/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByText(/you'll need your pin to unlock\./i),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /cancel/i }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: /^sign out$/i }),
        ).toBeInTheDocument();
    });

    it("calls onClose when Cancel button is clicked", () => {
        const handleClose = vi.fn();
        render(
            <AuthProvider>
                <SignOutConfirm isOpen={true} onClose={handleClose} />
            </AuthProvider>,
        );

        fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose when Escape is pressed", () => {
        const handleClose = vi.fn();
        render(
            <AuthProvider>
                <SignOutConfirm isOpen={true} onClose={handleClose} />
            </AuthProvider>,
        );

        fireEvent.keyDown(window, { key: "Escape" });
        expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it("calls onClose and onConfirm when provided and Sign Out is clicked", async () => {
        const handleClose = vi.fn();
        const handleConfirm = vi.fn();
        render(
            <AuthProvider>
                <SignOutConfirm
                    isOpen={true}
                    onClose={handleClose}
                    onConfirm={handleConfirm}
                />
            </AuthProvider>,
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: /^sign out$/i }),
            );
        });
        expect(handleClose).toHaveBeenCalledTimes(1);
        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it("calls signOut when onConfirm is not provided and Sign Out is clicked", async () => {
        const handleClose = vi.fn();
        const mockSignOut = vi.fn();
        vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
            session: null,
            user: null,
            isAuthenticated: true,
            authLoading: false,
            authError: null,
            signInWithPin: vi.fn(),
            signOut: mockSignOut,
            clearAuthError: vi.fn(),
            isDemoMode: false,
            loggedInPartner: null,
        });

        render(<SignOutConfirm isOpen={true} onClose={handleClose} />);

        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: /^sign out$/i }),
            );
        });

        expect(handleClose).toHaveBeenCalledTimes(1);
        expect(mockSignOut).toHaveBeenCalledTimes(1);
    });

    it("awaits async onConfirm and does not call onClose if onConfirm rejects", async () => {
        const handleClose = vi.fn();
        let rejectPromise!: (reason: Error) => void;
        const pendingPromise = new Promise<void>((_, reject) => {
            rejectPromise = reject;
        });
        const handleConfirm = vi.fn().mockReturnValue(pendingPromise);

        render(
            <AuthProvider>
                <SignOutConfirm
                    isOpen={true}
                    onClose={handleClose}
                    onConfirm={handleConfirm}
                />
            </AuthProvider>,
        );

        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: /^sign out$/i }),
            );
        });

        // While pending, onClose must not have been called yet
        expect(handleClose).not.toHaveBeenCalled();

        // Reject the promise
        await act(async () => {
            rejectPromise(new Error("Sign out failed on server"));
        });

        // onClose should not be called on rejection, and the error should be displayed
        expect(handleClose).not.toHaveBeenCalled();
        expect(
            screen.getByText("Sign out failed on server"),
        ).toBeInTheDocument();
    });
});
