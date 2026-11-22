-- Enable Supabase Realtime publication for expenses and inbox_items
-- Idempotent DO $$ block: adds tables only if not already present in pg_publication_tables for supabase_realtime

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'expenses'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'inbox_items'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.inbox_items;
    END IF;
END $$;
