-- Link recurring items to savings goals with a relative month offset
alter table recurring_items
    add column if not exists goal_id uuid references savings_goals (id) on delete set null,
    add column if not exists goal_offset_months integer;
