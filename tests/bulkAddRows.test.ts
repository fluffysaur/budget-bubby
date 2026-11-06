import { describe, it, expect } from "vitest";
import {
    MAX_BULK_ROWS,
    bulkReducer,
    createInitialState,
    createRow,
    isRowBlank,
    parseAmount,
    rowToCreateInput,
    sanitizeAmount,
    summarise,
    validateRow,
    visibleErrors,
    type BulkRow,
    type BulkState,
} from "../src/lib/bulkAddRows";

const base = (over: Partial<BulkRow> = {}): BulkRow => ({
    ...createRow({
        date: "2026-11-04",
        isShared: false,
        id: "r1",
        time: "12:00",
    }),
    ...over,
});

const initial = (): BulkState =>
    createInitialState({
        payerId: "m1",
        date: "2026-11-05",
        isShared: true,
        rowId: "r1",
    });

describe("bulkAddRows helpers", () => {
    it("createRow uses given date and shared default", () => {
        const r = createRow({ date: "2026-11-03", isShared: true });
        expect(r.date).toBe("2026-11-03");
        expect(r.isShared).toBe(true);
        expect(r.currency).toBe("SGD");
        expect(r.id).toBeTruthy();
        expect(isRowBlank(r)).toBe(true);
    });

    it("parses and sanitises amounts", () => {
        expect(parseAmount("12.5")).toBe(12.5);
        expect(parseAmount("12,5")).toBe(12.5);
        expect(parseAmount("")).toBe(0);
        expect(parseAmount("abc")).toBe(0);
        expect(sanitizeAmount("1a2,3456")).toBe("12.34");
        expect(sanitizeAmount("1.2.3")).toBe("1.23");
        expect(sanitizeAmount("980.5", "JPY")).toBe("980");
    });

    describe("validateRow", () => {
        const ctx = { rateOverrides: {} };

        it("ignores blank rows", () => {
            expect(validateRow(base(), ctx)).toEqual({});
        });

        it("flags partial rows", () => {
            expect(validateRow(base({ amount: "5" }), ctx)).toEqual({
                item: "Add description",
                category: "Pick category",
            });
            expect(
                validateRow(base({ item: "Lunch", categoryId: "c" }), ctx),
            ).toEqual({
                amount: "Enter amount",
            });
            expect(
                validateRow(
                    base({ amount: "0", item: "x", categoryId: "c" }),
                    ctx,
                ),
            ).toEqual({
                amount: "Enter amount",
            });
        });

        it("goal rows need no category", () => {
            expect(
                validateRow(
                    base({ amount: "5", item: "Ring", goalId: "g1" }),
                    ctx,
                ),
            ).toEqual({});
        });

        it("flags a foreign currency without a usable rate", () => {
            const row = base({
                amount: "5",
                item: "x",
                categoryId: "c",
                currency: "JPY",
            });
            expect(validateRow(row, { rateOverrides: { JPY: 0 } })).toEqual({
                rate: "Set rate",
            });
            // Falls back to the default rate when there is no override
            expect(validateRow(row, ctx)).toEqual({});
        });

        it("shows errors only when touched or after a failed save", () => {
            const row = base({ amount: "5" });
            const errors = validateRow(row, { rateOverrides: {} });
            expect(visibleErrors(row, errors, false)).toEqual({
                amount: undefined,
                item: undefined,
            });
            expect(
                visibleErrors(
                    { ...row, touched: { amount: true, item: true } },
                    errors,
                    false,
                ).item,
            ).toBe("Add description");
            expect(visibleErrors(row, errors, true).item).toBe(
                "Add description",
            );
        });
    });

    describe("rowToCreateInput", () => {
        const ctx = { payerId: "m1", rateOverrides: {} };

        it("uses split_ratio 0.0 for solo and 0.5 for shared", () => {
            const solo = rowToCreateInput(
                base({
                    amount: "10",
                    item: " Lunch ",
                    categoryId: "c1",
                    isShared: false,
                }),
                ctx,
            );
            const shared = rowToCreateInput(
                base({
                    amount: "10",
                    item: "Lunch",
                    categoryId: "c1",
                    isShared: true,
                }),
                ctx,
            );
            expect(solo.split_ratio).toBe(0);
            expect(solo.is_shared).toBe(false);
            expect(solo.item).toBe("Lunch");
            expect(shared.split_ratio).toBe(0.5);
            expect(shared.is_shared).toBe(true);
        });

        it("goal rows have a null category", () => {
            const input = rowToCreateInput(
                base({
                    amount: "10",
                    item: "Ring",
                    categoryId: "c1",
                    goalId: "g1",
                }),
                ctx,
            );
            expect(input.category_id).toBeNull();
            expect(input.goal_id).toBe("g1");
        });

        it("builds FX fields for foreign currency", () => {
            const input = rowToCreateInput(
                base({
                    amount: "1000",
                    item: "Ramen",
                    categoryId: "c1",
                    currency: "JPY",
                }),
                { payerId: "m1", rateOverrides: { JPY: 100 } },
            );
            expect(input.amount).toBe(10);
            expect(input.original_amount).toBe(1000);
            expect(input.original_currency).toBe("JPY");
            expect(input.exchange_rate).toBe(100);
            expect(input.date).toBe("2026-11-04");
            expect(input.time).toBe("12:00");
        });
    });

    describe("summarise", () => {
        it("counts valid rows, totals with rate overrides, ignores blanks", () => {
            const rows = [
                base({
                    id: "a",
                    amount: "12.50",
                    item: "Lunch",
                    categoryId: "c",
                }),
                base({ id: "b", amount: "25", item: "Ring", goalId: "g" }),
                base({
                    id: "c",
                    amount: "1000",
                    item: "Ramen",
                    categoryId: "c",
                    currency: "JPY",
                }),
                base({ id: "d" }),
            ];
            const s = summarise(rows, { JPY: 100 });
            expect(s.count).toBe(3);
            expect(s.goalCount).toBe(1);
            expect(s.blankCount).toBe(1);
            expect(s.invalidCount).toBe(0);
            expect(s.totalSGD).toBe(47.5);
            expect(s.firstInvalid).toBeNull();
        });

        it("reports the first invalid row and field", () => {
            const rows = [
                base({ id: "a", amount: "5", item: "x", categoryId: "c" }),
                base({ id: "b", amount: "5", item: "", categoryId: "c" }),
            ];
            const s = summarise(rows, {});
            expect(s.invalidCount).toBe(1);
            expect(s.firstInvalid).toEqual({ rowId: "b", field: "item" });
        });
    });
});

