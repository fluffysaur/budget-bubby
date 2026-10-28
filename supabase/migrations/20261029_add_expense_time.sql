-- Migration: Add time column to expenses table with Singapore timezone backfill
-- Allows intraday chronological ordering and optional time tracking without breaking existing date-based budget queries.

-- 1. Add time column (TIME without time zone, storing 'HH:mm:ss' or 'HH:mm')
ALTER TABLE expenses 
ADD COLUMN IF NOT EXISTS time time without time zone;

-- 2. Backfill existing expenses from created_at in Singapore time (Asia/Singapore)
UPDATE expenses 
SET time = (created_at AT TIME ZONE 'Asia/Singapore')::time
WHERE time IS NULL AND created_at IS NOT NULL;

-- 3. Composite index for performant intraday ledger sorting
CREATE INDEX IF NOT EXISTS idx_expenses_date_time 
ON expenses (household_id, date DESC, time DESC NULLS LAST, created_at DESC);
