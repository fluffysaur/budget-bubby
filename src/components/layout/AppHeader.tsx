/**
 * Responsive Application Header
 * Features:
 * - Mobile dropdown perspective switcher: Combined / Yi Jia / Rachel
 * - Desktop pill perspective switcher: Combined / Yi Jia / Rachel
 * - Flush-to-sides top navigation (16px spacing)
 * - Currency indicator: SGD S$
 * - Connection status: Demo Mock vs Live Supabase
 * - Theme toggle: Light / Dark mode
 */

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { Sun, Moon, Users, User, Plus, ChevronDown, Check, LogOut, AlertTriangle } from "lucide-react";
import { useHousehold, type PerspectiveType } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { PWAInstallButton } from "../pwa/PWAInstallButton";
import { NotificationCenterPopover } from "./NotificationCenterPopover";

export interface AppHeaderProps {
    className?: string;
    onOpenQuickAdd?: () => void;
    onNavigateTab?: (tab: string) => void;
}

export function AppHeader({ className = "", onOpenQuickAdd, onNavigateTab }: AppHeaderProps) {
    const { perspective, setPerspective, members, theme, toggleTheme, isMockMode } = useHousehold();
    const { signOut, isAuthenticated } = useAuth();

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close mobile dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false);
            }
        }
        if (isDropdownOpen) {
            document.addEventListener("mousedown", handleClickOutside);
        }
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isDropdownOpen]);

    // Close confirmation modal on ESC
    useEffect(() => {
        if (!isLogoutConfirmOpen) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setIsLogoutConfirmOpen(false);
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isLogoutConfirmOpen]);

    // Find partner display names from members or fallbacks
    const yiJiaMember = members.find((m) => m.display_name.toLowerCase().includes("yi jia"));
    const rachelMember = members.find((m) => m.display_name.toLowerCase().includes("rachel"));

    const yiJiaName = yiJiaMember ? yiJiaMember.display_name : "Yi Jia";
    const rachelName = rachelMember ? rachelMember.display_name : "Rachel";

    const perspectiveConfig: Record<
        PerspectiveType,
        { label: string; icon: typeof Users; color: string; badgeBg: string }
    > = {
        household: {
            label: "Combined",
            icon: Users,
            color: "text-emerald-700 dark:text-emerald-400",
            badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400",
        },
        yijia: {
            label: yiJiaName,
            icon: User,
            color: "text-blue-700 dark:text-blue-400",
            badgeBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-400",
        },
        rachel: {
            label: rachelName,
            icon: User,
            color: "text-rose-700 dark:text-rose-400",
            badgeBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-400",
        },
    };

    const currentConfig = perspectiveConfig[perspective] || perspectiveConfig.household;
    const CurrentIcon = currentConfig.icon;

    const handleSelectPerspective = (p: PerspectiveType) => {
        setPerspective(p);
        setIsDropdownOpen(false);
    };

    return (
        <header
            className={`sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/95 ${className}`}
        >
            <div className="flex h-16 w-full items-center justify-between px-4">
                {/* Left / Center: Perspective Switcher */}
                <div className="flex items-center">
                    {/* Mobile Perspective Dropdown */}
                    <div
                        className="relative sm:hidden"
                        ref={dropdownRef}
                    >
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen((prev) => !prev)}
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                            aria-label="Select Financial Perspective"
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                        >
                            <CurrentIcon className={`h-4 w-4 ${currentConfig.color}`} />
                            <span>{currentConfig.label}</span>
                            <ChevronDown
                                className={`h-3.5 w-3.5 text-slate-400 transition-transform duration-150 ${
                                    isDropdownOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {isDropdownOpen && (
                            <div
                                role="listbox"
                                aria-label="Financial Perspectives"
                                className="absolute left-0 mt-1.5 w-44 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all dark:border-slate-700 dark:bg-slate-800 z-50 animate-in fade-in zoom-in-95 duration-100"
                            >
                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={perspective === "household"}
                                    onClick={() => handleSelectPerspective("household")}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                                        perspective === "household"
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                        <span>Combined</span>
                                    </div>
                                    {perspective === "household" && (
                                        <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={perspective === "yijia"}
                                    onClick={() => handleSelectPerspective("yijia")}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                                        perspective === "yijia"
                                            ? "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                        <span>{yiJiaName}</span>
                                    </div>
                                    {perspective === "yijia" && (
                                        <Check className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                                    )}
                                </button>

                                <button
                                    type="button"
                                    role="option"
                                    aria-selected={perspective === "rachel"}
                                    onClick={() => handleSelectPerspective("rachel")}
                                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${
                                        perspective === "rachel"
                                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <User className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                        <span>{rachelName}</span>
                                    </div>
                                    {perspective === "rachel" && (
                                        <Check className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                                    )}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Desktop Perspective Switcher Pills */}
                    <nav
                        aria-label="Perspective Switcher"
                        className="hidden sm:flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
                    >
                        {/* Combined */}
                        <button
                            type="button"
                            onClick={() => setPerspective("household")}
                            aria-pressed={perspective === "household"}
                            aria-label="Combined Household"
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                                perspective === "household"
                                    ? "bg-white text-emerald-700 shadow-sm dark:bg-slate-700 dark:text-emerald-400"
                                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            }`}
                        >
                            <Users className="h-4 w-4" />
                            <span>Combined</span>
                            <span className="sr-only">Household</span>
                        </button>

                        {/* Yi Jia */}
                        <button
                            type="button"
                            onClick={() => setPerspective("yijia")}
                            aria-pressed={perspective === "yijia"}
                            aria-label={yiJiaName}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                                perspective === "yijia"
                                    ? "bg-white text-blue-700 shadow-sm dark:bg-slate-700 dark:text-blue-400"
                                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            }`}
                        >
                            <User className="h-4 w-4" />
                            <span>{yiJiaName}</span>
                        </button>

                        {/* Rachel */}
                        <button
                            type="button"
                            onClick={() => setPerspective("rachel")}
                            aria-pressed={perspective === "rachel"}
                            aria-label={rachelName}
                            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition-all sm:text-sm ${
                                perspective === "rachel"
                                    ? "bg-white text-rose-700 shadow-sm dark:bg-slate-700 dark:text-rose-400"
                                    : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                            }`}
                        >
                            <User className="h-4 w-4" />
                            <span>{rachelName}</span>
                        </button>
                    </nav>
                </div>

                {/* Right: Badges, Quick Add & Theme Toggle */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Quick Add Button (Desktop optional trigger) */}
                    {onOpenQuickAdd && (
                        <button
                            type="button"
                            onClick={onOpenQuickAdd}
                            aria-label="Quick Add"
                            className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-colors"
                        >
                            <Plus className="h-4 w-4" />
                            <span>Add Expense</span>
                        </button>
                    )}

                    {/* Connection Status Badge (Only shown in Demo Mode) */}
                    {isMockMode && (
                        <div
                            title="Running in local Demo Mode with sample seed data"
                            className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300"
                        >
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                            <span>Demo Mode</span>
                        </div>
                    )}

                    {/* Notification Center Popover */}
                    <NotificationCenterPopover onNavigateTab={onNavigateTab} />

                    {/* PWA Install Button */}
                    <PWAInstallButton />

                    {/* Theme Toggle Button */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Toggle theme (currently ${theme})`}
                        className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-xs transition-all hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white"
                    >
                        {theme === "dark" ? (
                            <Sun className="h-4 w-4 text-amber-400" />
                        ) : (
                            <Moon className="h-4 w-4 text-slate-600" />
                        )}
                    </button>

                    {/* Lock / Sign Out Button */}
                    {(!isMockMode || isAuthenticated) && (
                        <button
                            type="button"
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            aria-label="Lock Budget Bubby"
                            title="Lock / Sign Out"
                            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-xs transition-all hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 focus:outline-none focus:ring-2 focus:ring-rose-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 dark:hover:border-rose-800/40 cursor-pointer"
                        >
                            <LogOut className="h-4 w-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            {isLogoutConfirmOpen &&
                typeof document !== "undefined" &&
                createPortal(
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="logout-title"
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
                        onClick={() => setIsLogoutConfirmOpen(false)}
                    >
                        <div
                            className="w-full max-w-sm rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 shadow-2xl animate-in zoom-in-95 duration-150"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center gap-3 mb-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                                    <AlertTriangle className="h-5 w-5" />
                                </div>
                                <div>
                                    <h3
                                        id="logout-title"
                                        className="text-sm font-bold text-slate-900 dark:text-white"
                                    >
                                        Lock &amp; Sign Out?
                                    </h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400">
                                        You will need your 6-digit PIN to unlock again.
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2.5 mt-5 pt-3 border-t border-slate-100 dark:border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setIsLogoutConfirmOpen(false)}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsLogoutConfirmOpen(false);
                                        signOut();
                                    }}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition-all shadow-md shadow-rose-600/20 cursor-pointer"
                                >
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body,
                )}
        </header>
    );
}

export default AppHeader;
