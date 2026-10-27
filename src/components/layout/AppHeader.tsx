/**
 * Responsive Application Header
 * Features:
 * - Unified dropdown perspective switcher (mobile & desktop): Combined + dynamic household members
 * - Aligned horizontal spacing (px-4 sm:px-6)
 * - Connection status: Demo Mock vs Live Supabase
 * - Theme toggle: Light / Dark mode
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { Sun, Moon, Users, User, Plus, ChevronDown, Check, LogOut, AlertTriangle } from "lucide-react";
import { useHousehold, type PerspectiveType } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { mockMembers } from "../../data/mockSeedData";
import { PWAInstallButton } from "../pwa/PWAInstallButton";
import { NotificationCenterPopover } from "./NotificationCenterPopover";

export interface AppHeaderProps {
    className?: string;
    onOpenQuickAdd?: () => void;
    onNavigateTab?: (tab: string) => void;
}

const MEMBER_COLOR_PALETTE = [
    {
        iconColor: "text-blue-600 dark:text-blue-400",
        activeBg: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    },
    {
        iconColor: "text-rose-600 dark:text-rose-400",
        activeBg: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    },
    {
        iconColor: "text-purple-600 dark:text-purple-400",
        activeBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    },
    {
        iconColor: "text-amber-600 dark:text-amber-400",
        activeBg: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    },
    {
        iconColor: "text-teal-600 dark:text-teal-400",
        activeBg: "bg-teal-50 text-teal-700 dark:bg-teal-950/60 dark:text-teal-300",
    },
];

function getPerspectiveKeyForMember(displayName: string, id: string): PerspectiveType {
    const clean = displayName.toLowerCase().replace(/\s+/g, "");
    if (clean.includes("yijia")) return "yijia";
    if (clean.includes("rachel")) return "rachel";
    return id;
}

export function AppHeader({ className = "", onOpenQuickAdd, onNavigateTab }: AppHeaderProps) {
    const {
        perspective,
        setPerspective,
        members: ctxMembers,
        activeMember,
        theme,
        toggleTheme,
        isMockMode,
    } = useHousehold();
    const { signOut, isAuthenticated } = useAuth();

    const members = ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close dropdown when clicking outside
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

    const perspectiveOptions = useMemo(() => {
        const list = [
            {
                key: "household" as PerspectiveType,
                memberId: null as string | null,
                label: "Combined",
                icon: Users,
                iconColor: "text-emerald-600 dark:text-emerald-400",
                activeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
            },
        ];

        members.forEach((m, idx) => {
            const palette = MEMBER_COLOR_PALETTE[idx % MEMBER_COLOR_PALETTE.length];
            list.push({
                key: getPerspectiveKeyForMember(m.display_name, m.id),
                memberId: m.id,
                label: m.display_name,
                icon: User,
                iconColor: palette.iconColor,
                activeBg: palette.activeBg,
            });
        });

        return list;
    }, [members]);

    const currentOption = useMemo(() => {
        if (perspective === "household") return perspectiveOptions[0];
        return (
            perspectiveOptions.find(
                (opt) => opt.key === perspective || (activeMember && opt.memberId === activeMember.id),
            ) || perspectiveOptions[0]
        );
    }, [perspective, activeMember, perspectiveOptions]);

    const CurrentIcon = currentOption.icon;

    const handleSelectPerspective = (p: PerspectiveType) => {
        setPerspective(p);
        setIsDropdownOpen(false);
    };

    return (
        <header
            className={`sticky top-0 z-40 w-full border-b border-slate-200 bg-white/95 backdrop-blur-md transition-colors duration-200 dark:border-slate-800 dark:bg-slate-900/95 ${className}`}
        >
            <div className="flex h-14 sm:h-16 w-full items-center justify-between px-4 sm:px-6">
                {/* Left: Perspective Switcher (Mobile Dropdown & Desktop Pills) */}
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
                            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 shadow-xs transition-all hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 cursor-pointer"
                        >
                            <CurrentIcon className={`h-4 w-4 ${currentOption.iconColor}`} />
                            <span>{currentOption.label}</span>
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
                                className="absolute left-0 mt-1.5 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl transition-all dark:border-slate-700 dark:bg-slate-800 z-50 animate-in fade-in zoom-in-95 duration-100"
                            >
                                {perspectiveOptions.map((opt) => {
                                    const Icon = opt.icon;
                                    const isSelected = currentOption.key === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => handleSelectPerspective(opt.key)}
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-semibold transition-colors cursor-pointer ${
                                                isSelected
                                                    ? opt.activeBg
                                                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-700/60"
                                            }`}
                                        >
                                            <div className="flex items-center gap-2 min-w-0">
                                                <Icon className={`h-4 w-4 shrink-0 ${opt.iconColor}`} />
                                                <span className="truncate">{opt.label}</span>
                                            </div>
                                            {isSelected && (
                                                <Check className={`h-3.5 w-3.5 shrink-0 ${opt.iconColor}`} />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Desktop Perspective Switcher Pills */}
                    <nav
                        aria-label="Perspective Switcher"
                        className="hidden sm:flex items-center rounded-xl bg-slate-100 p-1 dark:bg-slate-800"
                    >
                        {perspectiveOptions.map((opt) => {
                            const Icon = opt.icon;
                            const isSelected = perspective === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => handleSelectPerspective(opt.key)}
                                    aria-pressed={isSelected}
                                    aria-label={opt.label === "Combined" ? "Combined Household" : opt.label}
                                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-semibold transition-all sm:text-sm cursor-pointer ${
                                        isSelected
                                            ? "bg-white text-slate-900 shadow-xs dark:bg-slate-700 dark:text-white"
                                            : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200"
                                    }`}
                                >
                                    <Icon className={`h-4 w-4 ${opt.iconColor}`} />
                                    <span>{opt.label}</span>
                                    {opt.label === "Combined" && <span className="sr-only">Household</span>}
                                </button>
                            );
                        })}
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
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150 overflow-hidden"
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
