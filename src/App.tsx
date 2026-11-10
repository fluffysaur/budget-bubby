/**
 * Budget Bubby - Main Application Shell & Routing Hub
 * Coordinates:
 * - Desktop sidebar and mobile bottom navigation
 * - Top header with perspective switcher, currency badge & theme toggle
 * - Perspective context banner
 * - Central route matching for Dashboard, Budget, Expenses, Accounts, Goals, Loans, Recurring, Fast Log
 * - Global Quick Add Expense modal
 */

import {
    useState,
    useEffect,
    useCallback,
    useMemo,
    useRef,
    lazy,
    Suspense,
} from "react";
import {
    BrowserRouter,
    MemoryRouter,
    Routes,
    Route,
    Navigate,
    useLocation,
    useNavigate,
    useNavigationType,
} from "react-router-dom";
import { LazyMotion, domAnimation, MotionConfig, m } from "motion/react";
import { fadeRise } from "./lib/motion";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import {
    HouseholdProvider,
    useHousehold,
    useOptionalHousehold,
} from "./context/HouseholdContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { PinLoginScreen } from "./components/auth/PinLoginScreen";
import { isSupabaseConfigured } from "./services/supabaseClient";
import {
    useCategoriesQuery,
    useInvalidateFinance,
} from "./hooks/useFinanceQueries";
import { DesktopSidebar } from "./components/layout/DesktopSidebar";
import { AppHeader } from "./components/layout/AppHeader";
import { MobileBottomNav } from "./components/layout/MobileBottomNav";
import {
    ExpenseFormModal,
    type ExpenseFormInitialValues,
} from "./components/expenses/ExpenseFormModal";
import { useQuickAddDeepLink } from "./hooks/useQuickAddDeepLink";
import { useInboxBadge } from "./hooks/useInboxBadge";
import { ExpenseSuccessCelebration } from "./components/expenses/ExpenseSuccessCelebration";
import { OfflineBanner } from "./components/pwa/OfflineBanner";
import { PWAUpdateToast } from "./components/pwa/PWAUpdateToast";
import { PullToRefresh } from "./components/ui/PullToRefresh";
import { DelightHost } from "./components/bubby/DelightHost";
import { BubbyLoadingScreen } from "./components/bubby/BubbyLoadingScreen";
import { emitAppEvent } from "./lib/appEvents";
import type { Expense } from "./types/finance";

// Route-level code-splitting for fast initial boot (<50ms first paint)
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const SpendPage = lazy(() => import("./pages/SpendPage"));
const AccountsPage = lazy(() => import("./pages/AccountsPage"));
const PlanPage = lazy(() => import("./pages/PlanPage"));
const FastLogPage = lazy(() => import("./pages/FastLogPage"));
const InboxPage = lazy(() => import("./pages/InboxPage"));

/**
 * Minimal Header-Only Skeleton Loader displayed during route transition / lazy bundle resolution
 * Delayed by 150ms to prevent skeleton flashes during quick cached navigations.
 */
export function RouteSkeletonLoader() {
    const [show, setShow] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setShow(true), 150);
        return () => clearTimeout(t);
    }, []);

    return (
        <div
            role="status"
            aria-label="Loading page content"
            data-testid="route-skeleton-loader"
            className="w-full h-12 flex items-center justify-between py-2"
        >
            {show && (
                <div
                    data-testid="route-skeleton-bars"
                    className="w-full flex items-center justify-between"
                >
                    <div className="h-8 bg-(--border-subtle)/60 dark:bg-slate-800 rounded-xl w-36 motion-safe:animate-pulse" />
                    <div className="h-8 bg-(--border-subtle)/60 dark:bg-slate-800 rounded-xl w-24 motion-safe:animate-pulse" />
                </div>
            )}
        </div>
    );
}

