/**
 * Pure helpers and reducer for the Bulk Add rows UI.
 * No React: everything here is unit-testable.
 */

import type { CreateExpenseInput } from "../types/finance";
import {
    buildExpenseFxFields,
    convertToSGD,
    getDefaultRate,
    isZeroDecimalCurrency,
} from "./currencyConverter";
import { generateUuid } from "./uuid";
import { getCurrentSingaporeTime } from "./dateUtils";

export const MAX_BULK_ROWS = 30;

export interface BulkRow {
    id: string;
    /** YYYY-MM-DD, copied from the active day chip at creation. */
    date: string;
    /** HH:mm, set once at row creation. */
    time: string;
    /** Raw text, parsed on validate/submit. */
    amount: string;
    item: string;
    /** "" = none yet */
    categoryId: string;
    goalId: string | null;
    /** User explicitly picked a category/goal: stops auto-guessing. */
    categoryTouched: boolean;
    isShared: boolean;
    tags: string[];
    currency: string;
    touched: { amount: boolean; item: boolean };
}

export type RateOverrides = Record<string, number | undefined>;

export interface BulkState {
    rows: BulkRow[];
    /** Day chip selection; applied to NEW rows only. */
    activeDate: string;
    payerId: string;
    rateOverrides: RateOverrides;
    /** Set after a failed Save attempt. */
    showErrors: boolean;
    /** Last removed non-blank row, for the undo strip. */
    removed: { row: BulkRow; index: number } | null;
}

export type BulkField = "amount" | "item" | "category" | "rate";

export interface RowErrors {
    amount?: string;
    item?: string;
    category?: string;
    rate?: string;
}

export function createRow(options: {
    date: string;
    isShared: boolean;
    id?: string;
    time?: string;
    currency?: string;
}): BulkRow {
    return {
        id: options.id ?? generateUuid(),
        date: options.date,
        time: options.time ?? getCurrentSingaporeTime(),
        amount: "",
        item: "",
        categoryId: "",
        goalId: null,
        categoryTouched: false,
        isShared: options.isShared,
        tags: [],
        currency: options.currency ?? "SGD",
        touched: { amount: false, item: false },
    };
}

