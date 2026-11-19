-- Per-member Bubby hatch timestamp so each partner hatches their own Bubby
-- independently and sees the other's hatched status across devices.

ALTER TABLE public.household_members
ADD COLUMN IF NOT EXISTS bubby_hatched_at TIMESTAMPTZ;
