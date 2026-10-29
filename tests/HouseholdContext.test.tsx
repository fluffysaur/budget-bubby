import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
    HouseholdProvider,
    useHousehold,
} from "../src/context/HouseholdContext";
import { AppHeader } from "../src/components/layout/AppHeader";
import { DesktopSidebar } from "../src/components/layout/DesktopSidebar";
import { MobileBottomNav } from "../src/components/layout/MobileBottomNav";
import { PerspectiveBanner } from "../src/components/layout/PerspectiveBanner";

function TestConsumer() {
    const {
        perspective,
        setPerspective,
        members,
        activeMember,
        theme,
        toggleTheme,
        isMockMode,
        loading,
    } = useHousehold();

    return (
        <div>
            <div data-testid="perspective">{perspective}</div>
            <div data-testid="active-member">
                {activeMember ? activeMember.display_name : "none"}
            </div>
            <div data-testid="members-count">{members.length}</div>
            <div data-testid="theme">{theme}</div>
            <div data-testid="is-mock-mode">{isMockMode ? "mock" : "live"}</div>
            <div data-testid="loading">{loading ? "loading" : "ready"}</div>

            <button onClick={() => setPerspective("household")}>
                Set Household
            </button>
            <button onClick={() => setPerspective("yijia")}>Set Yi Jia</button>
            <button onClick={() => setPerspective("rachel")}>Set Rachel</button>
            <button onClick={toggleTheme}>Toggle Theme</button>
        </div>
    );
}

describe("HouseholdContext", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove("dark");
    });

    it("throws an error if useHousehold is used outside HouseholdProvider", () => {
        const spy = vi.spyOn(console, "error").mockImplementation(() => {});
        expect(() => render(<TestConsumer />)).toThrow(
            "useHousehold must be used within a HouseholdProvider",
        );
        spy.mockRestore();
    });

    it("initializes with household perspective, no active member, and mock mode", async () => {
        await act(async () => {
            render(
                <HouseholdProvider>
                    <TestConsumer />
                </HouseholdProvider>,
            );
        });

        expect(screen.getByTestId("perspective")).toHaveTextContent(
            "household",
        );
        expect(screen.getByTestId("active-member")).toHaveTextContent("none");
        expect(screen.getByTestId("is-mock-mode")).toHaveTextContent("mock");
        expect(
            Number(screen.getByTestId("members-count").textContent),
        ).toBeGreaterThanOrEqual(2);
    });

    it("updates perspective and resolves activeMember correctly", async () => {
        await act(async () => {
            render(
                <HouseholdProvider>
                    <TestConsumer />
                </HouseholdProvider>,
            );
        });

        // Switch to Yi Jia
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Set Yi Jia" }));
        });
        expect(screen.getByTestId("perspective")).toHaveTextContent("yijia");
        expect(screen.getByTestId("active-member")).toHaveTextContent("Yi Jia");

        // Switch to Rachel
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Set Rachel" }));
        });
        expect(screen.getByTestId("perspective")).toHaveTextContent("rachel");
        expect(screen.getByTestId("active-member")).toHaveTextContent("Rachel");

        // Switch back to Household
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Set Household" }),
            );
        });
        expect(screen.getByTestId("perspective")).toHaveTextContent(
            "household",
        );
        expect(screen.getByTestId("active-member")).toHaveTextContent("none");
    });

    it("toggles theme and synchronizes dark class on document element", async () => {
        await act(async () => {
            render(
                <HouseholdProvider>
                    <TestConsumer />
                </HouseholdProvider>,
            );
        });

        expect(screen.getByTestId("theme")).toHaveTextContent("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);

        // Toggle to dark
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Toggle Theme" }),
            );
        });
        expect(screen.getByTestId("theme")).toHaveTextContent("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);

        // Toggle back to light
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Toggle Theme" }),
            );
        });
        expect(screen.getByTestId("theme")).toHaveTextContent("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
    });
});

