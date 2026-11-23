create table if not exists member_ai_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  gemini_api_key text,
  gemini_model text,
  updated_at timestamptz not null default now()
);
alter table member_ai_settings enable row level security;
create policy "Owner only" on member_ai_settings for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
