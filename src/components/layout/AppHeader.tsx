/**
 * Responsive Application Header
 * Features:
 * - Unified dropdown perspective switcher (mobile & desktop): Combined + dynamic household members
 * - Aligned horizontal spacing (px-4 sm:px-6)
 * - Connection status: Demo Mock vs Live Supabase
 * - Theme toggle: Light / Dark mode
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { Sun, Moon, Plus, ChevronDown, Check, LogOut, AlertTriangle, Download } from "lucide-react";
import { useHousehold, type PerspectiveType } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { mockMembers } from "../../data/mockSeedData";
import { usePWAInstall } from "../../hooks/usePWAInstall";
import { IOSInstallModal } from "../pwa/IOSInstallModal";
import { PWAInstallButton } from "../pwa/PWAInstallButton";
import { NotificationCenterPopover } from "./NotificationCenterPopover";
import { Button } from "../ui/Button";
import { BubbyIcon } from "../ui/BubbyIcon";
import { AnimatedModal, ModalHeader, ModalFooter } from "../ui/AnimatedModal";

export interface AppHeaderProps {
    className?: string;
    onOpenQuickAdd?: () => void;
    onNavigateTab?: (tab: string) => void;
}

const MEMBER_COLOR_PALETTE = [
    {
        activeBg: "bg-[#ffe999] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) font-bold",
    },
    {
        activeBg: "bg-[#fcbffa] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) font-bold",
    },
    {
        activeBg: "bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) font-bold",
    },
    {
        activeBg: "bg-[#bbf7d0] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) font-bold",
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
    const { canInstall, isInstalled, showIOSModal, setShowIOSModal, promptInstall } = usePWAInstall();

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
                activeBg: "bg-[#dfc2ff] text-[#1a1a1a] border-[1.5px] border-(--border-ink) shadow-(--shadow-cute-sm) font-bold",
            },
        ];

        members.forEach((m, idx) => {
            const palette = MEMBER_COLOR_PALETTE[idx % MEMBER_COLOR_PALETTE.length];
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
                (opt) => opt.key === perspective || (activeMember && opt.memberId === activeMember.id),
            ) || perspectiveOptions[0]
        );
    }, [perspective, activeMember, perspectiveOptions]);

    const handleSelectPerspective = (p: PerspectiveType) => {
        setPerspective(p);
        setIsDropdownOpen(false);
    };

    return (
        <header
            className={`sticky top-0 z-40 w-full border-b-[1.5px] border-(--border-ink) bg-(--bg-card)/95 backdrop-blur-md transition-colors duration-200 ${className}`}
        >
            <div className="flex h-14 sm:h-16 w-full items-center justify-between px-4 sm:px-6">
                {/* Left: Brand Icon (Mobile) + Perspective Switcher (Mobile Dropdown & Desktop Pills) */}
                <div className="flex items-center">
                    <div className="flex md:hidden h-8 w-8 items-center justify-center rounded-xl bg-[#dfc2ff] border-2 border-(--border-ink) shadow-(--shadow-cute-sm) overflow-hidden shrink-0 mr-2.5">
                        <BubbyIcon className="h-6 w-6" />
                    </div>
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
                            className="flex items-center gap-2 rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-cream) px-3 py-1.5 text-xs font-bold text-(--text-ink) shadow-(--shadow-cute-sm) transition-all cursor-pointer"
                        >
                            <span>{currentOption.label}</span>
                            <ChevronDown
                                className={`h-3.5 w-3.5 stroke-[2.5] text-(--text-muted) transition-transform duration-150 ${
                                    isDropdownOpen ? "rotate-180" : ""
                                }`}
                            />
                        </button>

                        {isDropdownOpen && (
                            <div
                                role="listbox"
                                aria-label="Financial Perspectives"
                                className="absolute left-0 mt-2 w-52 rounded-2xl border-[1.5px] border-(--border-ink) bg-(--bg-card) p-1.5 shadow-(--shadow-cute-lg) transition-all z-50 animate-in fade-in zoom-in-95 duration-100"
                            >
                                <div className="px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-(--text-muted)">
                                    Perspectives
                                </div>
                                {perspectiveOptions.map((opt) => {
                                    const isSelected = currentOption.key === opt.key;
                                    return (
                                        <button
                                            key={opt.key}
                                            type="button"
                                            role="option"
                                            aria-selected={isSelected}
                                            onClick={() => handleSelectPerspective(opt.key)}
                                            className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-xs font-bold transition-colors cursor-pointer ${
                                                isSelected
                                                    ? opt.activeBg
                                                    : "text-(--text-ink) hover:bg-(--bg-cream)"
                                            }`}
                                        >
                                            <span className="truncate">{opt.label}</span>
                                            {isSelected && (
                                                <Check className="h-3.5 w-3.5 shrink-0 stroke-3" />
                                            )}
                                        </button>
                                    );
                                })}

                                {/* Mobile Settings & Utilities section */}
                                <div className="mt-2 pt-2 border-t-[1.5px] border-(--border-subtle) space-y-1">
                                    <div className="px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-(--text-muted)">
                                        Settings
                                    </div>
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
                                                <Sun className="h-4 w-4 text-[#ffe999]" />
                                            ) : (
                                                <Moon className="h-4 w-4 text-[#1a1a1a]" />
                                            )}
                                            <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                                        </div>
                                    </button>

                                    {!isInstalled && canInstall && (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                promptInstall();
                                                setIsDropdownOpen(false);
                                            }}
                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#14532d] dark:text-[#86efac] hover:bg-[#bbf7d0]/30 transition-colors cursor-pointer"
                                        >
                                            <Download className="h-4 w-4 stroke-[2.5]" />
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
                                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-[#9a1b1b] dark:text-rose-400 hover:bg-[#fff1ee] dark:hover:bg-[#3d1c1a] transition-colors cursor-pointer"
                                        >
                                            <LogOut className="h-4 w-4 stroke-[2.5]" />
                                            <span>Lock / Sign Out</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Desktop Perspective Switcher Pills */}
                    <nav
                        aria-label="Perspective Switcher"
                        className="hidden sm:flex items-center rounded-2xl bg-(--bg-cream) border-[1.5px] border-(--border-subtle) p-1"
                    >
                        {perspectiveOptions.map((opt) => {
                            const isSelected = perspective === opt.key;
                            return (
                                <button
                                    key={opt.key}
                                    type="button"
                                    onClick={() => handleSelectPerspective(opt.key)}
                                    aria-pressed={isSelected}
                                    aria-label={opt.label === "Combined" ? "Combined Household" : opt.label}
                                    className={`flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all sm:text-xs cursor-pointer ${
                                        isSelected
                                            ? opt.activeBg
                                            : "text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-card)/60"
                                    }`}
                                >
                                    <span>{opt.label}</span>
                                    {opt.label === "Combined" && <span className="sr-only">Household</span>}
                                </button>
                            );
                        })}
                    </nav>
                </div>

                {/* Right: Badges, Quick Add & Desktop Settings */}
                <div className="flex items-center space-x-2 sm:space-x-3">
                    {/* Quick Add Button (Desktop trigger) */}
                    {onOpenQuickAdd && (
                        <Button
                            variant="primary"
                            size="sm"
                            onClick={onOpenQuickAdd}
                            aria-label="Quick Add"
                            className="hidden md:inline-flex"
                            leftIcon={<Plus className="h-4 w-4 stroke-[2.5]" />}
                        >
                            Add Expense
                        </Button>
                    )}

                    {/* Connection Status Badge (Only shown in Demo Mode) */}
                    {isMockMode && (
                        <div
                            title="Running in local Demo Mode with sample seed data"
                            className="flex items-center gap-1.5 rounded-xl border-[1.5px] border-(--border-ink) bg-[#ffe999] px-2.5 py-1 text-xs font-bold text-[#1a1a1a] shadow-(--shadow-cute-sm)"
                        >
                            <span className="h-2 w-2 rounded-full bg-[#f59e0b] animate-pulse border border-[#1a1a1a]" />
                            <span className="hidden xs:inline">Demo Mode</span>
                            <span className="xs:hidden">Demo</span>
                        </div>
                    )}

                    {/* Notification Center Popover */}
                    <NotificationCenterPopover onNavigateTab={onNavigateTab} />

                    {/* PWA Install Button (Desktop) */}
                    <div className="hidden sm:block">
                        <PWAInstallButton />
                    </div>

                    {/* Theme Toggle Button (Desktop) */}
                    <button
                        type="button"
                        onClick={toggleTheme}
                        aria-label={`Toggle theme (currently ${theme})`}
                        className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-(--shadow-cute-sm) transition-all hover:bg-(--bg-cream) active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                    >
                        {theme === "dark" ? (
                            <Sun className="h-4 w-4 text-[#ffe999]" />
                        ) : (
                            <Moon className="h-4 w-4 text-[#1a1a1a]" />
                        )}
                    </button>

                    {/* Lock / Sign Out Button (Desktop) */}
                    {(!isMockMode || isAuthenticated) && (
                        <button
                            type="button"
                            onClick={() => setIsLogoutConfirmOpen(true)}
                            aria-label="Lock Budget Bubby"
                            title="Lock / Sign Out"
                            className="hidden sm:flex h-9 w-9 items-center justify-center rounded-xl border-[1.5px] border-(--border-ink) bg-(--bg-card) text-(--text-muted) shadow-(--shadow-cute-sm) transition-all hover:bg-[#fff1ee] hover:text-[#9a1b1b] active:translate-x-0.5 active:translate-y-0.5 active:shadow-none cursor-pointer"
                        >
                            <LogOut className="h-4 w-4 stroke-[2.5]" />
                        </button>
                    )}
                </div>
            </div>

            {/* Logout Confirmation Modal */}
            <AnimatedModal
                isOpen={isLogoutConfirmOpen}
                onClose={() => setIsLogoutConfirmOpen(false)}
                maxWidth="max-w-sm"
            >
                <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
                    <ModalHeader
                        title="Lock & Sign Out?"
                        subtitle="You will need your 6-digit PIN to unlock again."
                        icon={<AlertTriangle className="h-5 w-5 stroke-[2.5] text-rose-700" />}
                        iconBgColor="bg-rose-100"
                        onClose={() => setIsLogoutConfirmOpen(false)}
                    />
                    <ModalFooter className="justify-end gap-2.5">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsLogoutConfirmOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="danger"
                            size="sm"
                            onClick={() => {
                                setIsLogoutConfirmOpen(false);
                                signOut();
                            }}
                        >
                            Sign Out
                        </Button>
                    </ModalFooter>
                </div>
            </AnimatedModal>

            {/* iOS install modal when prompt triggered from menu */}
            <IOSInstallModal
                isOpen={showIOSModal}
                onClose={() => setShowIOSModal(false)}
            />
        </header>
    );
}

export default AppHeader;
