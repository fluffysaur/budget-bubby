import type { LucideIcon } from "lucide-react";
import {
    Utensils,
    Sparkles,
    Car,
    ShoppingBag,
    Coffee,
    Plane,
    Home,
    Wifi,
    TrendingUp,
    PiggyBank,
    Heart,
    Shield,
    Gift,
    Tag,
} from "lucide-react";

export interface PresetIconItem {
    id: string;
    label: string;
    Icon: LucideIcon;
}

export const PRESET_COLORS: readonly string[] = [
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
] as const;

export const PRESET_ICONS: readonly PresetIconItem[] = [
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
] as const;

/**
 * Returns the Lucide icon component matching an icon name string, falling back to Tag.
 */
export function getCategoryIconComponent(iconName?: string): LucideIcon {
    if (!iconName) return Tag;
    const found = PRESET_ICONS.find((i) => i.id === iconName);
    return found ? found.Icon : Tag;
}
