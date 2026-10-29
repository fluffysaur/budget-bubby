/**
 * BaseProfileEditorModal Component
 * Unified single-scroll modal for editing a household member's budget & household categories:
 * - Member switcher pills (when household has >1 member)
 * - Gross Salary & CPF Employee Rate (e.g. 20%)
 * - Fixed Monthly Deductions (Taxes & Insurance)
 * - Category Percentage Allocations (validated to sum to 100%) with inline Category Add/Edit/Delete & Preset Restore
 */

import { useState, useEffect, useMemo, useRef, useId } from "react";
import {
    CheckCircle2,
    AlertCircle,
    Percent,
    DollarSign,
    ShieldCheck,
    Save,
    RotateCcw,
    Plus,
    Lock,
    Unlock,
    Scale,
    Pencil,
    Trash2,
    Check,
    Utensils,
    Sparkles,
    Car,
    TrendingUp,
    PiggyBank,
    Heart,
    Shield,
    ShoppingBag,
    Coffee,
    Plane,
    Home,
    Wifi,
    Tag,
    Gift,
    User,
    Sliders,
    ArrowUpRight,
} from "lucide-react";
import { financeService } from "../../services/financeService";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { TooltipPopover } from "../ui/TooltipPopover";
import { mockCategories } from "../../data/mockSeedData";
import {
    calculateCPFAndNetPay,
    calculateDisposableBudget,
    calculateMemberPolicyDeductions,
    dollarToPercentage,
    parseAllocationInput,
    isSpendableCategory,
} from "../../lib/financialFormulas";
import { formatSGD } from "../../lib/currency";
import { isValidUuid } from "../../lib/uuid";
import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    Category,
    CategoryGroup,
    HouseholdMember,
    RecurringPolicy,
} from "../../types/finance";

const PRESET_COLORS = [
    "#F59E0B", // Amber
    "#EC4899", // Pink
    "#3B82F6", // Blue
    "#10B981", // Emerald
    "#6366F1", // Indigo
    "#8B5CF6", // Purple
    "#64748B", // Slate
    "#EF4444", // Red
    "#06B6D4", // Cyan
    "#F97316", // Orange
];

const PRESET_ICONS = [
    { id: "utensils", label: "Food", Icon: Utensils },
    { id: "sparkles", label: "Lifestyle", Icon: Sparkles },
    { id: "car", label: "Transport", Icon: Car },
    { id: "shopping-bag", label: "Shopping", Icon: ShoppingBag },
    { id: "coffee", label: "Drinks / Cafe", Icon: Coffee },
    { id: "plane", label: "Travel", Icon: Plane },
    { id: "home", label: "Housing", Icon: Home },
    { id: "wifi", label: "Utilities / Sub", Icon: Wifi },
    { id: "trending-up", label: "Investments", Icon: TrendingUp },
    { id: "piggy-bank", label: "Savings", Icon: PiggyBank },
    { id: "heart", label: "Tithing / Charity", Icon: Heart },
    { id: "shield", label: "Buffer / Insurance", Icon: Shield },
    { id: "gift", label: "Gifts", Icon: Gift },
    { id: "tag", label: "General Tag", Icon: Tag },
];

export interface BaseProfileEditorModalProps {
    isOpen: boolean;
    onClose: () => void;
    profile: BaseBudgetProfile;
    allocations: BaseProfileAllocation[];
    categories?: Category[];
    members?: HouseholdMember[];
    policies?: RecurringPolicy[];
    initialTaxes?: number;
    initialInsurance?: number;
    monthlyBudgetId?: string;
    selectedMonth?: string;
    onSaveSuccess?: () => void;
    onManageCategories?: () => void;
    onCategoriesChanged?: () => void | Promise<void>;
    onSelectMember?: (memberId: string) => void;
    onManagePolicies?: () => void;
    className?: string;
}

