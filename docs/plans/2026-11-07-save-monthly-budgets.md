# Save Monthly Budgets Implementation Plan

Persist monthly budgets and category allocations to Supabase and mock storage so that historical months are locked, past budgets never change when salaries are updated, partner profiles are not conflated, and budget updates are never dropped silently.

## User Review Required

> [!IMPORTANT]
> **RLS & Database Schema**: Supabase tables `monthly_budgets` and `monthly_budget_categories` along with `is_locked` boolean already exist in the schema. Row Level Security policies (`public.is_household_member` on `monthly_budgets` and `public.is_monthly_budget_owner` on `monthly_budget_categories`) allow household members to select, insert, and update rows. No database migration is required.

> [!NOTE]
> **Past Month Definition**: Any month string strictly less than `getCurrentMonth()` (in Singapore timezone, e.g. `'YYYY-MM' < getCurrentMonth()`) is treated as a past month and automatically saved or locked with `is_locked: true`.

---

## Proposed Changes

### 1. `src/services/supabaseFinanceService.ts`

- **Persist on view**: In `getMonthlyBudget(month, memberId)`:
  - If no `monthly_budgets` row exists and the member has a `base_budget_profile`, insert a new row in `monthly_budgets` with a real UUID (`crypto.randomUUID()`) and insert corresponding category rows in `monthly_budget_categories`.
  - Handle race conditions on `unique_owner_month` (`owner_id, month`) by catching duplicate errors and fetching the newly inserted row.
  - Set `is_locked: true` if `month < getCurrentMonth()`.
- **Lock past months**:
  - If a row already exists in `monthly_budgets` with `is_locked: false` but `month < getCurrentMonth()`, update it to `is_locked: true`.
- **Partner without profile isolation**:
  - Stop falling back to `profs[0]` or hard-coded 5,000 gross salary when `base_budget_profiles` is missing for `targetMemberId`.
  - Return an empty "no profile" budget detail with `gross_salary: 0`, `cpf_deduction: 0`, `after_deductions: 0`, `categories: []`, and `notes: 'No base budget profile configured'`.
  - Do not persist an empty stub so that when the partner sets up their base profile, it properly generates on next load.
- **Salary updates isolate to current/future months**:
  - In `saveBaseBudgetProfile`:
    - After saving `base_budget_profiles` and allocations, query all unlocked `monthly_budgets` where `owner_id = ownerId` and `month >= getCurrentMonth()`.
    - For each unlocked current/future budget, update `gross_salary`, `cpf_deduction`, and `after_deductions`, and update/recalculate `monthly_budget_categories`.
    - Past months (`month < getCurrentMonth()`) and locked months (`is_locked: true`) are skipped.
- **Fail loudly on invalid updates**:
  - In `updateMonthlyBudget`: Throw an explicit error if `id` is missing or not a valid UUID, or if the update fails. Never return silently.

---

### 2. `src/services/mockFinanceService.ts`

- Mirror the same logic in mock storage:
  - `getMonthlyBudget`:
    - Lock past months (`is_locked = month < getCurrentMonth()`).
    - Remove `baseProfile = profs[0]` fallback and 5,000 salary fallback; return empty "no profile" budget if member has no base profile.
    - Persist newly created month with real `is_locked` status.
  - `syncUnlockedBudgetsForOwner`:
    - Skip budgets where `budget.is_locked || budget.month < getCurrentMonth()`.
  - `updateMonthlyBudget`:
    - Throw an error if budget id is not found instead of ignoring.

---

### 3. Unit & Integration Tests

- Add unit tests verifying:
  1. `getMonthlyBudget` persists month budgets with real UUIDs.
  2. Past months are marked `is_locked: true`.
  3. Editing base profile / salary updates current and future unlocked months, but leaves past or locked months unchanged.
  4. Partner without base profile receives empty budget and does not inherit the other partner's profile or 5,000 salary.
  5. `updateMonthlyBudget` throws on invalid or nonexistent budget ID.

---

## Verification Plan

### Automated Tests
- Run `npm test` to verify existing and new tests pass.
- Run `npm run lint` to ensure zero errors and zero warnings.
- Run `npm run build` to confirm TypeScript compilation.

### Manual Verification
- In the dev environment, open the Budget page for a past month, verify it is marked locked and historical calculations remain intact after changing base profile in current month.
