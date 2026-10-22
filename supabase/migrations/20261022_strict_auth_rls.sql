-- ==============================================================================
-- Budget Buddy: Strict Authentication & Row-Level Security (RLS)
-- Restricts household access exclusively to authenticated household members.
-- Revokes all public/anonymous access (auth.uid() is null).
-- ==============================================================================

-- 1. Helper function to check if the current authenticated user belongs to the target household
create or replace function public.is_household_member(target_household_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = target_household_id
      and hm.user_id = auth.uid()
  );
$$;

-- 2. Helper function to check if the current authenticated user is a profile owner
create or replace function public.is_profile_owner(target_profile_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.base_budget_profiles bbp
    join public.household_members hm on hm.household_id = bbp.household_id
    where bbp.id = target_profile_id
      and hm.user_id = auth.uid()
  );
$$;

-- 3. Helper function to check if the current authenticated user is a monthly budget owner
create or replace function public.is_monthly_budget_owner(target_monthly_budget_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.monthly_budgets mb
    join public.household_members hm on hm.household_id = mb.household_id
    where mb.id = target_monthly_budget_id
      and hm.user_id = auth.uid()
  );
$$;

-- 4. Helper function to check if the current authenticated user is a loan owner
create or replace function public.is_loan_household_member(target_loan_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.loans l
    join public.household_members hm on hm.household_id = l.household_id
    where l.id = target_loan_id
      and hm.user_id = auth.uid()
  );
$$;

-- 5. RPC to link the authenticated auth.users account to the matching household_member row
create or replace function public.claim_household_member_profile(user_email text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  matched_member record;
begin
  if current_user_id is null then
    return json_build_object('success', false, 'error', 'Unauthenticated');
  end if;

  -- Attempt to match by email (case-insensitive)
  select * into matched_member
  from public.household_members
  where lower(email) = lower(user_email)
  limit 1;

  if matched_member.id is not null then
    -- Link user_id if not linked yet
    if matched_member.user_id is null or matched_member.user_id != current_user_id then
      update public.household_members
      set user_id = current_user_id
      where id = matched_member.id;
    end if;

    return json_build_object(
      'success', true,
      'member_id', matched_member.id,
      'display_name', matched_member.display_name,
      'role', matched_member.role
    );
  end if;

  return json_build_object('success', false, 'error', 'Member profile not found for email');
end;
$$;

-- ==============================================================================
-- Update Row-Level Security Policies (Removing auth.uid() is null)
-- ==============================================================================

-- 1. Households
drop policy if exists "Allow household access" on households;
create policy "Allow household access" on households for all
using (
  auth.uid() is not null
  and public.is_household_member(id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(id)
);

-- 2. Household Members
drop policy if exists "Allow household member access" on household_members;
create policy "Allow household member access" on household_members for all
using (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  )
)
with check (
  auth.uid() is not null
  and (
    user_id = auth.uid()
    or public.is_household_member(household_id)
  )
);

-- 3. Accounts
drop policy if exists "Allow household access" on accounts;
create policy "Allow household access" on accounts for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 4. Account Snapshots
drop policy if exists "Allow household access" on account_snapshots;
create policy "Allow household access" on account_snapshots for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 5. Base Budget Profiles
drop policy if exists "Allow household access" on base_budget_profiles;
create policy "Allow household access" on base_budget_profiles for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 6. Categories
drop policy if exists "Allow household access" on categories;
create policy "Allow household access" on categories for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 7. Base Profile Allocations
drop policy if exists "Allow household access" on base_profile_allocations;
create policy "Allow household access" on base_profile_allocations for all
using (
  auth.uid() is not null
  and public.is_profile_owner(profile_id)
)
with check (
  auth.uid() is not null
  and public.is_profile_owner(profile_id)
);

-- 8. Monthly Budgets
drop policy if exists "Allow household access" on monthly_budgets;
create policy "Allow household access" on monthly_budgets for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 9. Monthly Budget Categories
drop policy if exists "Allow household access" on monthly_budget_categories;
create policy "Allow household access" on monthly_budget_categories for all
using (
  auth.uid() is not null
  and public.is_monthly_budget_owner(monthly_budget_id)
)
with check (
  auth.uid() is not null
  and public.is_monthly_budget_owner(monthly_budget_id)
);

-- 10. Expenses
drop policy if exists "Allow household access" on expenses;
create policy "Allow household access" on expenses for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 11. Loans
drop policy if exists "Allow household access" on loans;
create policy "Allow household access" on loans for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 12. Loan Payments
drop policy if exists "Allow household access" on loan_payments;
create policy "Allow household access" on loan_payments for all
using (
  auth.uid() is not null
  and public.is_loan_household_member(loan_id)
)
with check (
  auth.uid() is not null
  and public.is_loan_household_member(loan_id)
);

-- 13. Savings Goals
drop policy if exists "Allow household access" on savings_goals;
create policy "Allow household access" on savings_goals for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

-- 14. Recurring Policies
drop policy if exists "Allow household access" on recurring_policies;
create policy "Allow household access" on recurring_policies for all
using (
  auth.uid() is not null
  and public.is_household_member(household_id)
)
with check (
  auth.uid() is not null
  and public.is_household_member(household_id)
);

