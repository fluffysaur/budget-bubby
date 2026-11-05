import { describe, it, expect, vi, beforeEach } from "vitest";
import {
    supabaseFinanceService,
    resetCategoryGroupColumnSupport,
} from "../src/services/supabaseFinanceService";
import * as supabaseClientModule from "../src/services/supabaseClient";

describe("supabaseFinanceService category group compat", () => {
    const missingColumn = {
        code: "42703",
        message: 'column "group" does not exist',
    };
    const householdId = "00000000-0000-0000-0000-000000000001";
    let insertSpy: any;
    let updateSpy: any;

    function makeClient(failWithGroup: boolean) {
        const single = (payload: any) =>
            vi.fn().mockImplementation(async () => {
                if (failWithGroup && "group" in payload) {
                    return { data: null, error: missingColumn };
                }
                return {
                    data: {
                        id: "cat-1",
                        household_id: householdId,
                        name: "Allowance",
                        ...payload,
                    },
                    error: null,
                };
            });
        insertSpy = vi.fn().mockImplementation((payload: any) => ({
            select: () => ({ single: single(payload) }),
        }));
        updateSpy = vi.fn().mockImplementation((payload: any) => ({
            eq: () => ({ select: () => ({ single: single(payload) }) }),
        }));
        return {
            from: vi.fn((table: string) =>
                table === "categories"
                    ? { insert: insertSpy, update: updateSpy }
                    : {},
            ),
        };
    }

    beforeEach(() => {
        vi.restoreAllMocks();
        resetCategoryGroupColumnSupport();
    });

    it("sends group when the column exists", async () => {
        vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(
            makeClient(false) as any,
        );
        const cat = await supabaseFinanceService.addCategory({
            household_id: householdId,
            name: "Food",
            group: "allocation",
        } as any);
        expect(insertSpy).toHaveBeenCalledTimes(1);
        expect(insertSpy.mock.calls[0][0].group).toBe("allocation");
        expect(cat.group).toBe("allocation");
    });

    it("addCategory retries once without group when the column is missing", async () => {
        vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(
            makeClient(true) as any,
        );
        const cat = await supabaseFinanceService.addCategory({
            household_id: householdId,
            name: "Allowance",
            group: "allocation",
        } as any);
        expect(insertSpy).toHaveBeenCalledTimes(2);
        expect("group" in insertSpy.mock.calls[1][0]).toBe(false);
        expect(cat.group).toBe("allocation");

        // The missing column is remembered: no further failing request.
        await supabaseFinanceService.addCategory({
            household_id: householdId,
            name: "Other",
            group: "spendable",
        } as any);
        expect(insertSpy).toHaveBeenCalledTimes(3);
        expect("group" in insertSpy.mock.calls[2][0]).toBe(false);
    });

    it("updateCategory retries without group and echoes the requested group", async () => {
        vi.spyOn(supabaseClientModule, "supabase", "get").mockReturnValue(
            makeClient(true) as any,
        );
        const cat = await supabaseFinanceService.updateCategory("cat-1", {
            name: "Allowance",
            group: "allocation",
        });
        expect(updateSpy).toHaveBeenCalledTimes(2);
        expect("group" in updateSpy.mock.calls[1][0]).toBe(false);
        expect(cat.group).toBe("allocation");
    });
});
