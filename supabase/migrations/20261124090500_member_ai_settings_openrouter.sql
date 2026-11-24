alter table member_ai_settings
  add column if not exists openrouter_api_key text,
  add column if not exists openrouter_model text,
  add column if not exists active_provider text;
