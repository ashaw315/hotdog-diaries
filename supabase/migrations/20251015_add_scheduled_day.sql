-- 20251015_add_scheduled_day.sql

-- 1) Add column if missing
ALTER TABLE public.scheduled_posts
ADD COLUMN IF NOT EXISTS scheduled_day date;

-- 2) Helper function to set scheduled_day from scheduled_post_time (ET)
CREATE OR REPLACE FUNCTION public.set_scheduled_day()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scheduled_post_time IS NOT NULL THEN
    -- scheduled_post_time is stored in UTC; derive ET calendar day
    NEW.scheduled_day := (NEW.scheduled_post_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date;
  ELSE
    NEW.scheduled_day := NULL;
  END IF;
  RETURN NEW;
END $$;

-- 3) Trigger to keep column in sync on insert/update
DROP TRIGGER IF EXISTS trg_scheduled_posts_set_day ON public.scheduled_posts;
CREATE TRIGGER trg_scheduled_posts_set_day
BEFORE INSERT OR UPDATE ON public.scheduled_posts
FOR EACH ROW EXECUTE FUNCTION public.set_scheduled_day();

-- 4) Backfill existing rows
UPDATE public.scheduled_posts
SET scheduled_day = (scheduled_post_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date
WHERE scheduled_day IS NULL AND scheduled_post_time IS NOT NULL;

-- 5) Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_day ON public.scheduled_posts (scheduled_day);
CREATE UNIQUE INDEX IF NOT EXISTS uix_scheduled_posts_day_slot
  ON public.scheduled_posts (scheduled_day, scheduled_slot_index);

-- 6) Ask PostgREST to reload schema cache
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION WHEN OTHERS THEN
  -- safe no-op in environments without postgrest
  NULL;
END $$;