describe("bulkReducer", () => {
    it("starts with one row", () => {
        expect(initial().rows).toHaveLength(1);
    });

    it("addRow uses the active date; setActiveDate does not mutate existing rows", () => {
        let s = initial();
        s = bulkReducer(s, { type: "setActiveDate", date: "2026-11-04" });
        expect(s.rows[0].date).toBe("2026-11-05");
        s = bulkReducer(s, { type: "addRow", id: "r2", isShared: false });
        expect(s.rows[1].date).toBe("2026-11-04");
        expect(s.rows[1].isShared).toBe(false);
        expect(s.rows[0].date).toBe("2026-11-05");
    });

    it("caps the number of rows", () => {
        let s = initial();
        for (let i = 0; i < MAX_BULK_ROWS + 5; i++) {
            s = bulkReducer(s, { type: "addRow", isShared: true });
        }
        expect(s.rows).toHaveLength(MAX_BULK_ROWS);
    });

    it("never removes below one row; clears the last row instead", () => {
        let s = initial();
        s = bulkReducer(s, {
            type: "updateRow",
            id: "r1",
            patch: { amount: "5", item: "x" },
        });
        s = bulkReducer(s, { type: "removeRow", id: "r1", isShared: true });
        expect(s.rows).toHaveLength(1);
        expect(isRowBlank(s.rows[0])).toBe(true);
        expect(s.removed?.row.item).toBe("x");
    });

    it("removes and restores a non-blank row at its index", () => {
        let s = initial();
        s = bulkReducer(s, { type: "addRow", id: "r2", isShared: true });
        s = bulkReducer(s, { type: "addRow", id: "r3", isShared: true });
        s = bulkReducer(s, {
            type: "updateRow",
            id: "r2",
            patch: { item: "keep" },
        });
        s = bulkReducer(s, { type: "removeRow", id: "r2", isShared: true });
        expect(s.rows.map((r) => r.id)).toEqual(["r1", "r3"]);
        s = bulkReducer(s, { type: "undoRemove" });
        expect(s.rows.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
        expect(s.removed).toBeNull();
    });

    it("blank rows leave no undo entry", () => {
        let s = initial();
        s = bulkReducer(s, { type: "addRow", id: "r2", isShared: true });
        s = bulkReducer(s, { type: "removeRow", id: "r2", isShared: true });
        expect(s.removed).toBeNull();
    });

    it("auto-guess applies until the user picks a category", () => {
        let s = initial();
        s = bulkReducer(s, {
            type: "setItem",
            id: "r1",
            item: "lunch",
            guessedCategoryId: "food",
        });
        expect(s.rows[0].categoryId).toBe("food");
        s = bulkReducer(s, {
            type: "setCategory",
            id: "r1",
            categoryId: "transport",
        });
        s = bulkReducer(s, {
            type: "setItem",
            id: "r1",
            item: "lunch 2",
            guessedCategoryId: "food",
        });
        expect(s.rows[0].categoryId).toBe("transport");
        expect(s.rows[0].categoryTouched).toBe(true);
    });

    it("an unmatched edit keeps the previous guess", () => {
        let s = initial();
        s = bulkReducer(s, {
            type: "setItem",
            id: "r1",
            item: "lunch",
            guessedCategoryId: "food",
        });
        s = bulkReducer(s, { type: "setItem", id: "r1", item: "lunch x" });
        expect(s.rows[0].categoryId).toBe("food");
    });

    it("goal pick clears category and category pick clears goal", () => {
        let s = initial();
        s = bulkReducer(s, {
            type: "setCategory",
            id: "r1",
            categoryId: "food",
        });
        s = bulkReducer(s, { type: "setGoal", id: "r1", goalId: "g1" });
        expect(s.rows[0]).toMatchObject({ goalId: "g1", categoryId: "" });
        s = bulkReducer(s, {
            type: "setCategory",
            id: "r1",
            categoryId: "food",
        });
        expect(s.rows[0]).toMatchObject({ goalId: null, categoryId: "food" });
    });

    it("tracks rate overrides and touch state", () => {
        let s = initial();
        s = bulkReducer(s, { type: "setRate", currency: "JPY", rate: 110 });
        expect(s.rateOverrides.JPY).toBe(110);
        s = bulkReducer(s, { type: "touch", id: "r1", field: "amount" });
        expect(s.rows[0].touched.amount).toBe(true);
    });
});
