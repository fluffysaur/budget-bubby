/**
 * Demo household sign-in emails, kept apart from the lazily loaded seed data
 * so auth can pick a demo member without pulling the seed into the bundle.
 * The first email is the default demo member.
 */
export const DEMO_MEMBER_EMAILS = [
    "alex@example.com",
    "sam@example.com",
] as const;
