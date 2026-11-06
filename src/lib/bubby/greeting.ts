/**
 * App-open greeting copy: ≤4 words, picked from state.
 */

import type { BubbyMood } from "./moods";

export const GREETING_COOLDOWN_MS = 4 * 60 * 60 * 1000;
export const GREETING_VISIBLE_MS = 2500;

export interface GreetingInputs {
    inboxPending: number;
    mood: BubbyMood;
    loggedToday: boolean;
    coupleDayToday: boolean;
    minutes: number;
    checkinMinutes: number;
}

export interface GreetingLine {
    text: string;
    action: "inbox" | "sheet";
}

const LUNCH_START = 11 * 60 + 30;
const LUNCH_END = 14 * 60;

export function pickGreeting(input: GreetingInputs): GreetingLine {
    if (input.inboxPending > 0) return { text: `${input.inboxPending} to sort`, action: "inbox" };
    if (input.mood === "sleepy" || input.mood === "lonely") return { text: "Missed you!", action: "sheet" };
    if (!input.loggedToday && input.minutes >= input.checkinMinutes) {
        return { text: "Log today?", action: "sheet" };
    }
    if (input.minutes < LUNCH_START) return { text: "Morning! ☕", action: "sheet" };
    if (input.minutes < LUNCH_END) return { text: "Makan time?", action: "sheet" };
    if (input.coupleDayToday) return { text: "Couple day ✓", action: "sheet" };
    return { text: "Hi again!", action: "sheet" };
}
