alter table accounts
  add column if not exists is_new_account boolean;
-- true: funded from tracked accounts, so the reality check counts it from $0
-- null/false: money not tracked before, so its opening balance isn't savings
