/**
 * BaseProfileEditorModal Component
 * Unified single-scroll modal for editing a household member's budget & household categories:
 * - Member switcher pills (when household has >1 member)
 * - Gross Salary & CPF Employee Rate (e.g. 20%)
 * - Fixed Monthly Deductions (Taxes & Insurance)
 * - Category Percentage Allocations (validated to sum to 100%) with inline Category Add/Edit/Delete & Preset Restore
 */

import { useState, useEffect, useMemo, useId } from "react";
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
} from "lucide-react";
import { Sliders } from "lucide-react";
import { financeService } from "../../services/financeService";
import { AnimatedModal, ModalHeader, ModalBody, ModalFooter } from "../ui/AnimatedModal";
import { mockCategories } from "../../data/mockSeedData";
import { calculateCPFAndNetPay, calculateDisposableBudget, isSpendableCategory } from "../../lib/financialFormulas";
import { formatSGD } from "../../lib/currency";
import { isValidUuid } from "../../lib/uuid";
import type {
    BaseBudgetProfile,
    BaseProfileAllocation,
    Category,
    CategoryGroup,
    HouseholdMember,
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
    initialTaxes?: number;
    initialInsurance?: number;
    monthlyBudgetId?: string;
    selectedMonth?: string;
    onSaveSuccess?: () => void;
    onManageCategories?: () => void;
    onCategoriesChanged?: () => void | Promise<void>;
    onSelectMember?: (memberId: string) => void;
    className?: string;
}

