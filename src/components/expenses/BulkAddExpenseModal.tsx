/**
 * Bulk Add Expense Modal
 * Catch up on a few days of missed expenses:
 * - Day chips set the date for new rows (each row keeps its own date)
 * - Rows: amount, description, auto-guessed category (tap to change)
 * - "More" per row: split, foreign currency, tags
 * - Mobile cards with a sticky Save bar, desktop table
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListPlus, Undo2 } from "lucide-react";
import { AnimatedModal, ModalHeader, ModalBody } from "../ui/AnimatedModal";
import { Alert } from "../ui/Alert";
import { Select } from "../ui/Select";
import { financeService, isMockModeActive } from "../../services/financeService";
import { useOptionalHousehold } from "../../context/HouseholdContext";
import { useAuth } from "../../context/AuthContext";
import { useFxRates } from "../../hooks/useFxRates";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { mockCategories, mockMembers } from "../../data/mockSeedData";
import {
    MAX_BULK_ROWS,
    parseAmount,
    type BulkSummary,
} from "../../lib/bulkAddRows";
import { generateUuid } from "../../lib/uuid";
import type {
    Expense,
    Category,
    HouseholdMember,
    SavingsGoal,
} from "../../types/finance";
import { DayChips } from "./bulk-add/DayChips";
import { BulkRowCard } from "./bulk-add/BulkRowCard";
import { BulkRowTableRow } from "./bulk-add/BulkRowTableRow";
import { BulkAddFooterBar } from "./bulk-add/BulkAddFooterBar";
import { useBulkAddRows } from "./bulk-add/useBulkAddRows";
import { useBulkAddSubmit } from "./bulk-add/useBulkAddSubmit";

export interface BulkAddExpenseModalProps {
    isOpen: boolean;
    onClose: () => void;
    onExpensesAdded?: (expenses: Expense[]) => void;
    categories?: Category[];
    members?: HouseholdMember[];
    goals?: SavingsGoal[];
    defaultPayerId?: string;
    defaultShared?: boolean;
}

type RowField = "amount" | "item";

export function BulkAddExpenseModal({
    isOpen,
    onClose,
    onExpensesAdded,
    categories: propCategories,
    members: propMembers,
    goals: propGoals,
    defaultPayerId,
    defaultShared,
}: BulkAddExpenseModalProps) {
    const household = useOptionalHousehold();
    const { loggedInPartner } = useAuth();
    const isMockMode = household?.isMockMode ?? isMockModeActive();
    const ctxMembers = household?.members;

    const categories = useMemo(
        () =>
            propCategories && propCategories.length > 0
                ? propCategories
                : isMockMode
                  ? mockCategories
                  : [],
        [propCategories, isMockMode],
    );
    const members = useMemo(
        () =>
            propMembers && propMembers.length > 0
                ? propMembers
                : ctxMembers && ctxMembers.length > 0
                  ? ctxMembers
                  : isMockMode
                    ? mockMembers
                    : [],
        [propMembers, ctxMembers, isMockMode],
    );

    const perspective = household?.perspective ?? "household";
    const activeMember = household?.activeMember ?? null;

    // 50/50 in combined view, Solo in member view
    const isSharedDefault = useMemo(() => {
        if (defaultShared !== undefined) return defaultShared;
        return perspective === "household";
    }, [defaultShared, perspective]);

    // Active member on member view, logged in partner on combined view, or first member
    const resolvedDefaultPayerId = useMemo(() => {
        if (defaultPayerId) return defaultPayerId;
        if (activeMember) return activeMember.id;
        if (loggedInPartner) {
            const match = members.find((m) =>
                m.display_name
                    .toLowerCase()
                    .includes(loggedInPartner.toLowerCase()),
            );
            if (match) return match.id;
        }
        return members[0]?.id || "";
    }, [defaultPayerId, activeMember, loggedInPartner, members]);

    const [activeGoals, setActiveGoals] = useState<SavingsGoal[]>(
        propGoals || [],
    );
    useEffect(() => {
        if (propGoals && propGoals.length > 0) {
            setActiveGoals(propGoals);
        } else if (isOpen) {
            financeService
                .getGoals()
                .then((g) => {
                    if (g) setActiveGoals(g);
                })
                .catch((err) => {
                    console.error(
                        "Failed to load goals in BulkAddExpenseModal:",
                        err,
                    );
                });
        }
    }, [propGoals, isOpen]);

    const { state, dispatch, summary, isDirty, foreignCurrencies } =
        useBulkAddRows({
            isOpen,
            resolvedPayerId: resolvedDefaultPayerId,
            isSharedDefault,
            defaultPayerId,
            defaultShared,
        });
    useFxRates(foreignCurrencies.length > 0);

    const isDesktop = useMediaQuery("(min-width: 640px)");
    const showDateColumn = useMediaQuery("(min-width: 768px)");

    const [localError, setLocalError] = useState<string | null>(null);

    /* ---------------- focus management ---------------- */
    const inputRefs = useRef(
        new Map<string, Partial<Record<RowField, HTMLInputElement | null>>>(),
    );
    const pendingFocusRef = useRef<{
        rowId: string;
        field: RowField;
    } | null>(null);
    const rowsRef = useRef(state.rows);
    useEffect(() => {
        rowsRef.current = state.rows;
    }, [state.rows]);

    const registerRef = useCallback(
        (rowId: string, field: RowField, el: HTMLInputElement | null) => {
            const entry = inputRefs.current.get(rowId) ?? {};
            entry[field] = el;
            inputRefs.current.set(rowId, entry);
        },
        [],
    );

    const focusField = useCallback((rowId: string, field: RowField) => {
        const el = inputRefs.current.get(rowId)?.[field];
        if (!el) return false;
        el.focus({ preventScroll: true });
        window.requestAnimationFrame(() =>
            el.scrollIntoView?.({ block: "nearest" }),
        );
        return true;
    }, []);

    // Open: focus the first row's amount once the fresh rows have mounted
    const firstRowId = state.rows[0]?.id;
    useEffect(() => {
        if (isOpen && firstRowId) {
            pendingFocusRef.current = { rowId: firstRowId, field: "amount" };
        }
    }, [isOpen, firstRowId]);

    useEffect(() => {
        const pending = pendingFocusRef.current;
        if (pending && focusField(pending.rowId, pending.field)) {
            pendingFocusRef.current = null;
        }
    }, [state.rows, isDesktop, focusField]);

    /* ---------------- row actions ---------------- */
    const addRow = useCallback(() => {
        if (rowsRef.current.length >= MAX_BULK_ROWS) return;
        const id = generateUuid();
        pendingFocusRef.current = { rowId: id, field: "amount" };
        setLocalError(null);
        dispatch({ type: "addRow", id, isShared: isSharedDefault });
    }, [dispatch, isSharedDefault]);

    const onAmountEnter = useCallback(
        (rowId: string) => {
            focusField(rowId, "item");
        },
        [focusField],
    );

    const onItemEnter = useCallback(
        (rowId: string) => {
            const rows = rowsRef.current;
            const idx = rows.findIndex((r) => r.id === rowId);
            if (idx === -1) return;
            if (idx < rows.length - 1) {
                focusField(rows[idx + 1].id, "amount");
                return;
            }
            const row = rows[idx];
            if (parseAmount(row.amount) > 0 && row.item.trim()) {
                addRow();
            } else {
                dispatch({ type: "touch", id: rowId, field: "amount" });
                dispatch({ type: "touch", id: rowId, field: "item" });
            }
        },
        [addRow, dispatch, focusField],
    );

    const onRemove = useCallback(
        (rowId: string) =>
            dispatch({
                type: "removeRow",
                id: rowId,
                isShared: isSharedDefault,
            }),
        [dispatch, isSharedDefault],
    );

    // Undo strip lasts 4 seconds
    useEffect(() => {
        if (!state.removed) return;
        const t = window.setTimeout(
            () => dispatch({ type: "dismissUndo" }),
            4000,
        );
        return () => window.clearTimeout(t);
    }, [state.removed, dispatch]);

    /* ---------------- save ---------------- */
    const handleSaved = useCallback(
        (created: Expense[]) => {
            onExpensesAdded?.(created);
            onClose();
        },
        [onExpensesAdded, onClose],
    );

    const handleInvalid = useCallback(
        (target: BulkSummary["firstInvalid"]) => {
            if (!target) {
                setLocalError("Add at least one expense.");
                return;
            }
            setLocalError(null);
            focusField(
                target.rowId,
                target.field === "amount" ? "amount" : "item",
            );
        },
        [focusField],
    );

    const { submit, isSubmitting, errorMessage, clearError } = useBulkAddSubmit(
        {
            state,
            summary,
            dispatch,
            onSaved: handleSaved,
            onInvalid: handleInvalid,
        },
    );

    const handleSave = useCallback(() => {
        setLocalError(null);
        clearError();
        void submit();
    }, [submit, clearError]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSave();
        }
    };

    const memberOptions = useMemo(
        () =>
            members.map((m) => ({
                value: m.id,
                label: `${m.avatar_url || "👤"} ${m.display_name}`,
            })),
        [members],
    );

    const alertMessage = errorMessage ?? localError;
    const columnCount = showDateColumn ? 6 : 5;

    const rowProps = {
        categories,
        goals: activeGoals,
        rateOverrides: state.rateOverrides,
        showErrors: state.showErrors,
        dispatch,
        registerRef,
        onAmountEnter,
        onItemEnter,
        onRemove,
        disabled: isSubmitting,
    };

    return (
        <AnimatedModal
            isOpen={isOpen}
            onClose={onClose}
            maxWidth="max-w-4xl"
            isDrawerOnMobile
            isDirty={isDirty}
        >
            <div
                className="flex min-h-0 flex-1 flex-col overflow-hidden"
                onKeyDown={handleKeyDown}
            >
                <ModalHeader
                    title="Bulk Add"
                    icon={
                        <ListPlus className="h-4.5 w-4.5" strokeWidth={2.5} />
                    }
                    iconBgColor="bg-(--pastel-lilac-light)"
                    onClose={onClose}
                />

                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-(--border-subtle) bg-(--bg-card) px-4 py-2.5 sm:px-6">
                    <DayChips
                        value={state.activeDate}
                        onChange={(date) =>
                            dispatch({ type: "setActiveDate", date })
                        }
                        disabled={isSubmitting}
                    />
                    {members.length > 1 && (
                        <div className="w-40 min-w-0">
                            <Select
                                aria-label="Payer for all expenses"
                                value={state.payerId}
                                options={memberOptions}
                                sizeVariant="sm"
                                className="min-h-11 text-base! sm:text-xs!"
                                disabled={isSubmitting}
                                onChange={(e) =>
                                    dispatch({
                                        type: "setPayer",
                                        payerId: e.target.value,
                                    })
                                }
                            />
                        </div>
                    )}
                </div>

                <ModalBody className="space-y-3">
                    {alertMessage && (
                        <Alert variant="danger">{alertMessage}</Alert>
                    )}

                    {isDesktop ? (
                        <table className="w-full table-fixed text-sm">
                            <colgroup>
                                {showDateColumn && <col className="w-32" />}
                                <col className="w-28" />
                                <col />
                                <col className="w-44" />
                                <col className="w-20" />
                                <col className="w-14" />
                            </colgroup>
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-wider text-(--text-muted)">
                                    {showDateColumn && (
                                        <th className="px-1.5 pb-1">Date</th>
                                    )}
                                    <th className="px-1.5 pb-1">Amount</th>
                                    <th className="px-1.5 pb-1">Description</th>
                                    <th className="px-1.5 pb-1">Category</th>
                                    <th className="px-1.5 pb-1">
                                        <span className="sr-only">More</span>
                                    </th>
                                    <th className="px-1.5 pb-1">
                                        <span className="sr-only">Remove</span>
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {state.rows.map((row, index) => (
                                    <BulkRowTableRow
                                        key={row.id}
                                        row={row}
                                        index={index}
                                        showDateColumn={showDateColumn}
                                        columnCount={columnCount}
                                        {...rowProps}
                                    />
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <ol className="space-y-3">
                            {state.rows.map((row, index) => (
                                <BulkRowCard
                                    key={row.id}
                                    row={row}
                                    index={index}
                                    {...rowProps}
                                />
                            ))}
                        </ol>
                    )}

                    {state.removed && (
                        <div
                            role="status"
                            className="flex items-center justify-between gap-2 rounded-xl border-2 border-(--border-ink) bg-(--pastel-butter-light) px-3 py-1.5 text-sm font-bold text-(--text-ink)"
                        >
                            <span>Row removed</span>
                            <button
                                type="button"
                                onClick={() => dispatch({ type: "undoRemove" })}
                                className="flex min-h-11 shrink-0 items-center gap-1 px-2"
                            >
                                <Undo2 className="h-4 w-4" strokeWidth={2.5} />
                                Undo
                            </button>
                        </div>
                    )}
                </ModalBody>

                <BulkAddFooterBar
                    summary={summary}
                    isSubmitting={isSubmitting}
                    canAddRow={state.rows.length < MAX_BULK_ROWS}
                    onAddRow={addRow}
                    onSave={handleSave}
                />
            </div>
        </AnimatedModal>
    );
}
