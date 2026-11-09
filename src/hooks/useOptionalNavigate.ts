/**
 * `useNavigate` that returns null outside a router instead of throwing, for
 * components that also render in router-less tests and previews.
 */

import { useInRouterContext, useNavigate } from "react-router-dom";
import type { NavigateFunction } from "react-router-dom";

export function useOptionalNavigate(): NavigateFunction | null {
    const inRouter = useInRouterContext();
    // Router presence is constant for a mounted tree, so the hook order is stable.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return inRouter ? useNavigate() : null;
}
