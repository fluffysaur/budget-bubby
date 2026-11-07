/**
 * Responsive Application Header
 * Features:
 * - Unified dropdown perspective switcher (mobile & desktop): Combined + dynamic household members
 * - Aligned horizontal spacing (px-4 sm:px-6)
 * - Connection status: Demo Mock vs Live Supabase
 * - Theme toggle: Light / Dark mode
 */

import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
    Sun,
    Moon,
    Plus,
    ChevronDown,
    Check,
    LogOut,
    Download,
    RotateCw,
    Settings,
} from "lucide-react";
import {
    useHousehold,
    type PerspectiveType,
} from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { mockMembers } from "../../data/mockSeedData";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { IOSInstallModal } from "../pwa/IOSInstallModal";
import { NotificationCenterPopover } from "./NotificationCenterPopover";
import { NotificationSettingsModal } from "./NotificationSettingsModal";
import { Button } from "../ui/Button";
import { BubbyAvatarButton } from "../bubby/BubbyAvatarButton";
import { ConfirmModal } from "../ui/ConfirmModal";

export interface AppHeaderProps {
    className?: string;
    onOpenQuickAdd?: () => void;
    onNavigateTab?: (tab: string) => void;
}

const MEMBER_COLOR_PALETTE = [
    {
        activeBg:
            "bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold",
    },
    {
        activeBg:
            "bg-(--pastel-pink) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold",
    },
    {
        activeBg:
            "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold",
    },
    {
        activeBg:
            "bg-(--pastel-mint) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold",
    },
];

function getPerspectiveKeyForMember(
    displayName: string,
    id: string,
): PerspectiveType {
    const clean = displayName.toLowerCase().replace(/\s+/g, "");
    if (clean.includes("yijia")) return "yijia";
    if (clean.includes("rachel")) return "rachel";
    return id;
}

