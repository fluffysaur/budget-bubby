/**
 * Hand-written, friendly release notes shown in "What's new".
 *
 * Newest first. Add an entry in every Release PR (see docs/agent-workflow.md
 * §I). Use `items: []` for a silent release with nothing user-facing.
 * Each item: one friendly sentence, a tag, a lucide icon and an optional
 * in-app route for "Try it".
 */

import {
    Accessibility,
    Bell,
    Bot,
    Hash,
    LayoutGrid,
    PartyPopper,
    RefreshCw,
    ShieldCheck,
    Sparkles,
    TrendingUp,
    Zap,
} from "lucide-react";
import type { ReleaseNote } from "../lib/releaseNotes";

export const RELEASE_NOTES: ReleaseNote[] = [
    {
        version: "0.6.0",
        date: "2026-11-25",
        headline: "Fresh tricks",
        items: [
            {
                icon: Sparkles,
                tag: "new",
                text: "Bubby now tells you what's new after each update. Find past notes in Settings.",
            },
            {
                icon: TrendingUp,
                tag: "new",
                text: "Every account shows a tiny trend line of its balance over the last six months.",
                to: "/accounts",
            },
            {
                icon: PartyPopper,
                tag: "new",
                text: "Bubby cheers when you log honestly, and going over budget gets calmer wording.",
                to: "/budget",
            },
            {
                icon: Bot,
                tag: "new",
                text: "Connect OpenRouter in a tap to chat with Bubby AI on free models.",
            },
            {
                icon: LayoutGrid,
                tag: "better",
                text: "Budget cards are tidier, and big amounts shrink to fit instead of spilling over.",
                to: "/budget",
            },
            {
                icon: RefreshCw,
                tag: "better",
                text: "If a save fails or data won't load, you'll see it, with a button to try again.",
            },
            {
                icon: Accessibility,
                tag: "better",
                text: "Bigger tap targets, easier-to-read small text and smoother keyboard focus in pop-ups.",
            },
            {
                icon: Zap,
                tag: "better",
                text: "The app opens a little faster.",
            },
            {
                icon: Bell,
                tag: "fixed",
                text: "Turning on notifications no longer gets stuck, and daily reminders arrive reliably.",
            },
            {
                icon: Hash,
                tag: "fixed",
                text: "Expense tags no longer double up as ##.",
            },
            {
                icon: ShieldCheck,
                tag: "fixed",
                text: "Tighter security, so only your household can ever see your data.",
            },
        ],
    },
];
