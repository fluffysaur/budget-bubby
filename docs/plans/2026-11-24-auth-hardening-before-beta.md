# Auth hardening before the public beta

Status: proposed (app-audit 2026-11-24). It blocks opening signups for #222. Not started.

## Goal

Before any stranger can create an account, linking a member and joining a household must require proof: a verified identity for linking, and an invite for joining.

## Context

Today accounts are created by hand, and signups are off. Member linking and household membership were designed for a closed, two-person household. The public beta (#222), invite codes (#226), partner invite links (#227) and email OTP (#225) all assume that new, unknown users exist. The rules below have to hold before those land.

## Steps

1. **Member-profile linking uses only server-verified identity.** `claim_household_member_profile` should take no identity input from the client. Read the email from `auth.jwt()`, require it to be confirmed, and link only a member row that is still unlinked. Rows that are already linked are never re-pointed. Update the callers in `src/context/AuthContext.tsx:83` and `src/services/supabaseFinanceService.ts:384`, keeping the old signature as a compat wrapper for one release (live-DB rule).
2. **Split `household_members` RLS by command.**
   - SELECT: own row, or any row in a household you belong to.
   - INSERT: none directly. New members come only through an invite RPC (#227) or the onboarding RPC (#224).
   - UPDATE: own profile fields only, and `household_id` and `user_id` are immutable (a trigger or column-level check).
   - DELETE: own row only, or deferred to #232.
3. **Audit the other `for all` policies** in `supabase/migrations/20261022_strict_auth_rls.sql` for the same pattern, where a `with check` has an `OR` that lets a row move into a different household.
4. **Extend #235** (cross-household RLS tests) with cases for steps 1–2: claiming a linked row fails, inserting into another household fails, and changing `household_id` fails.

## Files touched

A new migration in `supabase/migrations/`, `src/context/AuthContext.tsx`, `src/services/supabaseFinanceService.ts`, and the RLS tests from #235.

## Risks

- **Live DB used daily by both partners.** Ship the migration additive-first: new function plus compat wrapper, then the policy swap. Test it against a local Supabase with a copy of the schema before the user applies it. No changes through MCP.
- **Locking out the existing two members.** Both rows are already linked, so step 1 must be a no-op for them. Verify by signing in on both devices (Android and iPhone) after the migration.
- **Onboarding.** Until #224 or #227 lands, nothing can insert member rows. That is fine while signups stay off, so keep them off until this plan and #224/#227 have shipped.

## Test plan

- SQL tests (the #235 harness): each step-2 rule, run as two separate test users in two households.
- Unit: the auth context still links on first sign-in for an unlinked, confirmed email.
- Manual: both existing members sign in and see household data after the migration.
- `npm run check` and `npm run test:e2e`.
