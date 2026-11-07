import { useEffect, useMemo, useReducer, useRef } from "react";
import {
    bulkReducer,
    createInitialState,
    isRowBlank,
    summarise,
    type BulkState,
    type BulkAction,
    type BulkSummary,
} from "../../../lib/bulkAddRows";
import { getTodayDateString } from "../../../lib/dateUtils";

interface Options {
    isOpen: boolean;
    resolvedPayerId: string;
    isSharedDefault: boolean;
    defaultPayerId?: string;
    defaultShared?: boolean;
}

export interface UseBulkAddRows {
    state: BulkState;
    dispatch: React.Dispatch<BulkAction>;
    summary: BulkSummary;
    isDirty: boolean;
    foreignCurrencies: string[];
}

/** Row state for Bulk Add: reducer, derived summary, reset on open. */
export function useBulkAddRows({
    isOpen,
    resolvedPayerId,
    isSharedDefault,
    defaultPayerId,
    defaultShared,
}: Options): UseBulkAddRows {
    const [state, dispatch] = useReducer(bulkReducer, undefined, () =>
        createInitialState({
            payerId: resolvedPayerId,
            date: getTodayDateString(),
            isShared: isSharedDefault,
        }),
    );

    const prevIsOpenRef = useRef(false);
    const prevPayerPropRef = useRef(defaultPayerId);
    const prevSharedPropRef = useRef(defaultShared);

    useEffect(() => {
        const justOpened = isOpen && !prevIsOpenRef.current;
        const propsChanged =
            defaultPayerId !== prevPayerPropRef.current ||
            defaultShared !== prevSharedPropRef.current;
        if (justOpened || (isOpen && propsChanged)) {
            dispatch({
                type: "reset",
                payerId: resolvedPayerId,
                date: getTodayDateString(),
                isShared: isSharedDefault,
            });
        } else if (isOpen && !state.payerId && resolvedPayerId) {
            dispatch({
                type: "setPayer",
                payerId: resolvedPayerId,
            });
        }
        prevIsOpenRef.current = isOpen;
        prevPayerPropRef.current = defaultPayerId;
        prevSharedPropRef.current = defaultShared;
    }, [
        isOpen,
        defaultPayerId,
        defaultShared,
        resolvedPayerId,
        isSharedDefault,
        state.payerId,
    ]);

    const summary = useMemo(
        () => summarise(state.rows, state.rateOverrides),
        [state.rows, state.rateOverrides],
    );

    const isDirty = useMemo(
        () => state.rows.some((r) => !isRowBlank(r)),
        [state.rows],
    );

    const foreignCurrencies = useMemo(
        () =>
            Array.from(
                new Set(
                    state.rows
                        .map((r) => r.currency)
                        .filter((c) => c && c !== "SGD"),
                ),
            ),
        [state.rows],
    );

    return { state, dispatch, summary, isDirty, foreignCurrencies };
}
