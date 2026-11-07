export type SpendTone = "ok" | "near" | "over";

export function getSpendTone(pct: number): SpendTone {
    if (pct < 80) return "ok";
    if (pct < 100) return "near";
    return "over";
}
