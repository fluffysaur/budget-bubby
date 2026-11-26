import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabaseFinanceService } from "../src/services/supabaseFinanceService";
import * as supabaseClientModule from "../src/services/supabaseClient";

describe("supabaseFinanceService recurring goal link compat", () => {
    const householdId = "00000000-0000-0000-0000-000000000001";
    const row = {
        id: "rec-1",
        household_id: householdId,
        owner_id: null,
        type: "bill",
        name: "Internet",
        amount: 50,
        frequency: "monthly",
        monthly_amortized_amount: 50,
        due_day: 5,
    };
    // The edit form always sends both goal fields, null when unlinked.
    const editPayload = {
        ...row,
        owner_id: "member-1",
        end_date: "2027-06-30",
        goal_id: null,
        goal_offset_months: null,
    } as any;

    let writes: Record<string, unknown>[];

    function useClient(hasGoalColumns: boolean) {
        writes = [];
        const write = (payload: Record<string, unknown>) => {
            writes.push(payload);
            const result =
                !hasGoalColumns && "goal_id" in payload
                    ? {
                          data: null,
                          error: {
                              code: "PGRST204",
                              message:
                                  "Could not find the 'goal_id' column of 'recurring_items' in the schema cache",
                          },
                      }
                    : { data: { ...row, ...payload }, error: null };
            return { select: () => ({ single: async () => result }) };
        };
        vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue({
            from: () => ({
                select: () => ({
                    eq: () => ({
                        single: async () => ({ data: row, error: null }),
                        maybeSingle: async () => ({ data: null, error: null }),
                    }),
                }),
                insert: (payload: Record<string, unknown>) => write(payload),
                update: (payload: Record<string, unknown>) => ({
                    eq: () => write(payload),
                }),
            }),
        } as any);
    }

    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("saves an end date edit when the goal columns are missing", async () => {
        useClient(false);
        const saved = await supabaseFinanceService.updateRecurringItem(
            "rec-1",
            editPayload,
        );
        expect(saved.end_date).toBe("2027-06-30");
        expect(writes).toHaveLength(2);
        expect("goal_id" in writes[1]).toBe(false);
        expect("goal_offset_months" in writes[1]).toBe(false);
    });

    it("adds an unlinked item when the goal columns are missing", async () => {
        useClient(false);
        const saved =
            await supabaseFinanceService.addRecurringItem(editPayload);
        expect(saved.end_date).toBe("2027-06-30");
        expect(writes).toHaveLength(2);
        expect("goal_id" in writes[1]).toBe(false);
    });

    it("rejects a goal link instead of silently dropping it", async () => {
        useClient(false);
        const linked = { ...editPayload, goal_id: "goal-1" };
        await expect(
            supabaseFinanceService.updateRecurringItem("rec-1", linked),
        ).rejects.toThrow("Goal linking isn't available yet");
        await expect(
            supabaseFinanceService.addRecurringItem(linked),
        ).rejects.toThrow("Goal linking isn't available yet");
        expect(writes).toHaveLength(2);
    });

    it("sends the goal fields once when the columns exist", async () => {
        useClient(true);
        await supabaseFinanceService.updateRecurringItem("rec-1", editPayload);
        expect(writes).toHaveLength(1);
        expect(writes[0].goal_id).toBeNull();
    });
});