export function AppHeader({
    className = "",
    onOpenQuickAdd,
    onNavigateTab,
}: AppHeaderProps) {
    const {
        perspective,
        setPerspective,
        members: ctxMembers,
        activeMember,
        theme,
        toggleTheme,
        isMockMode,
        refreshData,
    } = useHousehold();
    const { signOut, isAuthenticated } = useAuth();
    const {
        canInstall,
        isInstalled,
        showIOSModal,
        setShowIOSModal,
        promptInstall,
    } = usePWAInstall();

    const members =
        ctxMembers && ctxMembers.length > 0 ? ctxMembers : mockMembers;

    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isLogoutConfirmOpen, setIsLogoutConfirmOpen] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);

    // Other screens (e.g. the Inbox empty state) can open Settings
    useEffect(() => {
        const open = () => setIsSettingsOpen(true);
        window.addEventListener("openSettings", open);
        return () => window.removeEventListener("openSettings", open);
    }, []);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    const handleManualRefresh = useCallback(async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        const startTime = Date.now();
        try {
            await refreshData();
        } finally {
            // Ensure animation spins for at least 500ms for tactile feedback
            const elapsed = Date.now() - startTime;
            const remaining = Math.max(0, 500 - elapsed);
            setTimeout(() => {
                setIsRefreshing(false);
            }, remaining);
        }
    }, [refreshData, isRefreshing]);

    // Close dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node)
            ) {
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
                activeBg:
                    "bg-(--pastel-lilac) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm font-bold",
            },
        ];

        members.forEach((m, idx) => {
            const palette =
                MEMBER_COLOR_PALETTE[idx % MEMBER_COLOR_PALETTE.length];
            list.push({
                key: getPerspectiveKeyForMember(m.display_name, m.id),
                memberId: m.id,
                label: m.display_name,
                activeBg: palette.activeBg,
            });
        });

        return list;
    }, [members]);

    const currentOption = useMemo(() => {
        if (perspective === "household") return perspectiveOptions[0];
        return (
            perspectiveOptions.find(
                (opt) =>
                    opt.key === perspective ||
                    (activeMember && opt.memberId === activeMember.id),
            ) || perspectiveOptions[0]
        );
    }, [perspective, activeMember, perspectiveOptions]);

    const handleSelectPerspective = (p: PerspectiveType) => {
        setPerspective(p);
        setIsDropdownOpen(false);
    };

    return (
        <header
            className={`sticky top-0 z-40 w-full border-b-2 border-(--border-ink) bg-(--bg-card)/95 backdrop-blur-md transition-colors duration-200 ${className}`}
        >
            <div className="flex h-14 sm:h-16 w-full items-center justify-between px-4 sm:px-6">
                {/* Left: Perspective Switcher (Mobile Dropdown & Desktop Pills) */}
                <div className="flex items-center">
                    {/* Mobile Perspective Dropdown */}
                    <div className="relative sm:hidden" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsDropdownOpen((prev) => !prev)}
                            aria-haspopup="listbox"
                            aria-expanded={isDropdownOpen}
                            aria-label="Select Financial Perspective"
                            className="flex items-center gap-2.5 rounded-xl border-2 border-(--border-ink) bg-(--bg-cream) pl-3.5 pr-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-cute-sm transition-all cursor-pointer"
                        >
                            <span>{currentOption.label}</span>
                            <ChevronDown
                                strokeWidth={2.5}
                                className={`h-4 w-4 text-(--text-muted) transition-transform duration-150 ${
                                    isDropdownOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {isDropdownOpen && (
                            <div
                                role="listbox"
                                aria-label="Financial Perspectives"
                                className="absolute left-0 mt-2 w-52 rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-1.5 shadow-cute-lg transition-all z-50 animate-in fade-in zoom-in-95 duration-100"
                            >
                                <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-(--text-muted)">
                                    Perspectives
                                </div>
                                {perspectiveOptions.map((opt) => {
                                    const isSelected =
                                        currentOption.key === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() =>
                                                handleSelectPerspective(opt.key)
                                            }
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                                isSelected
                                                    ? opt.activeBg
                                                    : "text-(--text-ink) hover:bg-(--bg-cream)"
                                            }`}
                                        >
                                            <span className="truncate">
                                                {opt.label}
                                            </span>
                                            {isSelected && (
                                                <Check className="h-3.5 w-3.5 shrink-0 stroke-3" />
                                            )}
                                        </button>
                                    );
                                })}

                                {/* Mobile Settings & Utilities section */}
                                <div className="mt-2 pt-2 border-t-2 border-(--border-subtle) space-y-1">
                                    <div className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-(--text-muted)">
                                        Settings &amp; Tools
                                    </div>
                                    <button
                                        type="button"
                                        data-testid="mobile-settings-btn"
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            setIsSettingsOpen(true);
                                        }}
                                        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
                                    >
                                        <Settings className="h-4 w-4 text-(--text-ink) dark:text-(--pastel-lilac)" strokeWidth={2.5} />
                                        <span>Settings</span>
                                    </button>

                                    <button
                                        type="button"
                                        data-testid="mobile-refresh-btn"
                                        onClick={() => {
                                            setIsDropdownOpen(false);
                                            handleManualRefresh();
                                        }}
                                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            <RotateCw
                                                strokeWidth={2.5}
                                                className={`h-4 w-4 ${
                                                    isRefreshing
                                                        ? "animate-spin text-purple-700 dark:text-(--pastel-lilac)"
                                                        : "text-(--text-ink) dark:text-(--pastel-lilac)"
                                                }`}
                                            />
                                            <span>Refresh</span>
                                        </div>
                                        {isRefreshing && (
                                            <span className="text-[10px] text-(--text-muted) animate-pulse font-mono-num">
                                                Refreshing...
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            toggleTheme();
                                            setIsDropdownOpen(false);
                                        }}
                                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2">
                                            {theme === "dark" ? (
                                                <Sun className="h-4 w-4 text-(--pastel-butter)" strokeWidth={2.5} />
                                            ) : (
                                                <Moon className="h-4 w-4 text-(--text-ink)" strokeWidth={2.5} />
                                            )}
                                            <span>
                                                {theme === "dark"
                                                    ? "Light Mode"
                                                    : "Dark Mode"}
                                            </span>
                                        </div>
                                    </button>

                                    {!isInstalled && canInstall && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                promptInstall();
                                                setIsDropdownOpen(false);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-emerald-900 dark:text-emerald-300 hover:bg-(--pastel-mint)/30 transition-colors cursor-pointer"
                                        >
                                            <Download className="h-4 w-4" strokeWidth={2.5} />
                                            <span>Install App</span>
                                        </button>
                                    )}

                                    {(!isMockMode || isAuthenticated) && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setIsDropdownOpen(false);
                                                setIsLogoutConfirmOpen(true);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-rose-800 dark:text-rose-300 hover:bg-(--pastel-coral-light) dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                        >
                                            <LogOut className="h-4 w-4" strokeWidth={2.5} />
                                            <span>Sign Out</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop Perspective Switcher Pills */}
                    <nav
                        aria-label="Perspective Switcher"
                        className="hidden sm:flex items-center rounded-2xl bg-(--bg-cream) border-2 border-(--border-subtle) p-1"
                    >
                        {perspectiveOptions.map((opt) => {
                            const isSelected = perspective === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() =>
                                        handleSelectPerspective(opt.key)
                                    }
                                    aria-pressed={isSelected}
                                    aria-label={
                                        opt.label === "Combined"
                                            ? "Combined Household"
                                            : opt.label
                                    }
                                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all sm:text-xs cursor-pointer ${
                                        isSelected
                                            ? opt.activeBg
                                            : "text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-card)/60"
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {opt.label === "Combined" && (
                                        <span className="sr-only">
                                            Household
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: Badges, Quick Add & Desktop Settings */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* Quick Add Button (Desktop trigger) */}
                    {onOpenQuickAdd && (
                        <div className="hidden md:block">
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onOpenQuickAdd}
                                aria-label="Quick Add"
                                className="hidden md:inline-flex"
                                leftIcon={
                                    <Plus className="h-4 w-4" strokeWidth={2.5} />
                                }
                            >
                                Add Expense
                            </Button>
                        </div>
                    )}

                    {/* Connection Status Badge (Only shown in Demo Mode) */}
                    {isMockMode && (
                        <div
                            title="Demo Mode"
                            className="flex items-center gap-1.5 rounded-xl border-2 border-(--border-ink) bg-(--pastel-butter) px-2.5 py-1 text-xs font-bold text-(--text-ink) shadow-cute-sm"
                        >
                            <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse border border-(--border-ink)" />
                            <span className="hidden xs:inline">Demo Mode</span>
                            <span className="xs:hidden">Demo</span>
                        </div>
                    )}

                    {/* Live household Bubby (tap to pet and open the sheet) */}
                    <BubbyAvatarButton />

                    {/* Notification Center Popover */}
                    <NotificationCenterPopover onNavigateTab={onNavigateTab} />
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            <ConfirmModal
                isOpen={isLogoutConfirmOpen}
                onClose={() => setIsLogoutConfirmOpen(false)}
                onConfirm={() => {
                    setIsLogoutConfirmOpen(false);
                    signOut();
                }}
                title="Lock & Sign Out?"
                variant="danger"
                confirmLabel="Sign Out"
                icon={<LogOut className="h-4.5 w-4.5 text-rose-600" strokeWidth={2.5} />}
                maxWidth="max-w-sm"
            >
                <p className="text-sm text-(--text-muted)">
                    You&apos;ll need your PIN to unlock.
                </p>
            </ConfirmModal>

            {/* iOS install modal when prompt triggered from menu */}
            <IOSInstallModal
                isOpen={showIOSModal}
                onClose={() => setShowIOSModal(false)}
            />

            {/* Notification & App Settings Modal */}
            <NotificationSettingsModal
                isOpen={isSettingsOpen}
                onClose={() => setIsSettingsOpen(false)}
            />
        </header>
    );
}

export default AppHeader;
