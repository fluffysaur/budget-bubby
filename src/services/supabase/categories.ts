/** Supabase queries for the categories domain. */

import type {
    Category,
    CreateCategoryInput,
    UpdateCategoryInput,
} from "../../types/finance";
import { isSpendableCategory } from "../../lib/financialFormulas";
import { isValidUuid } from "../../lib/uuid";
import {
    PRESET_DEFAULT_CATEGORIES,
    isMissingColumnError,
    columnSupport,
} from "./shared";
import type { SupabaseContext } from "./context";

export class CategoriesStore {
    constructor(private readonly ctx: SupabaseContext) {}

    async getCategories(): Promise<Category[]> {
        const client = this.ctx.getClient();
        const { data, error } = await client.from("categories").select("*");
        if (error) throw error;
        const cats = (data || []) as Category[];
        if (cats.length > 0) {
            return cats.map((row) => ({
                ...row,
                group:
                    row.group ??
                    (isSpendableCategory(row.name)
                        ? "spendable"
                        : "allocation"),
            }));
        }

        // Auto-seed recommended default categories if household has no categories in Supabase
        try {
            const householdId = await this.ctx.getHouseholdId();
            return await this.seedDefaultCategories(householdId);
        } catch (seedErr) {
            console.warn("Auto-seed default categories encountered:", seedErr);
            return [];
        }
    }

    async seedDefaultCategories(
        explicitHouseholdId?: string,
    ): Promise<Category[]> {
        const client = this.ctx.getClient();
        const householdId =
            explicitHouseholdId || (await this.ctx.getHouseholdId());

        const rowsToInsert = PRESET_DEFAULT_CATEGORIES.map((preset) => ({
            household_id: householdId,
            name: preset.name,
            color: preset.color,
            icon: preset.icon,
            is_system: false,
        }));

        let { data, error } = await client
            .from("categories")
            .upsert(rowsToInsert, { onConflict: "household_id,name" })
            .select();

        if (error) {
            // Partial unique index (idx_categories_shared_unique_name) may not match ON CONFLICT (household_id, name).
            const code = (error as { code?: string }).code;
            if (code === "42P10") {
                ({ data, error } = await client
                    .from("categories")
                    .insert(rowsToInsert)
                    .select());
            }
        }

        if (error) throw error;
        return ((data || []) as Category[]).map((row) => ({
            ...row,
            group:
                row.group ??
                (isSpendableCategory(row.name) ? "spendable" : "allocation"),
        }));
    }

    async addCategory(input: CreateCategoryInput): Promise<Category> {
        const client = this.ctx.getClient();
        const householdId = isValidUuid(input.household_id)
            ? input.household_id
            : await this.ctx.getHouseholdId();

        const insertPayload: Record<string, unknown> = {
            household_id: householdId,
            name: input.name.trim(),
            color: input.color || "#64748B",
            icon: input.icon || "tag",
            is_system: input.is_system || false,
        };

        const wantsGroup =
            input.group !== undefined && columnSupport.categoryGroup !== false;
        if (wantsGroup) insertPayload.group = input.group;

        const wantsMemberId =
            input.member_id !== undefined &&
            columnSupport.categoryMemberId !== false;
        if (wantsMemberId) insertPayload.member_id = input.member_id ?? null;

        let { data, error } = await client
            .from("categories")
            .insert(insertPayload)
            .select()
            .single();

        if (error && isMissingColumnError(error)) {
            let retried = false;
            if (wantsGroup && "group" in insertPayload) {
                columnSupport.categoryGroup = false;
                delete insertPayload.group;
                retried = true;
            }
            if (wantsMemberId && "member_id" in insertPayload) {
                columnSupport.categoryMemberId = false;
                delete insertPayload.member_id;
                retried = true;
            }
            if (retried) {
                ({ data, error } = await client
                    .from("categories")
                    .insert({ ...insertPayload })
                    .select()
                    .single());
            }
        } else if (!error) {
            if (wantsGroup) columnSupport.categoryGroup = true;
            if (wantsMemberId) columnSupport.categoryMemberId = true;
        }

        if (error) throw error;
        const row = data as Category;
        return {
            ...row,
            group:
                input.group ??
                row.group ??
                (isSpendableCategory(row.name) ? "spendable" : "allocation"),
        };
    }

    async updateCategory(
        id: string,
        updates: UpdateCategoryInput,
    ): Promise<Category> {
        const client = this.ctx.getClient();
        const payload: Record<string, unknown> = {};
        if (updates.name !== undefined) payload.name = updates.name.trim();
        if (updates.color !== undefined) payload.color = updates.color;
        if (updates.icon !== undefined) payload.icon = updates.icon;

        const wantsGroup =
            updates.group !== undefined &&
            columnSupport.categoryGroup !== false;
        if (wantsGroup) payload.group = updates.group;

        const run = (body: Record<string, unknown>) =>
            Object.keys(body).length > 0
                ? client
                      .from("categories")
                      .update(body)
                      .eq("id", id)
                      .select()
                      .single()
                : client.from("categories").select("*").eq("id", id).single();

        let { data, error } = await run(payload);

        if (error && wantsGroup && isMissingColumnError(error)) {
            // categories.group migration not applied yet: retry once without it.
            columnSupport.categoryGroup = false;
            delete payload.group;
            ({ data, error } = await run(payload));
        } else if (!error && wantsGroup) {
            columnSupport.categoryGroup = true;
        }

        if (error) throw error;
        const row = data as Category;
        return {
            ...row,
            group:
                updates.group ??
                row.group ??
                (isSpendableCategory(row.name) ? "spendable" : "allocation"),
        };
    }

    async deleteCategory(id: string): Promise<void> {
        const client = this.ctx.getClient();
        const { error } = await client.from("categories").delete().eq("id", id);

        if (error) throw error;
    }
}
