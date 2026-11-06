/**
 * Weekly snack treats. One per completed week, picked in a fixed rotation
 * from the week so both devices agree on which snack a week earned.
 */

import { daysBetween } from "./dates";

export type SnackId = "fish" | "popsicle" | "cake" | "kaya-toast" | "curry-puff" | "dumpling";

export const SNACKS: readonly { id: SnackId; label: string }[] = [
    { id: "fish", label: "Fish" },
    { id: "popsicle", label: "Popsicle" },
    { id: "cake", label: "Cake Slice" },
    { id: "kaya-toast", label: "Kaya Toast" },
    { id: "curry-puff", label: "Curry Puff" },
    { id: "dumpling", label: "Dumpling" },
];

const EPOCH_MONDAY = "2026-01-05";

export function snackForWeek(monday: string): SnackId {
    const weeks = Math.floor(daysBetween(EPOCH_MONDAY, monday) / 7);
    const idx = ((weeks % SNACKS.length) + SNACKS.length) % SNACKS.length;
    return SNACKS[idx].id;
}

export function snackLabel(id: string): string {
    return SNACKS.find((s) => s.id === id)?.label ?? "Snack";
}
