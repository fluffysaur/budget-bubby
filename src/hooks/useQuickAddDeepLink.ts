import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { ExpenseFormInitialValues } from "../components/expenses/ExpenseFormModal";
import { parseQuickAddDeepLink, stripQuickAddParams } from "../lib/capture/deepLink";

/**
 * Opens Add Expense from `?action=new` (PWA shortcut, capture fallback),
 * prefilled from the URL, then strips the params so refresh or Back
 * doesn't reopen the form.
 */
export function useQuickAddDeepLink(
    openQuickAdd: (initialValues?: ExpenseFormInitialValues) => void,
): void {
    const location = useLocation();
    const navigate = useNavigate();

    useEffect(() => {
        const values = parseQuickAddDeepLink(location.search);
        if (!values) return;
        openQuickAdd(values);
        navigate(
            {
                pathname: location.pathname,
                search: stripQuickAddParams(location.search),
                hash: location.hash,
            },
            { replace: true },
        );
    }, [location.pathname, location.search, location.hash, navigate, openQuickAdd]);
}
