import {
    render,
    screen,
    fireEvent,
    act,
    waitFor,
} from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useEffect, useState } from "react";
import { MemoryRouter, useLocation } from "react-router-dom";
import {
    HouseholdProvider,
    useHousehold,
    type HouseholdContextValue,
} from "../src/context/HouseholdContext";
import { AppHeader } from "../src/components/layout/AppHeader";
import { DesktopSidebar } from "../src/components/layout/DesktopSidebar";
import { MobileBottomNav } from "../src/components/layout/MobileBottomNav";

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
            <button onClick={() => setPerspective("mem-00000000-0011")}>
                Set Alex
            </button>
            <button onClick={() => setPerspective("mem-00000000-0012")}>
                Set Sam
            </button>
            <button onClick={toggleTheme}>Toggle Theme</button>
        </div>
    );
}

function PathProbe() {
    return <span data-testid="probe-path">{useLocation().pathname}</span>;
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
        await waitFor(() => {
            expect(
                Number(screen.getByTestId("members-count").textContent),
            ).toBeGreaterThanOrEqual(2);
        });
    });

    it("updates perspective and resolves activeMember correctly", async () => {
        await act(async () => {
            render(
                <HouseholdProvider>
                    <TestConsumer />
                </HouseholdProvider>,
            );
        });

        // Switch to Alex
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Set Alex" }));
        });
        expect(screen.getByTestId("perspective")).toHaveTextContent(
            "mem-00000000-0011",
        );
        expect(screen.getByTestId("active-member")).toHaveTextContent("Alex");

        // Switch to Sam
        await act(async () => {
            fireEvent.click(screen.getByRole("button", { name: "Set Sam" }));
        });
        expect(screen.getByTestId("perspective")).toHaveTextContent(
            "mem-00000000-0012",
        );
        expect(screen.getByTestId("active-member")).toHaveTextContent("Sam");

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

    it("falls back to the household view for a legacy partner-slot perspective", async () => {
        await act(async () => {
            render(
                <HouseholdProvider initialPerspective="partner1">
                    <TestConsumer />
                </HouseholdProvider>,
            );
        });

        await waitFor(() => {
            expect(screen.getByTestId("perspective")).toHaveTextContent(
                "household",
            );
        });
        expect(screen.getByTestId("active-member")).toHaveTextContent("none");
    });

    it("follows the current member into their own view when asked", async () => {
        await act(async () => {
            render(
                <HouseholdProvider followCurrentMember>
                    <TestConsumer />
                </HouseholdProvider>,
            );
        });

        // Mock mode without a provider: the default demo member is current
        await waitFor(() => {
            expect(screen.getByTestId("active-member")).toHaveTextContent(
                "Alex",
            );
        });

        // Switching away is not undone by the follow
        await act(async () => {
            fireEvent.click(
                screen.getByRole("button", { name: "Set Household" }),
            );
        });
        expect(screen.getByTestId("perspective")).toHaveTextContent(
            "household",
        );
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

    it("memoizes context value to preserve reference equality across re-renders when state has not changed", async () => {
        const contextValues: HouseholdContextValue[] = [];

        function Parent() {
            const [, setTick] = useState(0);
            return (
                <HouseholdProvider>
                    <button
                        data-testid="re-render-parent"
                        onClick={() => setTick((t) => t + 1)}
                    >
                        Re-render
                    </button>
                    <Consumer />
                </HouseholdProvider>
            );
        }

        function Consumer() {
            const val = useHousehold();
            useEffect(() => {
                contextValues.push(val);
            });
            return <div>Consumer: {val.loading ? "loading" : "ready"}</div>;
        }

        await act(async () => {
            render(<Parent />);
        });

        await waitFor(() => {
            expect(screen.getByText("Consumer: ready")).toBeInTheDocument();
        });

        const initialLength = contextValues.length;
        const settledValue = contextValues[initialLength - 1];

        await act(async () => {
            fireEvent.click(screen.getByTestId("re-render-parent"));
        });

        expect(contextValues.length).toBeGreaterThan(initialLength);
        const latestValue = contextValues[contextValues.length - 1];
        expect(latestValue).toBe(settledValue);
    });
});

