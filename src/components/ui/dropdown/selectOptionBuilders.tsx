import { getCategoryIconComponent } from "../../../lib/categoryPresets";
import type { Category, HouseholdMember } from "../../../types/finance";
import { AvatarDot } from "../AvatarDot";
import type { SelectOption } from "./types";

/** Category row with its icon chip in the category colour. */
export function categoryToSelectOption(category: Category): SelectOption {
    const Icon = getCategoryIconComponent(category.icon);
    return {
        value: category.id,
        label: category.name,
        icon: (
            <span className="flex h-6 w-6 items-center justify-center rounded-lg border-2 border-(--border-ink) bg-(--bg-canvas)">
                <Icon
                    className="h-3.5 w-3.5"
                    style={{ color: category.color }}
                    strokeWidth={2.5}
                />
            </span>
        ),
    };
}

/** Household member row with their avatar. */
export function memberToSelectOption(member: HouseholdMember): SelectOption {
    return {
        value: member.id,
        label: member.display_name,
        icon: (
            <AvatarDot
                name={member.display_name}
                avatarUrl={member.avatar_url}
                size="sm"
                decorative
            />
        ),
    };
}