/** Parse the raw amount text. Returns 0 when empty or invalid. */
export function parseAmount(raw: string): number {
    const n = parseFloat(raw.replace(",", "."));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Keep digits and one decimal separator (`,` becomes `.`).
 * Limits decimals to 2 (0 for zero-decimal currencies).
 */
export function sanitizeAmount(raw: string, currency = "SGD"): string {
    const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
    const dot = cleaned.indexOf(".");
    if (dot === -1) return cleaned;
    if (isZeroDecimalCurrency(currency)) return cleaned.slice(0, dot);
    const intPart = cleaned.slice(0, dot);
    const decimals = cleaned
        .slice(dot + 1)
        .replace(/\./g, "")
        .slice(0, 2);
    return `${intPart}.${decimals}`;
}

export function isRowBlank(row: BulkRow): boolean {
    return row.amount.trim() === "" && row.item.trim() === "";
}

export function validateRow(
    row: BulkRow,
    ctx: { rateOverrides: RateOverrides },
): RowErrors {
    if (isRowBlank(row)) return {};
    const errors: RowErrors = {};
    if (parseAmount(row.amount) <= 0) errors.amount = "Enter amount";
    if (!row.item.trim()) errors.item = "Add description";
    if (!row.goalId && !row.categoryId) errors.category = "Pick category";
    if (row.currency !== "SGD") {
        const rate =
            ctx.rateOverrides[row.currency] ?? getDefaultRate(row.currency);
        if (!rate || rate <= 0) errors.rate = "Set rate";
    }
    return errors;
}

export function hasErrors(errors: RowErrors): boolean {
    return Boolean(
        errors.amount || errors.item || errors.category || errors.rate,
    );
}

/** Errors to display for a row: only touched fields, or all after a failed Save. */
export function visibleErrors(
    row: BulkRow,
    errors: RowErrors,
    showErrors: boolean,
): RowErrors {
    if (showErrors) return errors;
    return {
        amount: row.touched.amount ? errors.amount : undefined,
        item: row.touched.item ? errors.item : undefined,
    };
}

export function rowToCreateInput(
    row: BulkRow,
    ctx: { payerId: string; rateOverrides: RateOverrides },
): CreateExpenseInput {
    const num = parseAmount(row.amount);
    return {
        payer_id: ctx.payerId,
        category_id: row.goalId ? null : row.categoryId || null,
        goal_id: row.goalId || null,
        date: row.date,
        time: row.time,
        item: row.item.trim(),
        ...buildExpenseFxFields(
            num,
            row.currency,
            ctx.rateOverrides[row.currency],
        ),
        is_shared: row.isShared,
        // Matches the single-expense form: solo is 0.0, shared is 50/50.
        split_ratio: row.isShared ? 0.5 : 0.0,
        tags: row.tags,
    };
}

export interface BulkSummary {
    /** Valid, non-blank rows. */
    count: number;
    goalCount: number;
    totalSGD: number;
    invalidCount: number;
    blankCount: number;
    firstInvalid: { rowId: string; field: BulkField } | null;
}

export function summarise(
    rows: readonly BulkRow[],
    rateOverrides: RateOverrides,
): BulkSummary {
    let count = 0;
    let goalCount = 0;
    let invalidCount = 0;
    let blankCount = 0;
    let totalSGD = 0;
    let firstInvalid: BulkSummary["firstInvalid"] = null;

    for (const row of rows) {
        if (isRowBlank(row)) {
            blankCount++;
            continue;
        }
        const errors = validateRow(row, { rateOverrides });
        if (hasErrors(errors)) {
            invalidCount++;
            if (!firstInvalid) {
                const field: BulkField = errors.amount
                    ? "amount"
                    : errors.item
                      ? "item"
                      : errors.category
                        ? "category"
                        : "rate";
                firstInvalid = { rowId: row.id, field };
            }
            continue;
        }
        count++;
        if (row.goalId) goalCount++;
        totalSGD += convertToSGD(
            parseAmount(row.amount),
            row.currency,
            rateOverrides[row.currency],
        ).amountInSGD;
    }

    return {
        count,
        goalCount,
        invalidCount,
        blankCount,
        firstInvalid,
        totalSGD: Math.round(totalSGD * 100) / 100,
    };
}

/* ------------------------------------------------------------------ */
/* Reducer                                                             */
/* ------------------------------------------------------------------ */

export type BulkAction =
    | {
          type: "reset";
          payerId: string;
          date: string;
          isShared: boolean;
          rowId?: string;
      }
    | { type: "addRow"; id?: string; isShared: boolean }
    | { type: "removeRow"; id: string; isShared: boolean }
    | { type: "undoRemove" }
    | { type: "dismissUndo" }
    | { type: "updateRow"; id: string; patch: Partial<BulkRow> }
    | {
          type: "setItem";
          id: string;
          item: string;
          /** Result of guessCategoryId(item); ignored once the user picked a category. */
          guessedCategoryId?: string;
      }
    | { type: "setCategory"; id: string; categoryId: string }
    | { type: "setGoal"; id: string; goalId: string }
    | { type: "touch"; id: string; field: "amount" | "item" }
    | { type: "setActiveDate"; date: string }
    | { type: "setPayer"; payerId: string }
    | { type: "setRate"; currency: string; rate: number | undefined }
    | { type: "setShowErrors"; value: boolean };

export function createInitialState(options: {
    payerId: string;
    date: string;
    isShared: boolean;
    rowId?: string;
}): BulkState {
    return {
        rows: [
            createRow({
                date: options.date,
                isShared: options.isShared,
                id: options.rowId,
            }),
        ],
        activeDate: options.date,
        payerId: options.payerId,
        rateOverrides: {},
        showErrors: false,
        removed: null,
    };
}

function mapRow(
    state: BulkState,
    id: string,
    fn: (row: BulkRow) => BulkRow,
): BulkState {
    return {
        ...state,
        rows: state.rows.map((r) => (r.id === id ? fn(r) : r)),
    };
}

export function bulkReducer(state: BulkState, action: BulkAction): BulkState {
    switch (action.type) {
        case "reset":
            return createInitialState(action);
        case "addRow": {
            if (state.rows.length >= MAX_BULK_ROWS) return state;
            return {
                ...state,
                rows: [
                    ...state.rows,
                    createRow({
                        date: state.activeDate,
                        isShared: action.isShared,
                        id: action.id,
                    }),
                ],
            };
        }
        case "removeRow": {
            const index = state.rows.findIndex((r) => r.id === action.id);
            if (index === -1) return state;
            const row = state.rows[index];
            const removed = isRowBlank(row) ? null : { row, index };
            if (state.rows.length === 1) {
                // Never below one row: clear it instead.
                return {
                    ...state,
                    rows: [
                        createRow({
                            date: state.activeDate,
                            isShared: action.isShared,
                            id: row.id,
                        }),
                    ],
                    removed,
                };
            }
            return {
                ...state,
                rows: state.rows.filter((r) => r.id !== action.id),
                removed,
            };
        }
        case "undoRemove": {
            if (!state.removed) return state;
            const { row, index } = state.removed;
            // Restoring into the single cleared row replaces it.
            const base =
                state.rows.length === 1 && isRowBlank(state.rows[0])
                    ? []
                    : state.rows;
            const rows = [...base];
            rows.splice(Math.min(index, rows.length), 0, row);
            return { ...state, rows, removed: null };
        }
        case "dismissUndo":
            return state.removed ? { ...state, removed: null } : state;
        case "updateRow":
            return mapRow(state, action.id, (r) => ({ ...r, ...action.patch }));
        case "setItem":
            return mapRow(state, action.id, (r) => ({
                ...r,
                item: action.item,
                categoryId:
                    !r.categoryTouched && !r.goalId && action.guessedCategoryId
                        ? action.guessedCategoryId
                        : r.categoryId,
            }));
        case "setCategory":
            return mapRow(state, action.id, (r) => ({
                ...r,
                categoryId: action.categoryId,
                goalId: null,
                categoryTouched: true,
            }));
        case "setGoal":
            return mapRow(state, action.id, (r) => ({
                ...r,
                goalId: action.goalId,
                categoryId: "",
                categoryTouched: true,
            }));
        case "touch":
            return mapRow(state, action.id, (r) =>
                r.touched[action.field]
                    ? r
                    : { ...r, touched: { ...r.touched, [action.field]: true } },
            );
        case "setActiveDate":
            return { ...state, activeDate: action.date };
        case "setPayer":
            return { ...state, payerId: action.payerId };
        case "setRate":
            return {
                ...state,
                rateOverrides: {
                    ...state.rateOverrides,
                    [action.currency]: action.rate,
                },
            };
        case "setShowErrors":
            return { ...state, showErrors: action.value };
        default:
            return state;
    }
}