describe("Layout Components", () => {
    beforeEach(() => {
        localStorage.clear();
        document.documentElement.classList.remove("dark");
    });

    describe("AppHeader", () => {
        it("renders unified perspective dropdown, mock status, and handles perspective selection", async () => {
            await act(async () => {
                render(
                    <MemoryRouter>
                        <HouseholdProvider>
                            <AppHeader />
                        </HouseholdProvider>
                    </MemoryRouter>,
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

            // Header is decluttered: desktop utilities are no longer in the header
            expect(
                screen.queryByRole("button", { name: /^refresh$/i }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: /^settings$/i }),
            ).not.toBeInTheDocument();
            expect(
                screen.queryByRole("button", { name: /toggle theme/i }),
            ).not.toBeInTheDocument();

            // Open perspective dropdown and select Sam
            await act(async () => {
                fireEvent.click(dropdownTrigger);
            });

            expect(
                screen.getByRole("option", { name: /combined/i }),
            ).toBeInTheDocument();
            expect(
                screen.getByRole("option", { name: /alex/i }),
            ).toBeInTheDocument();
            const partnerTwoOption = screen.getByRole("option", {
                name: /sam/i,
            });
            expect(partnerTwoOption).toBeInTheDocument();

            await act(async () => {
                fireEvent.click(partnerTwoOption);
            });

            expect(dropdownTrigger).toHaveTextContent(/sam/i);
        });

        it("hides Add Expense button on mobile viewports via responsive desktop-only classes", async () => {
            const handleOpenQuickAdd = vi.fn();
            await act(async () => {
                render(
                    <MemoryRouter>
                        <HouseholdProvider>
                            <AppHeader
                                onOpenQuickAdd={handleOpenQuickAdd}
                            />
                        </HouseholdProvider>
                    </MemoryRouter>,
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

        it("renders Settings and Refresh in mobile perspective dropdown", async () => {
            await act(async () => {
                render(
                    <MemoryRouter>
                        <PathProbe />
                        <HouseholdProvider>
                            <AppHeader />
                        </HouseholdProvider>
                    </MemoryRouter>,
                );
            });

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

            // Settings opens as a routed page
            expect(screen.getByTestId("probe-path")).toHaveTextContent(
                "/settings",
            );
        });
    });

    describe("DesktopSidebar", () => {
        it("renders all main navigation tabs, utility footer, and handles interactions", async () => {
            let selectedTab = "dashboard";
            const onSelectTab = vi.fn((tab: string) => {
                selectedTab = tab;
            });

            await act(async () => {
                render(
                    <MemoryRouter>
                        <PathProbe />
                        <HouseholdProvider>
                            <DesktopSidebar
                                activeTab={selectedTab}
                                onSelectTab={onSelectTab}
                            />
                        </HouseholdProvider>
                    </MemoryRouter>,
                );
            });

            expect(screen.getByText("Budget Bubby")).toBeInTheDocument();
            expect(screen.getByText("Home")).toBeInTheDocument();
            expect(screen.getByText("Spend")).toBeInTheDocument();
            expect(screen.getByText("Accounts")).toBeInTheDocument();
            expect(screen.getByText("Plan")).toBeInTheDocument();

            // Tab navigation
            await act(async () => {
                fireEvent.click(screen.getByText("Spend"));
            });
            expect(onSelectTab).toHaveBeenCalledWith("spend");

            // Desktop utility footer buttons
            const settingsBtn = screen.getByRole("button", {
                name: /^settings$/i,
            });
            expect(settingsBtn).toBeInTheDocument();
            await act(async () => {
                fireEvent.click(settingsBtn);
            });
            // Settings opens as a routed page, with no header mounted
            expect(screen.getByTestId("probe-path")).toHaveTextContent(
                "/settings",
            );

            const refreshBtn = screen.getByRole("button", {
                name: /^refresh$/i,
            });
            expect(refreshBtn).toBeInTheDocument();

            const themeBtn = screen.getByRole("button", {
                name: /toggle theme/i,
            });
            expect(themeBtn).toBeInTheDocument();
            await act(async () => {
                fireEvent.click(themeBtn);
            });
            expect(document.documentElement.classList.contains("dark")).toBe(
                true,
            );
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
});
