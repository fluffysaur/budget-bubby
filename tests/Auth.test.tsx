import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { PinLoginScreen } from "../src/components/auth/PinLoginScreen";
import { HouseholdProvider, useHousehold } from "../src/context/HouseholdContext";
import { AppHeader } from "../src/components/layout/AppHeader";
import {
    isBiometricsAvailable,
    isBiometricsEnrolled,
    enrollBiometrics,
    authenticateWithBiometrics,
    disableBiometrics,
    getEnrolledBiometricInfo,
    BIOMETRICS_STORAGE_KEY,
} from "../src/lib/webauthnBiometrics";

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
        sessionStorage.clear();
        vi.restoreAllMocks();
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("renders 6-digit PIN screen with 6 empty dots and interactive numpad", () => {
        render(
            <AuthProvider initialAuthenticated={false}>
                <PinLoginScreen />
            </AuthProvider>,
        );

        expect(screen.getByText("Budget Bubby")).toBeInTheDocument();
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
            <MemoryRouter>
                <AuthProvider initialAuthenticated={true}>
                    <HouseholdProvider>
                        <AppHeader />
                    </HouseholdProvider>
                </AuthProvider>
            </MemoryRouter>,
        );

        const lockBtn = screen.getByRole("button", { name: /lock budget bubby/i });
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

    describe("WebAuthn Biometric Authentication", () => {
        it("detects platform biometric availability correctly", async () => {
            // Setup mock PublicKeyCredential
            const origPK = window.PublicKeyCredential;
            (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
            };

            const available = await isBiometricsAvailable();
            expect(available).toBe(true);

            // When unavailable
            (
                window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable as ReturnType<typeof vi.fn>
            ).mockResolvedValueOnce(false);
            const unavailable = await isBiometricsAvailable();
            expect(unavailable).toBe(false);

            (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = origPK;
        });

        it("enrolls biometrics, encrypts device unlock token, and recovers PIN on authentication", async () => {
            // Mock navigator.credentials.create
            const rawId = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;
            const mockCredential = {
                id: "credential-abc-123",
                rawId,
                type: "public-key",
            };

            Object.defineProperty(navigator, "credentials", {
                value: {
                    create: vi.fn().mockResolvedValue(mockCredential),
                    get: vi.fn().mockResolvedValue({ id: "credential-abc-123" }),
                },
                configurable: true,
            });

            expect(isBiometricsEnrolled()).toBe(false);

            // Enroll with PIN
            const enrolled = await enrollBiometrics("123456", "Yi Jia");
            expect(enrolled).toBe(true);
            expect(isBiometricsEnrolled()).toBe(true);

            const info = getEnrolledBiometricInfo();
            expect(info.enrolled).toBe(true);
            expect(info.partnerName).toBe("Yi Jia");

            // Storage has encrypted payload
            const stored = localStorage.getItem(BIOMETRICS_STORAGE_KEY);
            expect(stored).toBeTruthy();
            expect(stored).not.toContain('"pin":"123456"'); // Must not store raw PIN in cleartext

            // Authenticate with biometrics and recover PIN
            const pin = await authenticateWithBiometrics();
            expect(pin).toBe("123456");

            // Disable biometrics
            disableBiometrics();
            expect(isBiometricsEnrolled()).toBe(false);
            expect(localStorage.getItem(BIOMETRICS_STORAGE_KEY)).toBeNull();
        });

        it('renders prominent "Unlock with Fingerprint / Face ID" button on PinLoginScreen when enrolled', async () => {
            // Pre-enroll biometrics in localStorage
            localStorage.setItem(
                BIOMETRICS_STORAGE_KEY,
                JSON.stringify({
                    credentialId: "cred-test",
                    encryptedToken: btoa(
                        encodeURIComponent(JSON.stringify({ pin: "654321", credentialId: "cred-test" })),
                    ),
                    enrolledAt: new Date().toISOString(),
                    partnerName: "Rachel",
                }),
            );

            // Mock platform authenticator support
            (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
            };

            render(
                <MemoryRouter>
                    <AuthProvider initialAuthenticated={false}>
                        <PinLoginScreen />
                    </AuthProvider>
                </MemoryRouter>,
            );

            const bioBtn = await screen.findByTestId("biometric-unlock-btn");
            expect(bioBtn).toBeInTheDocument();
            expect(bioBtn.textContent).toContain("Unlock with Fingerprint / Face ID");

            // Also renders disable option
            const disableBtn = screen.getByTestId("disable-biometrics-btn");
            expect(disableBtn).toBeInTheDocument();

            // Clicking disable removes it
            act(() => {
                fireEvent.click(disableBtn);
            });
            expect(screen.queryByTestId("biometric-unlock-btn")).not.toBeInTheDocument();
        });

        it("unlocks session seamlessly when biometric unlock button is clicked", async () => {
            // Enroll
            Object.defineProperty(navigator, "credentials", {
                value: {
                    create: vi
                        .fn()
                        .mockResolvedValue({ id: "cred-unlock", rawId: new Uint8Array([1, 2, 3]).buffer }),
                    get: vi.fn().mockResolvedValue({ id: "cred-unlock" }),
                },
                configurable: true,
            });

            await enrollBiometrics("000000", "Demo User");

            (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
            };

            const onSuccess = vi.fn();

            render(
                <MemoryRouter>
                    <AuthProvider initialAuthenticated={false}>
                        <PinLoginScreen onSuccess={onSuccess} />
                    </AuthProvider>
                </MemoryRouter>,
            );

            const bioBtn = await screen.findByTestId("biometric-unlock-btn");
            await act(async () => {
                fireEvent.click(bioBtn);
            });

            await waitFor(() => {
                expect(onSuccess).toHaveBeenCalled();
            });
        });

        it("prompts user to enroll biometrics after successful PIN entry if supported", async () => {
            (window as unknown as { PublicKeyCredential: unknown }).PublicKeyCredential = {
                isUserVerifyingPlatformAuthenticatorAvailable: vi.fn().mockResolvedValue(true),
            };

            Object.defineProperty(navigator, "credentials", {
                value: {
                    create: vi
                        .fn()
                        .mockResolvedValue({ id: "cred-enrolled-prompt", rawId: new Uint8Array([9, 9]).buffer }),
                },
                configurable: true,
            });

            const onSuccess = vi.fn();

            render(
                <MemoryRouter>
                    <AuthProvider initialAuthenticated={false}>
                        <PinLoginScreen onSuccess={onSuccess} />
                    </AuthProvider>
                </MemoryRouter>,
            );

            // Enter 6-digit demo PIN '000000'
            const digit0 = screen.getByRole("button", { name: "Digit 0" });
            for (let i = 0; i < 6; i++) {
                await act(async () => {
                    fireEvent.click(digit0);
                });
            }

            // Dialog should appear asking to enable biometrics
            const confirmEnrollBtn = await screen.findByTestId("confirm-enroll-biometrics-btn");
            expect(confirmEnrollBtn).toBeInTheDocument();
            expect(screen.getByText("Enable Biometric Login?")).toBeInTheDocument();

            // Click Enable Biometrics
            await act(async () => {
                fireEvent.click(confirmEnrollBtn);
            });

            expect(isBiometricsEnrolled()).toBe(true);
            expect(onSuccess).toHaveBeenCalled();
        });
    });
});