export function BaseProfileEditorModal({
    isOpen,
    onClose,
    profile,
    allocations,
    categories = mockCategories,
    members = [],
    policies,
    initialTaxes = 0,
    initialInsurance = 0,
    monthlyBudgetId,
    selectedMonth,
    onSaveSuccess,
    onManageCategories,
    onCategoriesChanged,
    onSelectMember,
    onManagePolicies,
    className = "",
}: BaseProfileEditorModalProps) {
    const titleId = useId();

    // Local categories list synced with prop
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);

    // Form State (stored as strings to allow typing decimals and erasing to empty "")
    const [grossSalary, setGrossSalary] = useState<string>(String(profile?.gross_salary ?? 5000));
    const [cpfRate, setCpfRate] = useState<string>(
        String(profile?.cpf_employee_rate != null ? parseFloat((profile.cpf_employee_rate * 100).toFixed(4)) : 20)
    );

    // Compute effective Monthly Taxes and Insurance strictly derived from policies
    const { effectiveTaxes, effectiveInsurance } = useMemo(() => {
        if (policies !== undefined && policies.length > 0) {
            const { taxesMonthly, insuranceMonthly } = calculateMemberPolicyDeductions(
                policies,
                profile?.owner_id,
            );
            return { effectiveTaxes: taxesMonthly, effectiveInsurance: insuranceMonthly };
        }
        return {
            effectiveTaxes: Number(initialTaxes) || 0,
            effectiveInsurance: Number(initialInsurance) || 0,
        };
    }, [policies, profile?.owner_id, initialTaxes, initialInsurance]);

    // Category percentages mapped by categoryId: string (e.g. "15", "6.9633", "")
    const [categoryPercentages, setCategoryPercentages] = useState<Record<string, string>>({});
    // Explicit dollar amounts when set via $ (e.g. "300") so they stay fixed across disposable pool updates
    const [categoryDollarOverrides, setCategoryDollarOverrides] = useState<Record<string, string>>({});
    // Raw inputs while typing with $ prefix
    const [rawPercentText, setRawPercentText] = useState<Record<string, string>>({});
    // Locked category state for auto-balancing
    const [lockedCategories, setLockedCategories] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Track previous open state and profile owner to prevent unwanted resets while typing
    const prevIsOpenRef = useRef(false);
    const prevProfileIdRef = useRef<string | null>(null);

    // Inline category form state
    const [catFormMode, setCatFormMode] = useState<"create" | "edit" | null>(null);
    const [editingCat, setEditingCat] = useState<Category | null>(null);
    const [catName, setCatName] = useState<string>("");
    const [catGroup, setCatGroup] = useState<CategoryGroup>("spendable");
    const [catColor, setCatColor] = useState<string>(PRESET_COLORS[0]);
    const [catIcon, setCatIcon] = useState<string>("tag");
    const [isCatSaving, setIsCatSaving] = useState<boolean>(false);
    const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

    // Synchronize initial state ONLY when modal opens or when profile/member changes
    useEffect(() => {
        const isJustOpening = isOpen && !prevIsOpenRef.current;
        const isProfileChanged = profile && profile.id !== prevProfileIdRef.current;

        if (isJustOpening || isProfileChanged) {
            setLocalCategories(categories);
            if (profile) {
                setGrossSalary(String(profile.gross_salary));
                setCpfRate(String(parseFloat((profile.cpf_employee_rate * 100).toFixed(4))));
            }

            const pctMap: Record<string, string> = {};
            for (const cat of categories) {
                const existing = allocations.find((a) => a.category_id === cat.id);
                pctMap[cat.id] = existing ? String(parseFloat((existing.target_percentage * 100).toFixed(4))) : "0";
            }
            setCategoryPercentages(pctMap);
            setCategoryDollarOverrides({});
            setRawPercentText({});
            setLockedCategories({});
            setCatFormMode(null);
            setEditingCat(null);
            setDeletingCatId(null);
            setErrorMessage(null);

            prevProfileIdRef.current = profile?.id ?? null;
        }

        prevIsOpenRef.current = isOpen;
    }, [isOpen, profile, allocations, categories]);

    // Live disposable pool calculation based on current form inputs and policy deductions
    const currentDisposablePool = useMemo(() => {
        const gross = Math.max(0, parseFloat(grossSalary) || 0);
        const rate = (parseFloat(cpfRate) || 0) / 100;
        const net = calculateCPFAndNetPay(gross, rate).takeHomePay;
        return calculateDisposableBudget(net, effectiveTaxes, effectiveInsurance);
    }, [grossSalary, cpfRate, effectiveTaxes, effectiveInsurance]);

    // When disposable pool changes, automatically keep fixed dollar categories synchronized
    useEffect(() => {
        if (currentDisposablePool <= 0) return;
        setCategoryPercentages((prev) => {
            let hasChanged = false;
            const updated = { ...prev };
            for (const [catId, dollarStr] of Object.entries(categoryDollarOverrides)) {
                const dollarNum = parseFloat(dollarStr);
                if (!isNaN(dollarNum) && dollarNum > 0) {
                    const nextPct = String(dollarToPercentage(dollarNum, currentDisposablePool));
                    if (updated[catId] !== nextPct) {
                        updated[catId] = nextPct;
                        hasChanged = true;
                    }
                }
            }
            return hasChanged ? updated : prev;
        });
    }, [currentDisposablePool, categoryDollarOverrides]);

    const toggleCategoryLock = (categoryId: string) => {
        setLockedCategories((prev) => ({
            ...prev,
            [categoryId]: !prev[categoryId],
        }));
    };

    const handleAutoBalance = () => {
        const unlockedCats = localCategories.filter((c) => !lockedCategories[c.id]);

        if (unlockedCats.length === 0) {
            setErrorMessage("All categories are locked. Please unlock at least one category to auto-balance.");
            return;
        }

        const lockedSum = localCategories
            .filter((c) => lockedCategories[c.id])
            .reduce((sum, c) => sum + (parseFloat(categoryPercentages[c.id] || "0") || 0), 0);

        const targetUnlockedSum = Math.max(0, Math.round((100 - lockedSum) * 10000) / 10000);
        const currentUnlockedSum = unlockedCats.reduce(
            (sum, c) => sum + (parseFloat(categoryPercentages[c.id] || "0") || 0),
            0
        );

        const updated: Record<string, string> = { ...categoryPercentages };

        if (currentUnlockedSum <= 0) {
            const baseShare = Math.floor((targetUnlockedSum / unlockedCats.length) * 100) / 100;
            let runningSum = 0;

            unlockedCats.forEach((c, idx) => {
                if (idx === unlockedCats.length - 1) {
                    const finalShare = Math.round((targetUnlockedSum - runningSum) * 100) / 100;
                    updated[c.id] = String(finalShare);
                } else {
                    updated[c.id] = String(baseShare);
                    runningSum += baseShare;
                }
                // Clear dollar override on auto-balance for unlocked cats
                setCategoryDollarOverrides((prev) => {
                    const next = { ...prev };
                    delete next[c.id];
                    return next;
                });
            });
        } else {
            let runningAllocated = 0;
            unlockedCats.forEach((c, idx) => {
                if (idx === unlockedCats.length - 1) {
                    const finalShare = Math.round((targetUnlockedSum - runningAllocated) * 100) / 100;
                    updated[c.id] = String(Math.max(0, finalShare));
                } else {
                    const current = parseFloat(categoryPercentages[c.id] || "0") || 0;
                    const proportion = current / currentUnlockedSum;
                    const allocated = Math.round(targetUnlockedSum * proportion * 100) / 100;
                    updated[c.id] = String(allocated);
                    runningAllocated += allocated;
                }
                setCategoryDollarOverrides((prev) => {
                    const next = { ...prev };
                    delete next[c.id];
                    return next;
                });
            });
        }

        setCategoryPercentages(updated);
        setErrorMessage(null);
    };

    // Handle ESC key to close
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                if (catFormMode) {
                    setCatFormMode(null);
                } else if (deletingCatId) {
                    setDeletingCatId(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, catFormMode, deletingCatId, onClose]);

    // Calculate sum of percentages across active localCategories
    const totalPercentage = useMemo(() => {
        const sum = localCategories.reduce((acc, cat) => {
            const raw = categoryPercentages[cat.id];
            const parsed = raw === undefined || raw === "" ? 0 : parseFloat(raw);
            return acc + (isNaN(parsed) ? 0 : parsed);
        }, 0);
        return Math.round(sum * 1000) / 1000;
    }, [localCategories, categoryPercentages]);

    const isValidTotal = Math.abs(totalPercentage - 100) < 0.01;

    // Handle editing directly in S$/mo box
    const handleDollarChange = (categoryId: string, rawDollarVal: string) => {
        setCategoryDollarOverrides((prev) => ({
            ...prev,
            [categoryId]: rawDollarVal,
        }));
        setRawPercentText((prev) => {
            const next = { ...prev };
            delete next[categoryId];
            return next;
        });

        const parsedDollar = parseFloat(rawDollarVal);
        const safeDollar = isNaN(parsedDollar) ? 0 : Math.max(0, parsedDollar);
        const nextPct = dollarToPercentage(safeDollar, currentDisposablePool);

        setCategoryPercentages((prev) => ({
            ...prev,
            [categoryId]: String(nextPct),
        }));

        // Auto-lock category when a dollar target is entered so auto-balance preserves it
        setLockedCategories((prev) => ({
            ...prev,
            [categoryId]: true,
        }));
    };

    // Handle editing in % box (with smart "$" detection)
    const handlePercentageChange = (categoryId: string, rawVal: string, isFocused = false) => {
        const parsed = parseAllocationInput(rawVal, currentDisposablePool);

        if (parsed.isDollar) {
            // Keep raw text while focused with $ so keystrokes aren't hijacked
            if (isFocused) {
                setRawPercentText((prev) => ({ ...prev, [categoryId]: rawVal }));
            } else {
                setRawPercentText((prev) => {
                    const next = { ...prev };
                    delete next[categoryId];
                    return next;
                });
            }

            if (parsed.dollarAmount !== undefined) {
                setCategoryDollarOverrides((prev) => ({
                    ...prev,
                    [categoryId]: String(parsed.dollarAmount),
                }));
            }

            setCategoryPercentages((prev) => ({
                ...prev,
                [categoryId]: String(parsed.percentage),
            }));

            // Auto-lock when dollar amount is specified
            setLockedCategories((prev) => ({
                ...prev,
                [categoryId]: true,
            }));
        } else {
            if (isFocused) {
                setRawPercentText((prev) => ({ ...prev, [categoryId]: rawVal }));
            } else {
                setRawPercentText((prev) => {
                    const next = { ...prev };
                    delete next[categoryId];
                    return next;
                });
            }
            setCategoryDollarOverrides((prev) => {
                const next = { ...prev };
                delete next[categoryId];
                return next;
            });
            setCategoryPercentages((prev) => ({
                ...prev,
                [categoryId]: rawVal,
            }));
        }
    };

    const handlePercentBlur = (categoryId: string) => {
        setRawPercentText((prev) => {
            const next = { ...prev };
            delete next[categoryId];
            return next;
        });
    };

    const handleReset = () => {
        if (profile) {
            setGrossSalary(String(profile.gross_salary));
            setCpfRate(String(parseFloat((profile.cpf_employee_rate * 100).toFixed(4))));
        }
        const pctMap: Record<string, string> = {};
        for (const cat of localCategories) {
            const existing = allocations.find((a) => a.category_id === cat.id);
            pctMap[cat.id] = existing ? String(parseFloat((existing.target_percentage * 100).toFixed(4))) : "0";
        }
        setCategoryPercentages(pctMap);
        setCategoryDollarOverrides({});
        setRawPercentText({});
        setLockedCategories({});
        setErrorMessage(null);
    };

    // Inline category CRUD handlers
    const refreshCategoriesFromService = async () => {
        const refreshed = await financeService.getCategories();
        if (refreshed && refreshed.length > 0) {
            setLocalCategories(refreshed);
            setCategoryPercentages((prev) => {
                const next: Record<string, string> = {};
                for (const c of refreshed) {
                    next[c.id] = prev[c.id] ?? "0";
                }
                return next;
            });
        } else {
            setLocalCategories([]);
        }
        await onCategoriesChanged?.();
    };

    const handleOpenCreateCategory = () => {
        if (onManageCategories && !onCategoriesChanged) {
            onManageCategories();
            return;
        }
        setEditingCat(null);
        setCatName("");
        setCatGroup("spendable");
        setCatColor(PRESET_COLORS[0]);
        setCatIcon("tag");
        setErrorMessage(null);
        setCatFormMode("create");
    };

    const handleOpenEditCategory = (cat: Category) => {
        setEditingCat(cat);
        setCatName(cat.name);
        setCatGroup(cat.group || (isSpendableCategory(cat) ? "spendable" : "allocation"));
        setCatColor(cat.color || PRESET_COLORS[0]);
        setCatIcon(cat.icon || "tag");
        setErrorMessage(null);
        setCatFormMode("edit");
    };

    const handleSaveCategoryInline = async () => {
        if (!catName.trim()) {
            setErrorMessage("Please enter a category name.");
            return;
        }
        try {
            setIsCatSaving(true);
            setErrorMessage(null);
            if (catFormMode === "create") {
                const created = await financeService.addCategory({
                    name: catName.trim(),
                    color: catColor,
                    icon: catIcon,
                    group: catGroup,
                });
                setLocalCategories((prev) => [...prev, created]);
                setCategoryPercentages((prev) => ({ ...prev, [created.id]: "0" }));
            } else if (catFormMode === "edit" && editingCat) {
                await financeService.updateCategory(editingCat.id, {
                    name: catName.trim(),
                    color: catColor,
                    icon: catIcon,
                    group: catGroup,
                });
            }
            setCatFormMode(null);
            setEditingCat(null);
            await refreshCategoriesFromService();
        } catch (err: unknown) {
            console.error("Failed to save category:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to save category.");
        } finally {
            setIsCatSaving(false);
        }
    };

    const handleDeleteCategoryInline = async (catId: string) => {
        try {
            setIsCatSaving(true);
            setErrorMessage(null);
            await financeService.deleteCategory(catId);
            setDeletingCatId(null);
            await refreshCategoriesFromService();
        } catch (err: unknown) {
            console.error("Failed to delete category:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to delete category.");
        } finally {
            setIsCatSaving(false);
        }
    };

    const handleRestorePresetsInline = async () => {
        try {
            setIsCatSaving(true);
            setErrorMessage(null);
            await financeService.seedDefaultCategories();
            await refreshCategoriesFromService();
        } catch (err: unknown) {
            console.error("Failed to restore preset categories:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to restore presets.");
        } finally {
            setIsCatSaving(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isValidTotal) {
            setErrorMessage(`Category allocations must sum to exactly 100% (currently ${totalPercentage}%).`);
            return;
        }

        const parsedGross = parseFloat(grossSalary);
        if (isNaN(parsedGross) || parsedGross <= 0) {
            setErrorMessage("Please enter a valid positive gross salary.");
            return;
        }

        const parsedCpf = (parseFloat(cpfRate) || 0) / 100;
        const parsedTaxes = effectiveTaxes;
        const parsedInsurance = effectiveInsurance;

        try {
            setIsSubmitting(true);
            setErrorMessage(null);

            const updatedProfile: BaseBudgetProfile = {
                ...profile,
                gross_salary: parsedGross,
                cpf_employee_rate: parsedCpf,
                updated_at: new Date().toISOString(),
            };

            const updatedAllocations: BaseProfileAllocation[] = localCategories.map((cat) => {
                const existing = allocations.find((a) => a.category_id === cat.id);
                const targetPct = (parseFloat(categoryPercentages[cat.id] || "0") || 0) / 100;
                let allocId: string;
                if (existing?.id && isValidUuid(existing.id)) {
                    allocId = existing.id;
                } else if (typeof crypto !== "undefined" && crypto.randomUUID) {
                    allocId = crypto.randomUUID();
                } else {
                    allocId = existing ? existing.id : `alloc-${profile.id}-${cat.id}`;
                }
                return {
                    id: allocId,
                    profile_id: profile.id,
                    category_id: cat.id,
                    target_percentage: targetPct,
                };
            });

            await financeService.updateBaseProfile(updatedProfile, updatedAllocations);

            const cpfDeduction = calculateCPFAndNetPay(parsedGross, parsedCpf).cpfDeduction;
            if (monthlyBudgetId && isValidUuid(monthlyBudgetId)) {
                await financeService.updateMonthlyBudget({
                    id: monthlyBudgetId,
                    gross_salary: parsedGross,
                    cpf_deduction: cpfDeduction,
                    taxes_deduction: parsedTaxes,
                    insurance_deduction: parsedInsurance,
                });
            } else if (selectedMonth) {
                try {
                    const monthDetail = await financeService.getMonthlyBudget(selectedMonth, profile.owner_id);
                    if (monthDetail?.budget?.id && isValidUuid(monthDetail.budget.id)) {
                        await financeService.updateMonthlyBudget({
                            id: monthDetail.budget.id,
                            gross_salary: parsedGross,
                            cpf_deduction: cpfDeduction,
                            taxes_deduction: parsedTaxes,
                            insurance_deduction: parsedInsurance,
                        });
                    }
                } catch {
                    // ignore if lookup fails
                }
            }

            onSaveSuccess?.();
            onClose();
        } catch (err: unknown) {
            console.error("Failed to update base profile:", err);
            setErrorMessage(err instanceof Error ? err.message : "Failed to update base profile.");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const profileMember = members?.find((m) => m.id === profile.owner_id);

    return (
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-xl">
            <div
                className={`flex flex-col min-h-0 flex-1 overflow-hidden ${className}`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <ModalHeader
                    id={titleId}
                    title="Edit Budget & Categories"
                    subtitle={profileMember && members.length <= 1 ? profileMember.display_name : undefined}
                    icon={<Sliders className="h-4.5 w-4.5 stroke-[2.5]" />}
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                {/* Member Switcher Bar (when multiple household members exist) */}
                {members.length > 1 && (
                    <div className="flex items-center gap-1.5 p-2 bg-(--bg-canvas) border-b-2 border-(--border-ink) overflow-x-auto shrink-0">
                        {members.map((m) => {
                            const isSelected = m.id === profile.owner_id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => onSelectMember?.(m.id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-(--pastel-butter) text-(--text-ink) border-2 border-(--border-ink) shadow-cute-sm"
                                            : "text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream)"
                                    }`}
                                >
                                    <User className="h-3.5 w-3.5 shrink-0" />
                                    <span>{m.display_name}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Scrollable Form Body */}
                <form
                    onSubmit={handleSubmit}
                    className="flex flex-col min-h-0 flex-1 overflow-hidden"
                >
                    <ModalBody className="p-4 sm:p-5 space-y-5 bg-(--bg-card)">
                        {errorMessage && (
                            <div className="flex items-center gap-3 p-3.5 rounded-xl bg-(--pastel-coral-light) border-2 border-(--border-ink) text-xs font-bold text-(--text-ink) shadow-cute-sm">
                                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        {/* Section 1: Income & CPF */}
                        <div className="space-y-2.5">
                            <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted) flex items-center gap-1.5">
                                <DollarSign className="h-3.5 w-3.5" />
                                Income &amp; CPF
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label
                                        htmlFor="gross-salary-input"
                                        className="block text-xs font-bold text-(--text-ink) mb-1"
                                    >
                                        Gross Salary (SGD)
                                    </label>
                                    <div className="relative">
                                        <span className="absolute left-3 top-2.5 text-xs font-bold text-(--text-muted)">S$</span>
                                        <input
                                            id="gross-salary-input"
                                            type="number"
                                            step="any"
                                            min="0"
                                            required
                                            value={grossSalary}
                                            onChange={(e) => setGrossSalary(e.target.value)}
                                            aria-label="Gross Salary"
                                            className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm focus:outline-hidden focus:ring-2 focus:ring-(--pastel-mint)"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label
                                        htmlFor="cpf-rate-input"
                                        className="block text-xs font-bold text-(--text-ink) mb-1"
                                    >
                                        CPF Employee Rate (%)
                                    </label>
                                    <div className="relative">
                                        <input
                                            id="cpf-rate-input"
                                            type="number"
                                            step="any"
                                            min="0"
                                            max="100"
                                            required
                                            value={cpfRate}
                                            onChange={(e) => setCpfRate(e.target.value)}
                                            aria-label="CPF Employee Rate"
                                            className="w-full pl-3 pr-8 py-2 text-sm font-semibold rounded-xl border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm focus:outline-hidden focus:ring-2 focus:ring-(--pastel-mint)"
                                        />
                                        <span className="absolute right-3 top-2.5 text-xs font-bold text-(--text-muted)">%</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Section 2: Fixed Monthly Deductions (Managed in Policies) */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted) flex items-center gap-1.5">
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    Fixed Monthly Deductions
                                </h3>
                                <button
                                    type="button"
                                    data-testid="manage-policies-link"
                                    onClick={() => {
                                        onClose();
                                        onManagePolicies?.();
                                    }}
                                    className="inline-flex items-center gap-1 text-[11px] font-bold text-(--text-muted) hover:text-(--text-ink) hover:underline transition-colors cursor-pointer"
                                >
                                    <span>Manage in Policies</span>
                                    <ArrowUpRight className="h-3 w-3" />
                                </button>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div
                                    data-testid="readonly-monthly-taxes"
                                    className="rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3 shadow-cute-sm"
                                >
                                    <span className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                                        Monthly Taxes
                                    </span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-base sm:text-lg font-mono-num font-black text-(--text-ink)">
                                            {formatSGD(effectiveTaxes)}
                                        </span>
                                        <span className="text-[11px] font-bold text-(--text-muted)">/mo</span>
                                    </div>
                                    <span className="block text-[10px] text-(--text-muted) mt-1">
                                        From active tax policies
                                    </span>
                                </div>

                                <div
                                    data-testid="readonly-monthly-insurance"
                                    className="rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3 shadow-cute-sm"
                                >
                                    <span className="block text-[11px] font-bold uppercase tracking-wider text-(--text-muted) mb-1">
                                        Monthly Insurance
                                    </span>
                                    <div className="flex items-baseline gap-1">
                                        <span className="text-base sm:text-lg font-mono-num font-black text-(--text-ink)">
                                            {formatSGD(effectiveInsurance)}
                                        </span>
                                        <span className="text-[11px] font-bold text-(--text-muted)">/mo</span>
                                    </div>
                                    <span className="block text-[10px] text-(--text-muted) mt-1">
                                        From active insurance policies
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Categories & Percentage Allocations */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h3 className="text-xs font-bold uppercase tracking-wider text-(--text-muted) flex items-center gap-1.5">
                                        <Percent className="h-3.5 w-3.5 text-(--text-muted)" />
                                        Categories &amp; Allocations
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={handleOpenCreateCategory}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-(--text-ink) bg-(--pastel-mint) hover:bg-(--pastel-mint-dark) border border-(--border-ink) shadow-cute-sm transition-all cursor-pointer"
                                    >
                                        <Plus className="h-3 w-3" />
                                        <span>Add Category</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleRestorePresetsInline}
                                        disabled={isCatSaving}
                                        title="Restore preset categories"
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-(--text-muted) hover:text-(--text-ink) bg-(--bg-card) hover:bg-(--bg-cream) border border-(--border-ink) transition-colors cursor-pointer"
                                    >
                                        <RotateCcw className="h-2.5 w-2.5" />
                                        <span>Presets</span>
                                    </button>
                                </div>

                                <div className="flex items-center gap-2">
                                    {/* Auto-Balance to 100% Button */}
                                    <button
                                        type="button"
                                        onClick={handleAutoBalance}
                                        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold text-(--text-ink) bg-(--pastel-butter) hover:bg-(--pastel-butter-dark) border-2 border-(--border-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer"
                                        title="Proportionally auto-adjust unlocked categories to reach 100%"
                                    >
                                        <Scale className="h-3.5 w-3.5" />
                                        <span>Auto-Balance to 100%</span>
                                    </button>
                                    <TooltipPopover
                                        title="Category Lock"
                                        ariaLabel="Category lock explanation"
                                    >
                                        Locked categories keep their exact amount when you click Auto-Balance.
                                    </TooltipPopover>
                                </div>
                            </div>

                            {/* Inline Add / Edit Category Drawer */}
                            {catFormMode && (
                                <div className="rounded-2xl border-2 border-(--border-ink) bg-(--bg-card) p-3.5 space-y-3 shadow-cute-sm animate-in fade-in duration-150">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-(--text-ink)">
                                            {catFormMode === "create"
                                                ? "New Category"
                                                : `Edit Category: ${editingCat?.name}`}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setCatFormMode(null)}
                                            className="text-xs font-bold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                                        >
                                            Cancel
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                        <div>
                                            <label className="block text-[11px] font-bold text-(--text-muted) mb-1">
                                                Category Name
                                            </label>
                                            <input
                                                type="text"
                                                value={catName}
                                                onChange={(e) => setCatName(e.target.value)}
                                                placeholder="e.g. Groceries, Pet, Gym"
                                                className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border-2 border-(--border-ink) bg-(--bg-canvas) text-(--text-ink) focus:outline-hidden focus:ring-2 focus:ring-(--pastel-mint)"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-bold text-(--text-muted) mb-1">
                                                Group
                                            </label>
                                            <div className="grid grid-cols-2 gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setCatGroup("spendable")}
                                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 border-(--border-ink) transition-all cursor-pointer ${
                                                        catGroup === "spendable"
                                                            ? "bg-(--pastel-mint) text-(--text-ink) shadow-cute-sm"
                                                            : "bg-(--bg-canvas) text-(--text-muted) hover:text-(--text-ink)"
                                                    }`}
                                                >
                                                    Spendable
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setCatGroup("allocation")}
                                                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border-2 border-(--border-ink) transition-all cursor-pointer ${
                                                        catGroup === "allocation"
                                                            ? "bg-(--pastel-lilac) text-(--text-ink) shadow-cute-sm"
                                                            : "bg-(--bg-canvas) text-(--text-muted) hover:text-(--text-ink)"
                                                    }`}
                                                >
                                                    Wealth / Fixed
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Color & Icon Compact Row */}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            {PRESET_COLORS.map((c) => (
                                                <button
                                                    key={c}
                                                    type="button"
                                                    onClick={() => setCatColor(c)}
                                                    className="h-5 w-5 rounded-full border-2 border-(--border-ink) flex items-center justify-center transition-transform cursor-pointer"
                                                    style={{
                                                        backgroundColor: c,
                                                        transform: catColor === c ? "scale(1.15)" : "scale(1)",
                                                    }}
                                                >
                                                    {catColor === c && <Check className="h-3 w-3 text-white stroke-3" />}
                                                </button>
                                            ))}
                                        </div>

                                        <div className="flex items-center gap-1 flex-wrap">
                                            {PRESET_ICONS.slice(0, 8).map((item) => {
                                                const IconComp = item.Icon;
                                                const isSelected = catIcon === item.id;
                                                return (
                                                    <button
                                                        key={item.id}
                                                        type="button"
                                                        onClick={() => setCatIcon(item.id)}
                                                        title={item.label}
                                                        className={`p-1.5 rounded-lg border-2 border-(--border-ink) transition-all cursor-pointer ${
                                                            isSelected
                                                                ? "bg-(--pastel-mint) text-(--text-ink) shadow-cute-sm"
                                                                : "bg-(--bg-canvas) text-(--text-muted) hover:text-(--text-ink)"
                                                        }`}
                                                    >
                                                        <IconComp className="h-3.5 w-3.5" />
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    <div className="flex justify-end gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={handleSaveCategoryInline}
                                            disabled={isCatSaving}
                                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-(--text-ink) bg-(--pastel-mint) hover:bg-(--pastel-mint-dark) border-2 border-(--border-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 cursor-pointer"
                                        >
                                            <Check className="h-3.5 w-3.5" />
                                            <span>{catFormMode === "create" ? "Create Category" : "Update Category"}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-2.5 rounded-2xl border-2 border-(--border-ink) bg-(--bg-canvas) p-3 sm:p-4 shadow-cute-sm">
                                {localCategories.length === 0 ? (
                                    <div className="text-center py-6">
                                        <p className="text-xs text-(--text-muted) mb-2">No categories configured yet.</p>
                                        <button
                                            type="button"
                                            onClick={handleOpenCreateCategory}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-(--text-ink) bg-(--pastel-mint) hover:bg-(--pastel-mint-dark) border-2 border-(--border-ink) shadow-cute-sm cursor-pointer"
                                        >
                                            <Plus className="h-3 w-3" />
                                            <span>Add Categories</span>
                                        </button>
                                    </div>
                                ) : (
                                    localCategories.map((cat) => {
                                        const rawVal = categoryPercentages[cat.id];
                                        const currentPct = rawVal === undefined || rawVal === "" ? 0 : parseFloat(rawVal) || 0;
                                        const isLocked = Boolean(lockedCategories[cat.id]);
                                        const dollarEquivalent =
                                            Math.round(currentDisposablePool * (currentPct / 100) * 100) / 100;
                                        const isDeleting = deletingCatId === cat.id;

                                        return (
                                            <div
                                                key={cat.id}
                                                className="p-3 rounded-xl border-2 border-(--border-ink) bg-(--bg-card) shadow-cute-sm space-y-2"
                                            >
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                        {/* Category Lock Toggle */}
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleCategoryLock(cat.id)}
                                                            title={isLocked ? `Unlock ${cat.name}` : `Lock ${cat.name}`}
                                                            aria-label={isLocked ? "Unlock category" : "Lock category"}
                                                            data-testid={`lock-${cat.id}`}
                                                            className={`p-1.5 rounded-lg border-2 border-(--border-ink) transition-all cursor-pointer shrink-0 ${
                                                                isLocked
                                                                    ? "bg-(--pastel-butter) text-(--text-ink) shadow-cute-sm"
                                                                    : "bg-(--bg-cream) text-(--text-muted) hover:text-(--text-ink)"
                                                            }`}
                                                        >
                                                            {isLocked ? (
                                                                <Lock className="h-3.5 w-3.5" />
                                                            ) : (
                                                                <Unlock className="h-3.5 w-3.5" />
                                                            )}
                                                        </button>

                                                        <span
                                                            className="h-2.5 w-2.5 rounded-full shrink-0 border border-(--border-ink)"
                                                            style={{ backgroundColor: cat.color }}
                                                        />
                                                        <label
                                                            htmlFor={`cat-alloc-${cat.id}`}
                                                            className="text-xs font-black text-(--text-ink) truncate cursor-pointer"
                                                        >
                                                            {cat.name}
                                                        </label>
                                                        {isLocked && (
                                                            <TooltipPopover
                                                                title="Category Lock"
                                                                align="left"
                                                                ariaLabel="Category is locked"
                                                                renderTrigger={(triggerProps) => (
                                                                    <button
                                                                        {...triggerProps}
                                                                        type="button"
                                                                        className="text-[10px] font-bold text-(--text-ink) bg-(--pastel-butter) hover:bg-(--pastel-butter-dark) px-2 py-0.5 rounded-full border border-(--border-ink) shadow-cute-sm cursor-pointer transition-colors"
                                                                    >
                                                                        Locked
                                                                    </button>
                                                                )}
                                                            >
                                                                Locked categories keep their exact amount when you click Auto-Balance.
                                                            </TooltipPopover>
                                                        )}

                                                        {/* Inline Edit / Delete Category Actions */}
                                                        {isDeleting ? (
                                                            <div className="inline-flex items-center gap-1 ml-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleDeleteCategoryInline(cat.id)}
                                                                    disabled={isCatSaving}
                                                                    className="px-2 py-0.5 rounded text-[10px] font-bold bg-(--pastel-coral-light) text-rose-800 border border-(--border-ink) hover:bg-rose-200 cursor-pointer"
                                                                >
                                                                    Delete
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDeletingCatId(null)}
                                                                    className="px-2 py-0.5 rounded text-[10px] font-semibold text-(--text-muted) hover:text-(--text-ink) cursor-pointer"
                                                                >
                                                                    Cancel
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="inline-flex items-center gap-0.5 ml-1">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleOpenEditCategory(cat)}
                                                                    title={`Edit ${cat.name}`}
                                                                    aria-label="Edit category"
                                                                    className="p-1 rounded-md text-(--text-muted) hover:text-(--text-ink) hover:bg-(--bg-cream) transition-colors cursor-pointer"
                                                                >
                                                                    <Pencil className="h-3 w-3" />
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setDeletingCatId(cat.id)}
                                                                    title={`Delete ${cat.name}`}
                                                                    aria-label="Delete category"
                                                                    className="p-1 rounded-md text-(--text-muted) hover:text-rose-600 hover:bg-(--pastel-coral-light) transition-colors cursor-pointer"
                                                                >
                                                                    <Trash2 className="h-3 w-3" />
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Live Dollar Equivalent & Numeric Input */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        {/* Editable Dollar Input */}
                                                        <div
                                                            data-testid={`cat-dollar-${cat.id}`}
                                                            className="flex items-center gap-0.5 rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas) px-1.5 py-0.5 shadow-cute-sm"
                                                        >
                                                            <span className="text-[11px] font-bold text-(--text-muted)">S$</span>
                                                            <input
                                                                id={`cat-dollar-input-${cat.id}`}
                                                                data-testid={`cat-dollar-input-${cat.id}`}
                                                                type="number"
                                                                step="any"
                                                                min="0"
                                                                placeholder="0"
                                                                value={
                                                                    categoryDollarOverrides[cat.id] !== undefined
                                                                        ? categoryDollarOverrides[cat.id]
                                                                        : dollarEquivalent === 0
                                                                        ? "0"
                                                                        : String(dollarEquivalent)
                                                                }
                                                                onChange={(e) => handleDollarChange(cat.id, e.target.value)}
                                                                aria-label="Monthly dollar amount"
                                                                title={`Monthly dollar amount for ${cat.name}`}
                                                                className="w-16 text-right text-xs font-bold font-mono-num bg-transparent text-(--text-ink) outline-hidden"
                                                            />
                                                            <span className="text-[10px] font-bold text-(--text-muted)">/mo</span>
                                                        </div>

                                                        {/* Smart Percentage Input (Supports "$300" or "15%") */}
                                                        <div className="relative w-20">
                                                            <input
                                                                id={`cat-alloc-${cat.id}`}
                                                                type="text"
                                                                inputMode="decimal"
                                                                placeholder="0"
                                                                value={
                                                                    rawPercentText[cat.id] !== undefined
                                                                        ? rawPercentText[cat.id]
                                                                        : categoryPercentages[cat.id] === ""
                                                                        ? ""
                                                                        : categoryPercentages[cat.id] !== undefined
                                                                        ? String(parseFloat(parseFloat(categoryPercentages[cat.id]).toFixed(2)))
                                                                        : "0"
                                                                }
                                                                onChange={(e) =>
                                                                    handlePercentageChange(cat.id, e.target.value, true)
                                                                }
                                                                onBlur={() => handlePercentBlur(cat.id)}
                                                                onKeyDown={(e) => {
                                                                    if (e.key === "Enter") {
                                                                        handlePercentBlur(cat.id);
                                                                    }
                                                                }}
                                                                className="w-full pr-5 pl-2 py-1 text-right text-xs font-bold font-mono-num rounded-lg border-2 border-(--border-ink) bg-(--bg-card) text-(--text-ink) shadow-cute-sm focus:outline-hidden focus:ring-2 focus:ring-(--pastel-mint)"
                                                            />
                                                            <span className="absolute right-1.5 top-1 text-[11px] font-bold text-(--text-muted)">
                                                                %
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Interactive Range Slider */}
                                                <div className="pt-0.5">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        step="0.1"
                                                        aria-label="Allocation slider"
                                                        data-testid={`slider-${cat.id}`}
                                                        value={currentPct}
                                                        onChange={(e) => handlePercentageChange(cat.id, e.target.value)}
                                                        className="w-full h-1.5 bg-(--bg-cream) border border-(--border-ink) rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </ModalBody>

                    {/* Footer Actions with Sticky Total % */}
                    <ModalFooter className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            {/* Sticky Total Percentage Indicator */}
                            <div
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border-2 border-(--border-ink) shadow-cute-sm ${
                                    isValidTotal
                                        ? "bg-(--pastel-mint) text-(--text-ink)"
                                        : "bg-(--pastel-coral-light) text-(--text-ink)"
                                }`}
                            >
                                {isValidTotal ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-700" />
                                ) : (
                                    <AlertCircle className="h-3.5 w-3.5 text-rose-700" />
                                )}
                                <span>Total: {totalPercentage}%</span>
                            </div>

                            <button
                                type="button"
                                onClick={handleReset}
                                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) rounded-lg hover:bg-(--pastel-cream) transition-colors cursor-pointer"
                            >
                                <RotateCcw className="h-3.5 w-3.5" />
                                <span>Reset</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-bold text-(--text-muted) hover:text-(--text-ink) rounded-xl hover:bg-(--pastel-cream) transition-all cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={!isValidTotal || isSubmitting}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-(--text-ink) bg-(--pastel-mint) hover:bg-(--pastel-mint-dark) border-2 border-(--border-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                            >
                                <Save className="h-3.5 w-3.5" />
                                <span>{isSubmitting ? "Saving..." : "Save Budget"}</span>
                            </button>
                        </div>
                    </ModalFooter>
                </form>
            </div>
        </AnimatedModal>
    );
}

export default BaseProfileEditorModal;
