/**
 * ManageCategoriesModal Component
 * Full Category Management interface:
 * - View categories categorized into Spendable vs Wealth & Allocations
 * - Add new custom category
 * - Edit category name, color, icon, and group
 * - Delete category with confirmation dialog
 * - Restore recommended preset categories
 */

import React, { useState, useEffect, useId } from "react";
import {
    X,
    Plus,
    Pencil,
    Trash2,
    RotateCcw,
    AlertTriangle,
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
    Check,
} from "lucide-react";
import { financeService } from "../../services/financeService";
import type { Category, CategoryGroup } from "../../types/finance";
import { isSpendableCategory } from "../../lib/financialFormulas";

export interface ManageCategoriesModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCategoriesChanged?: () => void;
    className?: string;
}

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

export function getIconComponent(iconName?: string) {
    const found = PRESET_ICONS.find((i) => i.id === iconName);
    return found ? found.Icon : Tag;
}

export function ManageCategoriesModal({
    isOpen,
    onClose,
    onCategoriesChanged,
    className = "",
}: ManageCategoriesModalProps) {
    const titleId = useId();

    const [categories, setCategories] = useState<Category[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Form mode: null | 'create' | 'edit'
    const [formMode, setFormMode] = useState<"create" | "edit" | null>(null);
    const [editingCategory, setEditingCategory] = useState<Category | null>(null);

    // Form fields
    const [name, setName] = useState<string>("");
    const [group, setGroup] = useState<CategoryGroup>("spendable");
    const [color, setColor] = useState<string>("#F59E0B");
    const [icon, setIcon] = useState<string>("tag");
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

    // Deletion confirm modal
    const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const data = await financeService.getCategories();
            setCategories(data);
        } catch (err: any) {
            console.error("Failed to load categories:", err);
            setErrorMessage(err.message || "Failed to load categories.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            loadCategories();
            setFormMode(null);
            setEditingCategory(null);
            setDeletingCategory(null);
            setErrorMessage(null);
        }
    }, [isOpen]);

    // Handle ESC key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                if (deletingCategory) {
                    setDeletingCategory(null);
                } else if (formMode) {
                    setFormMode(null);
                } else {
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, formMode, deletingCategory, onClose]);

    const handleOpenCreate = () => {
        setName("");
        setGroup("spendable");
        setColor(PRESET_COLORS[0]);
        setIcon("tag");
        setErrorMessage(null);
        setFormMode("create");
    };

    const handleOpenEdit = (cat: Category) => {
        setEditingCategory(cat);
        setName(cat.name);
        setGroup(cat.group || (isSpendableCategory(cat.name) ? "spendable" : "allocation"));
        setColor(cat.color || "#64748B");
        setIcon(cat.icon || "tag");
        setErrorMessage(null);
        setFormMode("edit");
    };

    const handleSubmitForm = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            setErrorMessage("Please provide a category name.");
            return;
        }

        try {
            setIsSubmitting(true);
            setErrorMessage(null);

            if (formMode === "create") {
                await financeService.addCategory({
                    name: name.trim(),
                    color,
                    icon,
                    group,
                });
            } else if (formMode === "edit" && editingCategory) {
                await financeService.updateCategory(editingCategory.id, {
                    name: name.trim(),
                    color,
                    icon,
                    group,
                });
            }

            setFormMode(null);
            setEditingCategory(null);
            await loadCategories();
            onCategoriesChanged?.();
        } catch (err: any) {
            console.error("Failed to save category:", err);
            setErrorMessage(err.message || "Failed to save category.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteConfirm = async () => {
        if (!deletingCategory) return;
        try {
            setIsSubmitting(true);
            await financeService.deleteCategory(deletingCategory.id);
            setDeletingCategory(null);
            await loadCategories();
            onCategoriesChanged?.();
        } catch (err: any) {
            console.error("Failed to delete category:", err);
            setErrorMessage(err.message || "Failed to delete category.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRestorePresets = async () => {
        try {
            setLoading(true);
            await financeService.seedDefaultCategories();
            await loadCategories();
            onCategoriesChanged?.();
        } catch (err: any) {
            console.error("Failed to restore preset categories:", err);
            setErrorMessage(err.message || "Failed to restore preset categories.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const spendableCategories = categories.filter((c) => isSpendableCategory(c));
    const allocationCategories = categories.filter((c) => !isSpendableCategory(c));

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
        >
            <div
                className={`relative w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl p-6 transition-all my-8 ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
                    <div>
                        <h2
                            id={titleId}
                            className="text-lg font-bold text-slate-900 dark:text-white"
                        >
                            Manage Categories
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Customize your spendable meters and wealth allocations
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        aria-label="Close modal"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {/* Global Error Banner */}
                {errorMessage && (
                    <div className="mt-4 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-xs text-rose-600 dark:text-rose-400 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 shrink-0" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Form Mode (Add or Edit) */}
                {formMode ? (
                    <form
                        onSubmit={handleSubmitForm}
                        className="mt-4 space-y-4"
                    >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                                {formMode === "create" ? "Add New Category" : `Edit Category: ${editingCategory?.name}`}
                            </h3>
                            <button
                                type="button"
                                onClick={() => setFormMode(null)}
                                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>

                        {/* Category Name */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Category Name
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Groceries, Gym, Rent"
                                className="w-full px-3.5 py-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                        </div>

                        {/* Category Group */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Classification Type
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setGroup("spendable")}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                                        group === "spendable"
                                            ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300"
                                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                    }`}
                                >
                                    <span className="block font-semibold">Spendable Category</span>
                                    <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                                        Tracked with daily spending meters (Food, Transport, Lifestyle, Buffer)
                                    </span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setGroup("allocation")}
                                    className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left ${
                                        group === "allocation"
                                            ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300"
                                            : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400"
                                    }`}
                                >
                                    <span className="block font-semibold">Wealth & Fixed Allocation</span>
                                    <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                                        Transferred or saved off the top (Investments, Savings, Tithing)
                                    </span>
                                </button>
                            </div>
                        </div>

                        {/* Color Presets */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Accent Color
                            </label>
                            <div className="flex flex-wrap gap-2.5 items-center">
                                {PRESET_COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className="h-7 w-7 rounded-full border-2 transition-transform cursor-pointer flex items-center justify-center"
                                        style={{
                                            backgroundColor: c,
                                            borderColor: color === c ? "#ffffff" : "transparent",
                                            transform: color === c ? "scale(1.15)" : "scale(1)",
                                        }}
                                    >
                                        {color === c && <Check className="h-3.5 w-3.5 text-white stroke-3" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Icon Presets */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                                Icon
                            </label>
                            <div className="grid grid-cols-7 gap-2">
                                {PRESET_ICONS.map((item) => {
                                    const IconComp = item.Icon;
                                    const isSelected = icon === item.id;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setIcon(item.id)}
                                            title={item.label}
                                            className={`p-2 rounded-xl flex flex-col items-center justify-center border transition-all cursor-pointer ${
                                                isSelected
                                                    ? "border-emerald-500 bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400"
                                                    : "border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-800"
                                            }`}
                                        >
                                            <IconComp className="h-4 w-4" />
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Form Actions */}
                        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <button
                                type="button"
                                onClick={() => setFormMode(null)}
                                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
                            >
                                {formMode === "create" ? "Create Category" : "Save Changes"}
                            </button>
                        </div>
                    </form>
                ) : (
                    /* List Mode */
                    <div className="mt-4 space-y-5 max-h-[60vh] overflow-y-auto pr-1">
                        {/* Top Action Row */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                                {categories.length} {categories.length === 1 ? "Category" : "Categories"} Configured
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handleRestorePresets}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700 transition-colors cursor-pointer"
                                    title="Restore standard recommended Singapore categories"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    <span>Restore Presets</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleOpenCreate}
                                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-xs transition-colors cursor-pointer"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    <span>Add Category</span>
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-12 text-center text-xs text-slate-400">Loading categories...</div>
                        ) : categories.length === 0 ? (
                            <div className="py-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 p-6">
                                <Tag className="h-8 w-8 mx-auto text-slate-400 mb-2 opacity-50" />
                                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Categories</h4>
                                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                                    You have no categories configured yet. Add custom categories or restore recommended
                                    presets.
                                </p>
                                <div className="mt-4 flex items-center justify-center gap-3">
                                    <button
                                        type="button"
                                        onClick={handleRestorePresets}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 cursor-pointer"
                                    >
                                        Restore Presets
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleOpenCreate}
                                        className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 cursor-pointer"
                                    >
                                        + Add Category
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Spendable Categories Section */}
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center justify-between">
                                        <span>Spendable Categories ({spendableCategories.length})</span>
                                        <span className="text-[10px] lowercase text-slate-400 font-normal">
                                            tracked against monthly spend
                                        </span>
                                    </h4>
                                    <div className="space-y-1.5">
                                        {spendableCategories.map((cat) => {
                                            const IconComp = getIconComponent(cat.icon);
                                            return (
                                                <div
                                                    key={cat.id}
                                                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                                                            style={{ backgroundColor: cat.color || "#64748B" }}
                                                        >
                                                            <IconComp className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                {cat.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(cat)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                            title="Edit Category"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingCategory(cat)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                            title="Delete Category"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* Wealth & Fixed Allocation Section */}
                                <div>
                                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center justify-between">
                                        <span>Wealth & Fixed Allocations ({allocationCategories.length})</span>
                                        <span className="text-[10px] lowercase text-slate-400 font-normal">
                                            transferred directly from gross income
                                        </span>
                                    </h4>
                                    <div className="space-y-1.5">
                                        {allocationCategories.map((cat) => {
                                            const IconComp = getIconComponent(cat.icon);
                                            return (
                                                <div
                                                    key={cat.id}
                                                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:bg-slate-100/60 dark:hover:bg-slate-800/70 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div
                                                            className="h-8 w-8 rounded-lg flex items-center justify-center text-white shrink-0 shadow-2xs"
                                                            style={{ backgroundColor: cat.color || "#64748B" }}
                                                        >
                                                            <IconComp className="h-4 w-4" />
                                                        </div>
                                                        <div>
                                                            <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                                                                {cat.name}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenEdit(cat)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                            title="Edit Category"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDeletingCategory(cat)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-white dark:hover:bg-slate-700 transition-colors cursor-pointer"
                                                            title="Delete Category"
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Delete Confirmation Sub-Dialog */}
                {deletingCategory && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-xs rounded-2xl">
                        <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 shadow-xl text-center">
                            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400 mb-3">
                                <Trash2 className="h-5 w-5" />
                            </div>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                                Delete "{deletingCategory.name}"?
                            </h4>
                            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                Removing this category will delete associated budget allocations. Existing expense
                                records will have their category cleared.
                            </p>
                            <div className="mt-5 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setDeletingCategory(null)}
                                    className="px-3.5 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDeleteConfirm}
                                    disabled={isSubmitting}
                                    className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 transition-colors cursor-pointer"
                                >
                                    Confirm Delete
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default ManageCategoriesModal;