export function BaseProfileEditorModal({
    isOpen,
    onClose,
    profile,
    allocations,
    categories = mockCategories,
    members = [],
    initialTaxes = 0,
    initialInsurance = 0,
    monthlyBudgetId,
    selectedMonth,
    onSaveSuccess,
    onManageCategories,
    onCategoriesChanged,
    onSelectMember,
    className = "",
}: BaseProfileEditorModalProps) {
    const titleId = useId();

    // Local categories list synced with prop so inline add/edit/delete updates immediately
    const [localCategories, setLocalCategories] = useState<Category[]>(categories);
    useEffect(() => {
        setLocalCategories(categories);
    }, [categories]);

    // Form State
    const [grossSalary, setGrossSalary] = useState<string>(String(profile?.gross_salary ?? 5000));
    const [cpfRate, setCpfRate] = useState<string>(String(Math.round((profile?.cpf_employee_rate ?? 0.2) * 100)));
    const [taxes, setTaxes] = useState<string>(String(initialTaxes));
    const [insurance, setInsurance] = useState<string>(String(initialInsurance));

    // Category percentages mapped by categoryId: number (0-100)
    const [categoryPercentages, setCategoryPercentages] = useState<Record<string, number>>({});
    // Locked category state for auto-balancing
    const [lockedCategories, setLockedCategories] = useState<Record<string, boolean>>({});
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Inline category form state
    const [catFormMode, setCatFormMode] = useState<"create" | "edit" | null>(null);
    const [editingCat, setEditingCat] = useState<Category | null>(null);
    const [catName, setCatName] = useState<string>("");
    const [catGroup, setCatGroup] = useState<CategoryGroup>("spendable");
    const [catColor, setCatColor] = useState<string>(PRESET_COLORS[0]);
    const [catIcon, setCatIcon] = useState<string>("tag");
    const [isCatSaving, setIsCatSaving] = useState<boolean>(false);
    const [deletingCatId, setDeletingCatId] = useState<string | null>(null);

    // Live disposable pool calculation based on current form inputs
    const currentDisposablePool = useMemo(() => {
        const gross = Math.max(0, parseFloat(grossSalary) || 0);
        const rate = (parseFloat(cpfRate) || 0) / 100;
        const tax = parseFloat(taxes) || 0;
        const ins = parseFloat(insurance) || 0;
        const net = calculateCPFAndNetPay(gross, rate).takeHomePay;
        return calculateDisposableBudget(net, tax, ins);
    }, [grossSalary, cpfRate, taxes, insurance]);

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
            .reduce((sum, c) => sum + (categoryPercentages[c.id] || 0), 0);

        const targetUnlockedSum = Math.max(0, 100 - lockedSum);
        const currentUnlockedSum = unlockedCats.reduce((sum, c) => sum + (categoryPercentages[c.id] || 0), 0);

        const updated: Record<string, number> = { ...categoryPercentages };

        if (currentUnlockedSum <= 0) {
            const baseShare = Math.floor(targetUnlockedSum / unlockedCats.length);
            const remainder = targetUnlockedSum - baseShare * unlockedCats.length;

            unlockedCats.forEach((c, idx) => {
                updated[c.id] = baseShare + (idx < remainder ? 1 : 0);
            });
        } else {
            let runningAllocated = 0;
            unlockedCats.forEach((c) => {
                const current = categoryPercentages[c.id] || 0;
                const proportion = current / currentUnlockedSum;
                const allocated = Math.round(targetUnlockedSum * proportion);
                updated[c.id] = allocated;
                runningAllocated += allocated;
            });

            const diff = targetUnlockedSum - runningAllocated;
            if (diff !== 0 && unlockedCats.length > 0) {
                let bestCat = unlockedCats[0];
                for (const c of unlockedCats) {
                    if ((updated[c.id] || 0) > (updated[bestCat.id] || 0)) {
                        bestCat = c;
                    }
                }
                updated[bestCat.id] = Math.max(0, (updated[bestCat.id] || 0) + diff);
            }
        }

        setCategoryPercentages(updated);
        setErrorMessage(null);
    };

    // Synchronize initial state when modal opens or profile/allocations change
    useEffect(() => {
        if (profile) {
            setGrossSalary(String(profile.gross_salary));
            setCpfRate(String(Math.round(profile.cpf_employee_rate * 100)));
        }
        setTaxes(String(initialTaxes));
        setInsurance(String(initialInsurance));

        const pctMap: Record<string, number> = {};
        for (const cat of categories) {
            const existing = allocations.find((a) => a.category_id === cat.id);
            pctMap[cat.id] = existing ? Math.round(existing.target_percentage * 100) : 0;
        }
        setCategoryPercentages(pctMap);
        setCatFormMode(null);
        setEditingCat(null);
        setDeletingCatId(null);
        setErrorMessage(null);
    }, [profile, allocations, categories, initialTaxes, initialInsurance, isOpen]);

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
        return localCategories.reduce((sum, cat) => sum + (Number(categoryPercentages[cat.id]) || 0), 0);
    }, [localCategories, categoryPercentages]);

    const isValidTotal = Math.abs(totalPercentage - 100) < 0.001;

    const handlePercentageChange = (categoryId: string, rawVal: string) => {
        const val = rawVal === "" ? 0 : parseFloat(rawVal);
        setCategoryPercentages((prev) => ({
            ...prev,
            [categoryId]: isNaN(val) ? 0 : val,
        }));
    };

    const handleReset = () => {
        if (profile) {
            setGrossSalary(String(profile.gross_salary));
            setCpfRate(String(Math.round(profile.cpf_employee_rate * 100)));
        }
        setTaxes(String(initialTaxes));
        setInsurance(String(initialInsurance));
        const pctMap: Record<string, number> = {};
        for (const cat of localCategories) {
            const existing = allocations.find((a) => a.category_id === cat.id);
            pctMap[cat.id] = existing ? Math.round(existing.target_percentage * 100) : 0;
        }
        setCategoryPercentages(pctMap);
        setErrorMessage(null);
    };

    // Inline category CRUD handlers
    const refreshCategoriesFromService = async () => {
        const refreshed = await financeService.getCategories();
        if (refreshed && refreshed.length > 0) {
            setLocalCategories(refreshed);
            setCategoryPercentages((prev) => {
                const next: Record<string, number> = {};
                for (const c of refreshed) {
                    next[c.id] = prev[c.id] ?? 0;
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
                setCategoryPercentages((prev) => ({ ...prev, [created.id]: 0 }));
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
        const parsedTaxes = parseFloat(taxes) || 0;
        const parsedInsurance = parseFloat(insurance) || 0;

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
                const targetPct = (categoryPercentages[cat.id] || 0) / 100;
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
        <AnimatedModal isOpen={isOpen} onClose={onClose} maxWidth="max-w-lg">
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
                    <div className="flex items-center gap-1.5 p-2 bg-(--bg-canvas) border-b border-(--border-subtle) overflow-x-auto shrink-0">
                        {members.map((m) => {
                            const isSelected = m.id === profile.owner_id;
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => onSelectMember?.(m.id)}
                                    className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                                        isSelected
                                            ? "bg-(--pastel-butter) text-(--text-ink) border border-(--border-ink) shadow-cute-sm"
                                            : "text-(--text-muted) hover:text-(--text-ink)"
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
                    <ModalBody className="p-4 sm:p-5 space-y-5">
                    {errorMessage && (
                        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300">
                            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                            <span>{errorMessage}</span>
                        </div>
                    )}

                    {/* Section 1: Income & CPF */}
                    <div className="space-y-2.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <DollarSign className="h-3.5 w-3.5" />
                            Income &amp; CPF
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="gross-salary-input"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    Gross Salary (SGD)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">S$</span>
                                    <input
                                        id="gross-salary-input"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={grossSalary}
                                        onChange={(e) => setGrossSalary(e.target.value)}
                                        aria-label="Gross Salary"
                                        className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="cpf-rate-input"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    CPF Employee Rate (%)
                                </label>
                                <div className="relative">
                                    <input
                                        id="cpf-rate-input"
                                        type="number"
                                        step="1"
                                        min="0"
                                        max="100"
                                        required
                                        value={cpfRate}
                                        onChange={(e) => setCpfRate(e.target.value)}
                                        aria-label="CPF Employee Rate"
                                        className="w-full px-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                                    />
                                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Fixed Monthly Deductions */}
                    <div className="space-y-2.5">
                        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Fixed Monthly Deductions
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label
                                    htmlFor="monthly-taxes-input"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    Monthly Taxes (SGD)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">S$</span>
                                    <input
                                        id="monthly-taxes-input"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={taxes}
                                        onChange={(e) => setTaxes(e.target.value)}
                                        aria-label="Monthly Taxes"
                                        className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                                    />
                                </div>
                            </div>

                            <div>
                                <label
                                    htmlFor="monthly-insurance-input"
                                    className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1"
                                >
                                    Monthly Insurance (SGD)
                                </label>
                                <div className="relative">
                                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">S$</span>
                                    <input
                                        id="monthly-insurance-input"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={insurance}
                                        onChange={(e) => setInsurance(e.target.value)}
                                        aria-label="Monthly Insurance"
                                        className="w-full pl-8 pr-3 py-2 text-sm font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-hidden"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Section 3: Categories & Percentage Allocations */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                    <Percent className="h-3.5 w-3.5" />
                                    Categories &amp; Allocations (100%)
                                </h3>
                                <button
                                    type="button"
                                    onClick={handleOpenCreateCategory}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-200/70 dark:border-emerald-800 transition-colors cursor-pointer"
                                >
                                    <Plus className="h-3 w-3" />
                                    <span>Add Category</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleRestorePresetsInline}
                                    disabled={isCatSaving}
                                    title="Restore preset categories"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition-colors cursor-pointer"
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
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800 transition-colors cursor-pointer"
                                    title="Proportionally auto-adjust unlocked categories to reach 100%"
                                >
                                    <Scale className="h-3.5 w-3.5" />
                                    <span>Auto-Balance to 100%</span>
                                </button>

                                {/* Total Percentage Indicator */}
                                <div
                                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                                        isValidTotal
                                            ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                                            : "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                                    }`}
                                >
                                    {isValidTotal ? (
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    ) : (
                                        <AlertCircle className="h-3.5 w-3.5 text-rose-600" />
                                    )}
                                    <span>Total: {totalPercentage}%</span>
                                </div>
                            </div>
                        </div>

                        {/* Inline Add / Edit Category Drawer */}
                        {catFormMode && (
                            <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50/30 dark:bg-emerald-950/20 p-3.5 space-y-3 animate-in fade-in duration-150">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-slate-900 dark:text-white">
                                        {catFormMode === "create"
                                            ? "New Category"
                                            : `Edit Category: ${editingCat?.name}`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setCatFormMode(null)}
                                        className="text-xs font-semibold text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                                    >
                                        Cancel
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                            Category Name
                                        </label>
                                        <input
                                            type="text"
                                            value={catName}
                                            onChange={(e) => setCatName(e.target.value)}
                                            placeholder="e.g. Groceries, Pet, Gym"
                                            className="w-full px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/40 outline-hidden"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300 mb-1">
                                            Group
                                        </label>
                                        <div className="grid grid-cols-2 gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() => setCatGroup("spendable")}
                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                    catGroup === "spendable"
                                                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                                                }`}
                                            >
                                                Spendable
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCatGroup("allocation")}
                                                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                                    catGroup === "allocation"
                                                        ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300"
                                                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400"
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
                                                className="h-5 w-5 rounded-full border flex items-center justify-center transition-transform cursor-pointer"
                                                style={{
                                                    backgroundColor: c,
                                                    borderColor: catColor === c ? "#ffffff" : "transparent",
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
                                                    className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                                                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-500"
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
                                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                                    >
                                        <Check className="h-3.5 w-3.5" />
                                        <span>{catFormMode === "create" ? "Create Category" : "Update Category"}</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="space-y-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 p-3 sm:p-4">
                            {localCategories.length === 0 ? (
                                <div className="text-center py-6">
                                    <p className="text-xs text-slate-500 mb-2">No categories configured yet.</p>
                                    <button
                                        type="button"
                                        onClick={handleOpenCreateCategory}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                                    >
                                        <Plus className="h-3 w-3" />
                                        <span>Add Categories</span>
                                    </button>
                                </div>
                            ) : (
                                localCategories.map((cat) => {
                                    const currentPct = categoryPercentages[cat.id] ?? 0;
                                    const isLocked = Boolean(lockedCategories[cat.id]);
                                    const dollarEquivalent =
                                        Math.round(currentDisposablePool * ((currentPct || 0) / 100) * 100) / 100;
                                    const isDeleting = deletingCatId === cat.id;

                                    return (
                                        <div
                                            key={cat.id}
                                            className="p-2.5 sm:p-3 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-2 flex-wrap">
                                                <div className="flex items-center gap-1.5 min-w-0">
                                                    {/* Category Lock Toggle */}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleCategoryLock(cat.id)}
                                                        title={isLocked ? `Unlock ${cat.name}` : `Lock ${cat.name}`}
                                                        aria-label={isLocked ? `Unlock category` : `Lock category`}
                                                        data-testid={`lock-${cat.id}`}
                                                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                                                            isLocked
                                                                ? "bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-600 dark:text-amber-400"
                                                                : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                                        }`}
                                                    >
                                                        {isLocked ? (
                                                            <Lock className="h-3.5 w-3.5" />
                                                        ) : (
                                                            <Unlock className="h-3.5 w-3.5" />
                                                        )}
                                                    </button>

                                                    <span
                                                        className="h-2.5 w-2.5 rounded-full shrink-0"
                                                        style={{ backgroundColor: cat.color }}
                                                    />
                                                    <label
                                                        htmlFor={`cat-alloc-${cat.id}`}
                                                        className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate cursor-pointer"
                                                    >
                                                        {cat.name}
                                                    </label>
                                                    {isLocked && (
                                                        <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.2 rounded border border-amber-200 dark:border-amber-800/60">
                                                            Locked
                                                        </span>
                                                    )}

                                                    {/* Inline Edit / Delete Category Actions */}
                                                    {isDeleting ? (
                                                        <div className="inline-flex items-center gap-1 ml-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDeleteCategoryInline(cat.id)}
                                                                disabled={isCatSaving}
                                                                className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
                                                            >
                                                                Delete
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeletingCatId(null)}
                                                                className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
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
                                                                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                                            >
                                                                <Pencil className="h-3 w-3" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => setDeletingCatId(cat.id)}
                                                                title={`Delete ${cat.name}`}
                                                                aria-label="Delete category"
                                                                className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                                                            >
                                                                <Trash2 className="h-3 w-3" />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Live Dollar Equivalent & Numeric Input */}
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span
                                                        data-testid={`cat-dollar-${cat.id}`}
                                                        className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono"
                                                    >
                                                        {formatSGD(dollarEquivalent)}/mo
                                                    </span>
                                                    <div className="relative w-20">
                                                        <input
                                                            id={`cat-alloc-${cat.id}`}
                                                            type="number"
                                                            step="any"
                                                            min="0"
                                                            max="100"
                                                            value={currentPct}
                                                            onChange={(e) =>
                                                                handlePercentageChange(cat.id, e.target.value)
                                                            }
                                                            className="w-full pr-5 pl-2 py-1 text-right text-xs font-bold rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500/50 outline-hidden"
                                                        />
                                                        <span className="absolute right-1.5 top-1.5 text-[11px] text-slate-400">
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
                                                    step="1"
                                                    aria-label={`Allocation slider`}
                                                    data-testid={`slider-${cat.id}`}
                                                    value={currentPct}
                                                    onChange={(e) => handlePercentageChange(cat.id, e.target.value)}
                                                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-600"
                                                />
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>
                    </ModalBody>

                    {/* Footer Actions */}
                    <ModalFooter className="justify-between">
                        <button
                            type="button"
                            onClick={handleReset}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-(--text-muted) hover:text-(--text-ink) transition-colors cursor-pointer"
                        >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>Reset</span>
                        </button>

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
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-(--text-ink) bg-(--pastel-mint) hover:bg-(--pastel-mint-dark) border border-(--border-ink) shadow-cute-sm active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
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