describe("Layout Components", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove("dark");
    });

    describe("AppHeader", () => {
        it("renders unified perspective dropdown, currency badge, mock status, and theme toggle", async () => {
            await act(async () => {
                render(
                    <HouseholdProvider>
                        <AppHeader />
                    </HouseholdProvider>,
                );
            });

            // Perspective dropdown trigger exists
            const dropdownTrigger = screen.getByRole("button", {
                name: /select financial perspective/i,
            });
            expect(dropdownTrigger).toBeInTheDocument();
            expect(dropdownTrigger).toHaveTextContent(/combined/i);

            // Demo status badge exists
            expect(screen.getByText("Demo Mode")).toBeInTheDocument();

            // Open perspective dropdown and select Rachel
            await act(async () => {
                fireEvent.click(dropdownTrigger);
            });

            expect(
                screen.getByRole("option", { name: /combined/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("option", { name: /yi jia/i }),
            ).toBeInTheDocument();
            const rachelOption = screen.getByRole("option", {
                name: /rachel/i,
            });
            expect(rachelOption).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(rachelOption);
            });

            expect(dropdownTrigger).toHaveTextContent(/rachel/i);

            // Theme toggle button
            const themeBtn = screen.getByRole("button", {
                name: /toggle theme/i,
            });
            await act(async () => {
                fireEvent.click(themeBtn);
            });
            expect(document.documentElement.classList.contains("dark")).toBe(
                true,
            );
        });

        it("hides Add Expense button on mobile viewports via responsive desktop-only classes", async () => {
            const handleOpenQuickAdd = vi.fn();
            await act(async () => {
                render(
                    <HouseholdProvider>
                        <AppHeader onOpenQuickAdd={handleOpenQuickAdd} />
                    </HouseholdProvider>,
                );
            });

            const addExpenseBtn = screen.getByRole("button", {
                name: /quick add/i,
            });
            expect(addExpenseBtn).toBeInTheDocument();
            expect(addExpenseBtn).toHaveClass("hidden");
            expect(addExpenseBtn).toHaveClass("md:inline-flex");

            // Base inline-flex should have been overridden by hidden via twMerge
            const classList = addExpenseBtn.className.split(/\s+/);
            expect(classList).not.toContain("inline-flex");

            // Parent container also enforces hidden below md
            const parent = addExpenseBtn.parentElement;
            expect(parent).toHaveClass("hidden");
            expect(parent).toHaveClass("md:block");
        });

        it("renders Settings and Refresh in mobile perspective dropdown and hides manual refresh icon on mobile", async () => {
            await act(async () => {
                render(
                    <HouseholdProvider>
                        <AppHeader />
                    </HouseholdProvider>,
                );
            });

            // The header refresh button is hidden on mobile screens
            const refreshBtn = screen.getByRole("button", {
                name: /^refresh$/i,
            });
            expect(refreshBtn).toHaveClass("hidden");
            expect(refreshBtn).toHaveClass("sm:flex");

            // Open mobile dropdown
            const dropdownTrigger = screen.getByRole("button", {
                name: /select financial perspective/i,
            });
            await act(async () => {
                fireEvent.click(dropdownTrigger);
            });

            // Settings and Refresh items exist in mobile menu
            const settingsOption = screen.getByTestId("mobile-settings-btn");
            expect(settingsOption).toBeInTheDocument();

            const refreshOption = screen.getByTestId("mobile-refresh-btn");
            expect(refreshOption).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(settingsOption);
            });

            // Settings modal opens
            expect(
                await screen.findByRole("heading", { name: "Settings" }),
            ).toBeInTheDocument();
        });
    });

    describe("DesktopSidebar", () => {
        it("renders all main navigation tabs and handles tab selection", async () => {
            let selectedTab = "dashboard";
            const onSelectTab = vi.fn((tab: string) => {
                selectedTab = tab;
            });

            await act(async () => {
                render(
                    <HouseholdProvider>
                        <DesktopSidebar
                            activeTab={selectedTab}
                            onSelectTab={onSelectTab}
                        />
                    </HouseholdProvider>,
                );
            });

            expect(screen.getByText("Budget Bubby")).toBeInTheDocument();
            expect(screen.getByText("Home")).toBeInTheDocument();
            expect(screen.getByText("Spend")).toBeInTheDocument();
            expect(screen.getByText("Accounts")).toBeInTheDocument();
            expect(screen.getByText("Plan")).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(screen.getByText("Spend"));
            });
            expect(onSelectTab).toHaveBeenCalledWith("spend");
        });
    });

    describe("MobileBottomNav", () => {
        it("renders bottom navigation items and quick add FAB", async () => {
            const onSelectTab = vi.fn();
            const onQuickAdd = vi.fn();

            render(
                <MobileBottomNav
                    activeTab="dashboard"
                    onSelectTab={onSelectTab}
                    onQuickAdd={onQuickAdd}
                />,
            );

            expect(
                screen.getByRole("button", { name: /quick add/i }),
            ).toBeInTheDocument();
            fireEvent.click(screen.getByRole("button", { name: /quick add/i }));
            expect(onQuickAdd).toHaveBeenCalled();

            // Click on Spend tab
            const spendTab = screen.getByRole("button", { name: /spend/i });
            fireEvent.click(spendTab);
            expect(onSelectTab).toHaveBeenCalledWith("spend");
        });
    });

    describe("PerspectiveBanner", () => {
        it("displays context banner for household and personal perspectives", async () => {
            let renderResult: any;
            await act(async () => {
                renderResult = render(
                    <HouseholdProvider>
                        <PerspectiveBanner />
                    </HouseholdProvider>,
                );
            });

            // Default is household
            expect(screen.getByText("Combined")).toBeInTheDocument();
            expect(screen.getByText(/Yi Jia & Rachel/i)).toBeInTheDocument();

            // Switch to Yi Jia via header/context
            await act(async () => {
                renderResult.rerender(
                    <HouseholdProvider initialPerspective="yijia">
                        <PerspectiveBanner />
                    </HouseholdProvider>,
                );
            });

            expect(screen.getByText(/Yi Jia/i)).toBeInTheDocument();
            expect(
                screen.getByText(/Personal Perspective/i),
            ).toBeInTheDocument();
        });
    });
});
