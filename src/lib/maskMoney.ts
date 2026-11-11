import { Children, type ReactNode } from "react";
import { maskSGDText } from "./currency";

/** Masks formatted SGD amounts in string children; leaves other nodes as-is. */
export function maskMoneyNode(node: ReactNode, active: boolean): ReactNode {
    if (!active) return node;
    if (typeof node === "string") return maskSGDText(node);
    if (Array.isArray(node)) {
        return Children.toArray(node).map((child) =>
            typeof child === "string" ? maskSGDText(child) : child,
        );
    }
    return node;
}
