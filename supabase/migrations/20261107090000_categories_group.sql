-- Persist the category mode (Track cap vs Set aside).
-- Nullable on purpose: null means "derive from the category name", so existing rows behave as before.
alter table categories
  add column if not exists "group" text
  check ("group" in ('spendable', 'allocation'));