function AppLayoutInner() {
    const location = useLocation();
    const navigate = useNavigate();
    const navType = useNavigationType();
    const { refreshData, members } = useHousehold();
    const scrollPositions = useRef<Map<string, number>>(new Map());

    // Track main scroller position
    useEffect(() => {
        const main = document.querySelector("main");
        if (!main) return;
        const handleScroll = () => {
            scrollPositions.current.set(location.pathname, main.scrollTop);
        };
        main.addEventListener("scroll", handleScroll, { passive: true });
        return () => main.removeEventListener("scroll", handleScroll);
    }, [location.pathname]);

    // Restore scroll position on POP or scroll to top on PUSH; focus page h1
    useEffect(() => {
        const main = document.querySelector("main");
        if (main) {
            if (navType === "POP") {
                const saved =
                    scrollPositions.current.get(location.pathname) ?? 0;
                main.scrollTop = saved;
                // In case transition animation or lazy-load sizes the container in the next frame
                requestAnimationFrame(() => {
                    main.scrollTop = saved;
                });
            } else {
                main.scrollTop = 0;
            }
        }
        const h1 = document.querySelector("h1");
        if (h1) {
            h1.setAttribute("tabIndex", "-1");
            h1.focus({ preventScroll: true });
        }
    }, [location.pathname, navType]);

    // Preload lazy page chunks after first paint (browser idle only; skip during test runs)
    useEffect(() => {
        if (typeof window === "undefined" || import.meta.env.MODE === "test")
            return;
        const preload = () => {
            import("./pages/DashboardPage");
            import("./pages/SpendPage");
            import("./pages/AccountsPage");
            import("./pages/PlanPage");
            import("./pages/FastLogPage");
            import("./pages/InboxPage");
        };
        if ("requestIdleCallback" in window) {
            const handle = (
                window as unknown as {
                    requestIdleCallback: (cb: () => void) => number;
                }
            ).requestIdleCallback(preload);
            return () => {
                if ("cancelIdleCallback" in window) {
                    (
                        window as unknown as {
                            cancelIdleCallback: (id: number) => void;
                        }
                    ).cancelIdleCallback(handle);
                }
            };
        } else {
            const timer = setTimeout(preload, 1000);
            return () => clearTimeout(timer);
        }
    }, []);

    const [isQuickAddOpen, setIsQuickAddOpen] = useState<boolean>(false);
    const [quickAddValues, setQuickAddValues] = useState<
        ExpenseFormInitialValues | undefined
    >(undefined);
    const { data: categoriesData } = useCategoriesQuery();
    const categories = categoriesData || [];

    // Extract active tab id from route path
    const activeTab = useMemo(() => {
        const segment = location.pathname.replace(/^\//, "").split("/")[0];
        if (!segment || segment === "dashboard") return "dashboard";
        if (["goals", "loans", "recurring"].includes(segment)) return "plan";
        if (["spend", "expenses", "budget", "inbox"].includes(segment))
            return "spend";
        return segment;
    }, [location.pathname]);

    // Switching tabs: the header penguins waddle along (not on first load)
    const lastTab = useRef(activeTab);
    useEffect(() => {
        if (lastTab.current === activeTab) return;
        lastTab.current = activeTab;
        emitAppEvent("bubby:react", { kind: "waddle" });
    }, [activeTab]);

    const handleSelectTab = useCallback(
        (tabId: string) => {
            if (tabId === "dashboard") {
                navigate("/");
            } else if (tabId === "budget") {
                navigate("/spend?tab=budget");
            } else if (tabId === "expenses") {
                navigate("/spend?tab=expenses");
            } else {
                navigate(`/${tabId}`);
            }
        },
        [navigate],
    );

    const handleOpenQuickAdd = useCallback(() => {
        setQuickAddValues(undefined);
        setIsQuickAddOpen(true);
    }, []);

    const openQuickAddWithValues = useCallback(
        (initialValues?: ExpenseFormInitialValues) => {
            setQuickAddValues(initialValues);
            setIsQuickAddOpen(true);
        },
        [],
    );

    const handleCloseQuickAdd = useCallback(() => {
        setIsQuickAddOpen(false);
        setQuickAddValues(undefined);
    }, []);

    // /expenses?action=new&amount=…&merchant=… (PWA shortcut, capture fallback)
    useQuickAddDeepLink(openQuickAddWithValues);

    // Inbox count for the Spend badges and the app icon badge
    const inboxCount = useInboxBadge();
    const { invalidateExpenses } = useInvalidateFinance();

    const handleExpenseAdded = useCallback(
        (_newExpense: Expense) => {
            invalidateExpenses();
        },
        [invalidateExpenses],
    );

    // Keyboard shortcut: Press 'c' to open Quick Add modal (when not focused in inputs)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const activeTag = document.activeElement?.tagName.toLowerCase();
            if (
                activeTag === "input" ||
                activeTag === "textarea" ||
                activeTag === "select" ||
                (document.activeElement as HTMLElement)?.isContentEditable
            ) {
                return;
            }

            if (e.key === "c" || e.key === "C") {
                if (!e.metaKey && !e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    setQuickAddValues(undefined);
                    setIsQuickAddOpen((prev) => !prev);
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    // Allow other pages to open Quick Add via custom event
    useEffect(() => {
        const handleGlobalOpen = (e: Event) => {
            const detail = (
                e as CustomEvent<ExpenseFormInitialValues | undefined>
            ).detail;
            setQuickAddValues(
                detail && typeof detail === "object" ? detail : undefined,
            );
            setIsQuickAddOpen(true);
        };
        window.addEventListener("openQuickAdd", handleGlobalOpen);
        return () =>
            window.removeEventListener("openQuickAdd", handleGlobalOpen);
    }, []);

    return (
        <div className="flex h-dvh bg-(--bg-canvas) text-(--text-ink) overflow-hidden font-sans">
            {/* Desktop Navigation Sidebar */}
            <DesktopSidebar
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                spendBadgeCount={inboxCount}
            />

            {/* Main Application Column */}
            <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
                {/* Offline Status Connectivity Banner */}
                <OfflineBanner />

                {/* Responsive Header */}
                <AppHeader
                    onOpenQuickAdd={handleOpenQuickAdd}
                    onNavigateTab={handleSelectTab}
                />

                {/* Scrollable Viewport / Route Container with Mobile Swipe-Down-To-Refresh */}
                <PullToRefresh
                    as="main"
                    onRefresh={refreshData}
                    className="px-4 sm:px-6 py-6 pb-24 md:pb-10 [scrollbar-gutter:stable]"
                >
                    <div className="mx-auto w-full max-w-5xl">
                        <Suspense fallback={<RouteSkeletonLoader />}>
                            <m.div
                                key={location.pathname}
                                initial={fadeRise.initial}
                                animate={fadeRise.animate}
                                transition={fadeRise.transition}
                                className="w-full"
                            >
                                <Routes>
                                    <Route
                                        path="/"
                                        element={
                                            <DashboardPage
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/dashboard"
                                        element={
                                            <DashboardPage
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/spend"
                                        element={
                                            <SpendPage
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/budget"
                                        element={
                                            <SpendPage
                                                initialTab="budget"
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/expenses"
                                        element={
                                            <SpendPage
                                                initialTab="expenses"
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/fast-log"
                                        element={
                                            <FastLogPage
                                                onOpenQuickAdd={
                                                    handleOpenQuickAdd
                                                }
                                            />
                                        }
                                    />
                                    <Route
                                        path="/inbox"
                                        element={<InboxPage />}
                                    />
                                    <Route
                                        path="/accounts"
                                        element={<AccountsPage />}
                                    />
                                    <Route
                                        path="/goals"
                                        element={
                                            <PlanPage
                                                initialTab="goals"
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/loans"
                                        element={
                                            <PlanPage
                                                initialTab="loans"
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/recurring"
                                        element={
                                            <PlanPage
                                                initialTab="recurring"
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="/plan"
                                        element={
                                            <PlanPage
                                                onNavigateTab={handleSelectTab}
                                            />
                                        }
                                    />
                                    <Route
                                        path="*"
                                        element={<Navigate to="/" replace />}
                                    />
                                </Routes>
                            </m.div>
                        </Suspense>
                    </div>
                </PullToRefresh>
            </div>

            {/* Mobile Fixed Bottom Navigation */}
            <MobileBottomNav
                activeTab={activeTab}
                onSelectTab={handleSelectTab}
                onQuickAdd={handleOpenQuickAdd}
                spendBadgeCount={inboxCount}
            />

            {/* Global Quick Add Expense Modal */}
            <ExpenseFormModal
                isOpen={isQuickAddOpen}
                onClose={handleCloseQuickAdd}
                initialValues={quickAddValues}
                onExpenseAdded={handleExpenseAdded}
                categories={categories}
                members={members}
            />

            {/* Fun Celebratory Feedback on adding expense */}
            <ExpenseSuccessCelebration />

            {/* Bubby reactions, honest check-ins, milestones and the Bubby sheet */}
            <DelightHost />

            {/* PWA Update & Offline Ready Toast */}
            <PWAUpdateToast />
        </div>
    );
}

/**
 * AppShell provides layout content, wrapping with HouseholdProvider if not already present.
 * Shows PinLoginScreen if Supabase is configured and user is not authenticated.
 */
export function AppShell() {
    const { isAuthenticated, authLoading, loggedInPartner } = useAuth();
    const optionalContext = useOptionalHousehold();

    // If live Supabase is configured and we are still verifying the session
    if (isSupabaseConfigured() && authLoading) {
        return <BubbyLoadingScreen />;
    }

    // If live Supabase is configured and user is not authenticated, show PIN Lock Screen
    if (isSupabaseConfigured() && !isAuthenticated) {
        return <PinLoginScreen />;
    }

    const defaultPerspective = loggedInPartner || "household";

    if (!optionalContext) {
        return (
            <HouseholdProvider defaultPerspective={defaultPerspective}>
                <SettingsProvider>
                    <AppLayoutInner />
                </SettingsProvider>
            </HouseholdProvider>
        );
    }
    return (
        <SettingsProvider>
            <AppLayoutInner />
        </SettingsProvider>
    );
}

export interface AppProps {
    initialEntries?: string[];
    initialAuthenticated?: boolean;
}

/**
 * Root App component.
 * Uses MemoryRouter when initialEntries is provided (ideal for testing),
 * otherwise defaults to BrowserRouter for production web apps.
 */
export function App({ initialEntries, initialAuthenticated }: AppProps = {}) {
    const RouterComponent = initialEntries ? MemoryRouter : BrowserRouter;
    const routerProps = initialEntries ? { initialEntries } : {};

    return (
        <LazyMotion features={domAnimation} strict>
            <MotionConfig reducedMotion="user">
                <QueryClientProvider client={queryClient}>
                    <AuthProvider initialAuthenticated={initialAuthenticated}>
                        <RouterComponent {...routerProps}>
                            <AppShell />
                        </RouterComponent>
                    </AuthProvider>
                </QueryClientProvider>
            </MotionConfig>
        </LazyMotion>
    );
}

export default App;
