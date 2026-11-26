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
    ChevronsUpDown,
    CreditCard,
    Hash,
    LayoutGrid,
    ListFilter,
    PartyPopper,
    RefreshCw,
    Settings,
    ShieldCheck,
    Smartphone,
    Sparkles,
    TrendingUp,
    Wallet,
    Zap,
} from "lucide-react";
import type { ReleaseNote } from "../lib/releaseNotes";

export const RELEASE_NOTES: ReleaseNote[] = [
    {
        version: "0.7.0",
        date: "2026-11-26",
        headline: "Tidier everywhere",
        items: [
            {
                icon: ListFilter,
                tag: "new",
                text: "Filter your expenses by several categories at once.",
                to: "/expenses",
            },
            {
                icon: Settings,
                tag: "better",
                text: "Settings now has its own page, grouped so things are easier to find.",
                to: "/settings",
            },
            {
                icon: ChevronsUpDown,
                tag: "better",
                text: "New dropdowns slide up from the bottom on phones, and long lists can be searched.",
            },
            {
                icon: Wallet,
                tag: "better",
                text: "Update Balances fits more accounts on screen and shows how much each one changed.",
                to: "/accounts",
            },
            {
                icon: CreditCard,
                tag: "better",
                text: "Adding accounts and cards is simpler, and you can type any bank name for a card.",
                to: "/accounts",
            },
            {
                icon: ShieldCheck,
                tag: "fixed",
                text: "Home now matches Budget, showing when your Buffer covers an overspend.",
                to: "/dashboard",
            },
            {
                icon: Smartphone,
                tag: "fixed",
                text: "The push notification setting now fits neatly on phone screens.",
            },
        ],
    },
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
