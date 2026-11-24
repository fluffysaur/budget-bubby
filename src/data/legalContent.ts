/**
 * Legal page copy for Budget Bubby (privacy policy and terms).
 *
 * Plain-language copy approved by the owner. It is not lawyer-reviewed.
 * Re-check each claim against what the app does whenever features change
 * (issue #234).
 */

export interface LegalSection {
    heading: string;
    paragraphs?: string[];
    bullets?: string[];
}

export interface LegalDocument {
    title: string;
    summary: string;
    sections: LegalSection[];
}

export const LEGAL_LAST_UPDATED = "24th November 2026";

export const LEGAL_CONTACT = {
    owner: "Tan Yi Jia",
    email: "tanyijia@gmail.com",
};

export const PRIVACY_POLICY: LegalDocument = {
    title: "Privacy Policy",
    summary:
        "Budget Bubby helps a household track money together. This page explains what we store and why.",
    sections: [
        {
            heading: "Who We Are",
            paragraphs: [
                `Budget Bubby is run by ${LEGAL_CONTACT.owner} ("we"). Contact us at ${LEGAL_CONTACT.email}.`,
            ],
        },
        {
            heading: "What We Store",
            paragraphs: [
                "When you use a live household, this data is stored in our database:",
            ],
            bullets: [
                "Account and household details: names, member roles and your sign-in identity.",
                "Money data you enter: expenses, budgets, categories, accounts and balances, credit cards, loans, goals, recurring items and bonus splits.",
                "Inbox items captured from bank notifications you choose to forward.",
                "Reminder settings, and push subscription details (endpoint and device or browser type) if you turn on notifications.",
            ],
        },
        {
            heading: "Not Stored",
            paragraphs: [
                "We do not connect to your bank accounts. Balances and transactions are only what you or your household type in or forward to us.",
                "Demo mode uses sample data in your browser only. Nothing from demo mode is sent to us.",
            ],
        },
        {
            heading: "How We Use It",
            bullets: [
                "To show your household its budgets, spending and goals.",
                "To sync changes between household members.",
                "To send reminders you have switched on.",
            ],
            paragraphs: ["We do not sell your data and we do not show ads."],
        },
        {
            heading: "Who Sees It",
            paragraphs: [
                "Members of your household can see the shared data of that household. Other households cannot. Our database enforces this with row-level access rules.",
                "Only the owner can access production data, and only to fix a problem you report.",
            ],
        },
        {
            heading: "Third Parties",
            bullets: [
                "Supabase: hosts the database and sign-in.",
                "Vercel: hosts the app.",
                "Exchange rate service (open.er-api.com): the app requests public currency rates. No personal data is sent beyond the IP address that any web request carries.",
                "Browser push services (Google, Apple, Mozilla): they deliver encrypted reminder notifications to your device if you turn them on.",
                "AI providers (optional): Google Gemini, Anthropic, OpenAI and OpenRouter are used only if you add your own key. Requests go directly from your browser to the provider you pick, and include your question and the finance context needed to answer it. Their terms and privacy policies apply.",
            ],
            paragraphs: [
                "We do not currently use analytics or advertising trackers.",
            ],
        },
        {
            heading: "On Your Device",
            paragraphs: [
                "The app stores preferences, a sign-in session and an offline copy of recent data in your browser. If you use Bubby chat, your AI provider keys and model choices are also kept in your browser storage and are not saved in our database. Clearing site data removes all of this.",
            ],
        },
        {
            heading: "Retention",
            paragraphs: [
                "We keep your data while your household is active. Self-service export and account deletion are planned but not available yet. Until then, email us and we will export or delete your data within 30 days.",
            ],
        },
        {
            heading: "Your Choices",
            paragraphs: [
                `You can ask to see, correct, export or delete your data at ${LEGAL_CONTACT.email}.`,
            ],
        },
        {
            heading: "Changes",
            paragraphs: [
                "We will update this page when things change and note the date at the top.",
            ],
        },
    ],
};

export const TERMS_OF_USE: LegalDocument = {
    title: "Terms of Use",
    summary: "The simple rules for using Budget Bubby.",
    sections: [
        {
            heading: "Using Bubby",
            paragraphs: [
                "By using Budget Bubby you agree to these terms. If you do not agree, please do not use it.",
                "You must be at least 16 years old, and old enough to enter a contract where you live.",
            ],
        },
        {
            heading: "Your Account",
            bullets: [
                "Keep your PIN and sign-in details private.",
                "You are responsible for activity under your account and for the people you add to your household.",
                "Give us accurate information when you sign up.",
            ],
        },
        {
            heading: "Your Data",
            paragraphs: [
                "You own the data you enter. You give us permission to store and process it only to run the app for you, as described in the Privacy Policy.",
            ],
        },
        {
            heading: "Not Advice",
            paragraphs: [
                "Budget Bubby is a tracking tool. Figures, projections and AI answers are estimates and not financial, tax or legal advice. Check important numbers yourself.",
            ],
        },
        {
            heading: "Acceptable Use",
            bullets: [
                "Do not break, overload or probe the service.",
                "Do not access data that is not yours.",
                "Do not use the app for anything unlawful.",
            ],
        },
        {
            heading: "Availability",
            paragraphs: [
                "We try to keep the app running but do not promise it will always be available or error free. Features may change or end, and we will try to give reasonable notice of major changes.",
            ],
        },
        {
            heading: "Liability",
            paragraphs: [
                'The app is provided "as is". To the extent the law allows, we are not liable for losses from using it.',
            ],
        },
        {
            heading: "Ending Use",
            paragraphs: [
                "You can stop using the app at any time. We may suspend accounts that break these terms. See the Privacy Policy for how to ask for deletion.",
            ],
        },
        {
            heading: "Law & Contact",
            paragraphs: [
                `These terms are governed by the laws of Singapore. Questions: ${LEGAL_CONTACT.email}.`,
            ],
        },
    ],
};

export type LegalDocKey = "privacy" | "terms";

export const LEGAL_DOCS: Record<LegalDocKey, LegalDocument> = {
    privacy: PRIVACY_POLICY,
    terms: TERMS_OF_USE,
};

export const LEGAL_PATHS: Record<LegalDocKey, string> = {
    privacy: "/privacy",
    terms: "/terms",
};
