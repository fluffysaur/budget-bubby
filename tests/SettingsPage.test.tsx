import {
    render,
    screen,
    fireEvent,
    waitFor,
    act,
} from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { App } from "../src/App";
import { useSettings } from "../src/hooks/useSettings";
import {
    getAiStatus,
    getAutoCaptureStatus,
    getGeneralStatus,
    getNotificationsStatus,
} from "../src/lib/settingsStatus";
import { parseSettingsSection, settingsPath } from "../src/lib/settingsRoutes";
import {
    AI_ACTIVE_PROVIDER_STORAGE_KEY,
    AI_CONFIG_CHANGED_EVENT,
    getProviderKeyStorageKey,
} from "../src/services/ai/providers";

const originalMatchMedia = window.matchMedia;

function setDesktop(isDesktop: boolean) {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: (query: string) => ({
            matches: isDesktop && query.includes("min-width: 768px"),
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
        }),
    });
}

beforeEach(() => {
    localStorage.clear();
    localStorage.setItem(
        "bb_onboarding_v1",
        JSON.stringify({ seen: true, hatched: true }),
    );
    setDesktop(false);
});

afterEach(() => {
    Object.defineProperty(window, "matchMedia", {
        writable: true,
        configurable: true,
        value: originalMatchMedia,
    });
});

describe("settings status words", () => {
    it("maps state to short words", () => {
        expect(getGeneralStatus("light")).toBe("Light");
        expect(getGeneralStatus("dark")).toBe("Dark");
        expect(getNotificationsStatus(true, "granted")).toBe("On");
        expect(getNotificationsStatus(false, "granted")).toBe("Off");
        expect(getNotificationsStatus(true, "denied")).toBe("Blocked");
        expect(getAiStatus("OpenRouter", true)).toBe("OpenRouter");
        expect(getAiStatus("OpenRouter", false)).toBe("Off");
        expect(getAutoCaptureStatus(2)).toBe("Set up");
        expect(getAutoCaptureStatus(0)).toBe("Not set");
    });

    it("parses settings paths", () => {
        expect(parseSettingsSection("/settings")).toBeNull();
        expect(parseSettingsSection("/settings/")).toBeNull();
        expect(parseSettingsSection("/settings/ai")).toBe("ai");
        expect(parseSettingsSection("/settings/nope")).toBe("unknown");
        expect(parseSettingsSection("/dashboard")).toBeNull();
        expect(settingsPath("auto-capture")).toBe("/settings/auto-capture");
    });
});

describe("Settings index", () => {
    it("shows live status words for each group", async () => {
        render(<App initialEntries={["/settings"]} />);

        expect(await screen.findByTestId("settings-row-general")).toBeInTheDocument();
        expect(screen.getByTestId("settings-status-general")).toHaveTextContent(
            "Light",
        );
        await waitFor(() =>
            expect(
                screen.getByTestId("settings-status-notifications"),
            ).toHaveTextContent(/^(On|Off|Blocked)$/),
        );
        expect(screen.getByTestId("settings-status-ai")).toHaveTextContent(
            "Off",
        );
        await waitFor(() =>
            expect(
                screen.getByTestId("settings-status-auto-capture"),
            ).toHaveTextContent("Not set"),
        );

        // Saving an AI key updates the Bubby AI word live
        act(() => {
            localStorage.setItem(AI_ACTIVE_PROVIDER_STORAGE_KEY, "gemini");
            localStorage.setItem(getProviderKeyStorageKey("gemini"), "key-123");
            window.dispatchEvent(new Event(AI_CONFIG_CHANGED_EVENT));
        });
        expect(screen.getByTestId("settings-status-ai")).toHaveTextContent(
            "Gemini",
        );
    });

    it("lists the groups and links to each sub-page", async () => {
        render(<App initialEntries={["/settings"]} />);
        const row = await screen.findByTestId("settings-row-notifications");
        expect(row).toHaveAttribute("href", "/settings/notifications");
        fireEvent.click(row);
        expect(
            await screen.findByRole("heading", { name: "Notifications" }),
        ).toBeInTheDocument();
        expect(screen.getByTestId("toggle-push-enabled")).toBeInTheDocument();

        // Sub-page back returns to the index
        fireEvent.click(screen.getByTestId("settings-back-btn"));
        expect(await screen.findByTestId("settings-row-ai")).toBeInTheDocument();
    });

    it("sends the index back button to the dashboard when there is no history", async () => {
        render(<App initialEntries={["/settings"]} />);
        fireEvent.click(await screen.findByTestId("settings-back-btn"));
        await waitFor(() =>
            expect(screen.queryByTestId("settings-page")).toBeNull(),
        );
    });

    it("does not loop back to a deep-linked sub-page", async () => {
        render(<App initialEntries={["/dashboard", "/settings/ai"]} />);
        // Sub-page back replaces the deep link with the index
        fireEvent.click(await screen.findByTestId("settings-back-btn"));
        expect(await screen.findByTestId("settings-row-ai")).toBeInTheDocument();
        // Index back then leaves Settings instead of returning to /settings/ai
        fireEvent.click(screen.getByTestId("settings-back-btn"));
        await waitFor(() =>
            expect(screen.queryByTestId("settings-page")).toBeNull(),
        );
    });

    it("redirects unknown sections to the index", async () => {
        render(<App initialEntries={["/settings/nope"]} />);
        expect(await screen.findByTestId("settings-row-general")).toBeInTheDocument();
    });
});

