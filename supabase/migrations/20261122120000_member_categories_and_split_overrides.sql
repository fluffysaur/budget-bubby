-- Support member-specific categories and per-member shared expense categorization
alter table categories add column if not exists member_id uuid references household_members(id) on delete cascade;

alter table categories drop constraint if exists unique_household_category_name;

create unique index if not exists idx_categories_shared_unique_name
    on categories (household_id, name)
    where member_id is null;

create unique index if not exists idx_categories_member_unique_name
    on categories (household_id, member_id, name)
    where member_id is not null;

alter table expenses add column if not exists partner_category_id uuid references categories(id) on delete set null;
