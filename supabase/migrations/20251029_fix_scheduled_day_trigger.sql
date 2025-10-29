-- Fix the set_scheduled_day() trigger function
-- The old version had a double timezone conversion bug that caused
-- scheduled_day to be calculated incorrectly for evening slots

-- Drop and recreate the trigger function with correct timezone conversion
CREATE OR REPLACE FUNCTION public.set_scheduled_day()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.scheduled_post_time IS NOT NULL THEN
    -- scheduled_post_time is timestamptz (already has timezone info)
    -- Just convert it to America/New_York and extract the date
    -- OLD (BUGGY): (NEW.scheduled_post_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York')::date
    -- This did a double conversion that misinterpreted UTC timestamps
    NEW.scheduled_day := (NEW.scheduled_post_time AT TIME ZONE 'America/New_York')::date;
  ELSE
    NEW.scheduled_day := NULL;
  END IF;
  RETURN NEW;
END $function$;

-- Force PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