describe("mobile chrome on settings routes", () => {
    it("hides the app header and bottom tab bar on /settings*", async () => {
        render(<App initialEntries={["/settings"]} />);
        await screen.findByTestId("settings-page");
        expect(document.querySelector("header")).toHaveClass("max-md:hidden");
        expect(
            screen.queryByRole("navigation", { name: "Mobile Navigation" }),
        ).toBeNull();
    });

    it("hides them on sub-pages too, and keeps them elsewhere", async () => {
        const { unmount } = render(
            <App initialEntries={["/settings/general"]} />,
        );
        await screen.findByTestId("settings-page");
        expect(document.querySelector("header")).toHaveClass("max-md:hidden");
        expect(
            screen.queryByRole("navigation", { name: "Mobile Navigation" }),
        ).toBeNull();
        unmount();

        render(<App initialEntries={["/dashboard"]} />);
        expect(
            await screen.findByRole("navigation", {
                name: "Mobile Navigation",
            }),
        ).toBeInTheDocument();
        expect(document.querySelector("header")).not.toHaveClass(
            "max-md:hidden",
        );
    });
});

describe("desktop two-pane", () => {
    it("shows General beside the list at /settings, with the active row marked", async () => {
        setDesktop(true);
        render(<App initialEntries={["/settings"]} />);

        expect(
            await screen.findByTestId("toggle-sound-enabled"),
        ).toBeInTheDocument();
        expect(screen.getByTestId("settings-row-general")).toHaveAttribute(
            "aria-current",
            "page",
        );
        expect(screen.getByTestId("app-version-label")).toBeInTheDocument();
        expect(screen.queryByTestId("settings-back-btn")).toBeNull();

        fireEvent.click(screen.getByTestId("settings-row-notifications"));
        expect(
            await screen.findByTestId("toggle-push-enabled"),
        ).toBeInTheDocument();
        expect(
            screen.getByTestId("settings-row-notifications"),
        ).toHaveAttribute("aria-current", "page");
    });

    it("updates the theme status word when the theme toggle flips", async () => {
        setDesktop(true);
        render(<App initialEntries={["/settings/general"]} />);
        fireEvent.click(await screen.findByTestId("toggle-theme"));
        await waitFor(() =>
            expect(
                screen.getByTestId("settings-status-general"),
            ).toHaveTextContent("Dark"),
        );
    });
});

describe("openSettings deep links", () => {
    function LocationProbe({ children }: { children?: ReactNode }) {
        const location = useLocation();
        return (
            <>
                <span data-testid="path">{location.pathname}</span>
                {children}
            </>
        );
    }

    function renderOpenSettings() {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <MemoryRouter initialEntries={["/dashboard"]}>
                <LocationProbe>{children}</LocationProbe>
            </MemoryRouter>
        );
        return renderHook(() => useSettings(), { wrapper });
    }

    it.each([
        ["ai", "/settings/ai"],
        ["notifications", "/settings/notifications"],
        ["auto-capture", "/settings/auto-capture"],
        ["general", "/settings/general"],
    ] as const)("openSettings(%s) goes to %s", (section, path) => {
        const { result } = renderOpenSettings();
        act(() => result.current.openSettings(section));
        expect(screen.getByTestId("path")).toHaveTextContent(path);
    });

    it("openSettings() with no section goes to /settings and ignores event args", () => {
        const { result } = renderOpenSettings();
        act(() => result.current.openSettings());
        expect(screen.getByTestId("path")).toHaveTextContent(/^\/settings$/);
        act(() =>
            (result.current.openSettings as (e: unknown) => void)({
                type: "click",
            }),
        );
        expect(screen.getByTestId("path")).toHaveTextContent(/^\/settings$/);
    });
});
