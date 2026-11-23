import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HouseholdProvider } from "../src/context/HouseholdContext";
import { SettingsProvider } from "../src/context/SettingsContext";
import { DesktopSidebar } from "../src/components/layout/DesktopSidebar";
import { AppHeader } from "../src/components/layout/AppHeader";
import {
    useSidebarCollapsed,
    SIDEBAR_COLLAPSED_KEY,
} from "../src/hooks/useSidebarCollapsed";

function Harness() {
    const { collapsed, toggle } = useSidebarCollapsed();
    return (
        <MemoryRouter>
            <HouseholdProvider>
                <SettingsProvider>
                    <AppHeader
                        sidebarCollapsed={collapsed}
                        onToggleSidebar={toggle}
                    />
                    <DesktopSidebar collapsed={collapsed} spendBadgeCount={3} />
                </SettingsProvider>
            </HouseholdProvider>
        </MemoryRouter>
    );
}

describe("collapsible desktop sidebar", () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    describe("useSidebarCollapsed", () => {
        it("defaults to expanded", () => {
            const { result } = renderHook(() => useSidebarCollapsed());
            expect(result.current.collapsed).toBe(false);
        });

        it("toggles and persists to localStorage", () => {
            const { result } = renderHook(() => useSidebarCollapsed());
            act(() => result.current.toggle());
            expect(result.current.collapsed).toBe(true);
            expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe(
                "1",
            );
            act(() => result.current.toggle());
            expect(result.current.collapsed).toBe(false);
            expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe(
                "0",
            );
        });

        it("restores the collapsed state on mount", () => {
            window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
            const { result } = renderHook(() => useSidebarCollapsed());
            expect(result.current.collapsed).toBe(true);
        });

        it("survives localStorage throwing", () => {
            vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
                throw new Error("blocked");
            });
            const { result } = renderHook(() => useSidebarCollapsed());
            expect(result.current.collapsed).toBe(false);
            act(() => result.current.toggle());
            expect(result.current.collapsed).toBe(true);
        });
    });

    describe("toggle button and rail", () => {
        it("collapses to an icon-only rail and back, with aria-expanded", async () => {
            await act(async () => {
                render(<Harness />);
            });
            const toggle = screen.getByTestId("sidebar-toggle");
            expect(toggle).toHaveAttribute("aria-expanded", "true");
            expect(toggle).toHaveAccessibleName("Collapse sidebar");
            expect(screen.getByText("Budget Bubby")).toBeInTheDocument();
            expect(screen.getByText("Home")).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(toggle);
            });
            expect(toggle).toHaveAttribute("aria-expanded", "false");
            expect(toggle).toHaveAccessibleName("Expand sidebar");
            expect(screen.queryByText("Budget Bubby")).not.toBeInTheDocument();
            expect(screen.queryByText("Home")).not.toBeInTheDocument();
            expect(document.getElementById("desktop-sidebar")).toHaveAttribute(
                "data-collapsed",
                "true",
            );

            // Nav links keep accessible names; Spend carries the badge count
            expect(screen.getByRole("button", { name: "Home" })).toBeVisible();
            expect(
                screen.getByRole("button", { name: "Spend, 3 to sort" }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("button", { name: "Settings" }),
            ).toBeInTheDocument();
            expect(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY)).toBe(
                "1",
            );

            await act(async () => {
                fireEvent.click(toggle);
            });
            expect(screen.getByText("Budget Bubby")).toBeInTheDocument();
        });

        it("starts collapsed when persisted", async () => {
            window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, "1");
            await act(async () => {
                render(<Harness />);
            });
            expect(screen.getByTestId("sidebar-toggle")).toHaveAttribute(
                "aria-expanded",
                "false",
            );
            expect(screen.queryByText("Budget Bubby")).not.toBeInTheDocument();
        });

        it("hides the toggle when no handler is provided", async () => {
            await act(async () => {
                render(
                    <MemoryRouter>
                        <HouseholdProvider>
                            <SettingsProvider>
                                <AppHeader />
                            </SettingsProvider>
                        </HouseholdProvider>
                    </MemoryRouter>,
                );
            });
            expect(
                screen.queryByTestId("sidebar-toggle"),
            ).not.toBeInTheDocument();
        });
    });
});
