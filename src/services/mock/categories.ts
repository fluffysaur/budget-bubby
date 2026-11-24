/** In-memory mock of the categories domain. */

import type {
    Category,
    CreateCategoryInput,
    UpdateCategoryInput,
} from "../../types/finance";
import { mockCategories } from "../../data/mockSeedData";
import { isSpendableCategory } from "../../lib/financialFormulas";
import { cloneDeep } from "./context";
import type { MockContext } from "./context";

export class CategoriesStore {
    constructor(private readonly ctx: MockContext) {}

    async getCategories(): Promise<Category[]> {
        return cloneDeep(this.ctx.state.categories);
    }

    async addCategory(input: CreateCategoryInput): Promise<Category> {
        const householdId =
            input.household_id ||
            this.ctx.state.household.id ||
            "hh-00000000-0001";
        const trimmedName = input.name.trim();
        const memberId = input.member_id ?? null;

        const duplicate = this.ctx.state.categories.some(
            (c) =>
                c.household_id === householdId &&
                (c.member_id ?? null) === memberId &&
                c.name.trim().toLowerCase() === trimmedName.toLowerCase(),
        );
        if (duplicate) {
            throw new Error(
                `A category named "${trimmedName}" already exists in this scope.`,
            );
        }

        const newCategory: Category = {
            id:
                typeof crypto !== "undefined" && crypto.randomUUID
                    ? crypto.randomUUID()
                    : `cat-${Date.now()}`,
            household_id: householdId,
            member_id: memberId,
            name: trimmedName,
            color: input.color || "#64748B",
            icon: input.icon || "tag",
            is_system: input.is_system || false,
            group:
                input.group ??
                (isSpendableCategory(input.name) ? "spendable" : "allocation"),
        };
        this.ctx.state.categories.push(newCategory);
        this.ctx.persist();
        return cloneDeep(newCategory);
    }

    async updateCategory(
        id: string,
        updates: UpdateCategoryInput,
    ): Promise<Category> {
        const idx = this.ctx.state.categories.findIndex((c) => c.id === id);
        if (idx === -1) {
            throw new Error(`Category not found: ${id}`);
        }
        const current = this.ctx.state.categories[idx];
        const nextName =
            updates.name !== undefined ? updates.name.trim() : current.name;
        const scopeMemberId = current.member_id ?? null;

        if (updates.name !== undefined) {
            const duplicate = this.ctx.state.categories.some(
                (c) =>
                    c.id !== id &&
                    c.household_id === current.household_id &&
                    (c.member_id ?? null) === scopeMemberId &&
                    c.name.trim().toLowerCase() === nextName.toLowerCase(),
            );
            if (duplicate) {
                throw new Error(
                    `A category named "${nextName}" already exists in this scope.`,
                );
            }
        }

        const updated: Category = {
            ...current,
            name: nextName,
            color: updates.color !== undefined ? updates.color : current.color,
            icon: updates.icon !== undefined ? updates.icon : current.icon,
            group: updates.group !== undefined ? updates.group : current.group,
        };
        this.ctx.state.categories[idx] = updated;
        this.ctx.persist();
        return cloneDeep(updated);
    }

    async deleteCategory(id: string): Promise<void> {
        this.ctx.state.categories = this.ctx.state.categories.filter(
            (c) => c.id !== id,
        );
        // Remove from allocations
        this.ctx.state.baseAllocations = this.ctx.state.baseAllocations.filter(
            (a) => a.category_id !== id,
        );
        this.ctx.persist();
    }

    async seedDefaultCategories(): Promise<Category[]> {
        this.ctx.state.categories = cloneDeep(mockCategories);
        this.ctx.persist();
        return cloneDeep(this.ctx.state.categories);
    }
}
