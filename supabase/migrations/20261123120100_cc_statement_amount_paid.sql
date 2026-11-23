alter table credit_card_statements
  add column if not exists amount_paid numeric(12, 2);
-- null means the full statement balance was paid
