-- Schema Hardening: scheduled_posts table
-- Add constraints and indexes for data integrity and performance

-- 1. Add status CHECK constraint
ALTER TABLE public.scheduled_posts 
DROP CONSTRAINT IF EXISTS scheduled_posts_status_check;

ALTER TABLE public.scheduled_posts 
ADD CONSTRAINT scheduled_posts_status_check 
CHECK (status IN ('pending', 'posting', 'posted', 'failed'));

-- 2. Add unique index on (scheduled_post_time, platform) to ensure one row per platform per slot
-- Note: Using scheduled_post_time instead of slot_at_utc since that's our actual column
DROP INDEX IF EXISTS public.idx_scheduled_posts_unique_slot_platform;
CREATE UNIQUE INDEX idx_scheduled_posts_unique_slot_platform 
ON public.scheduled_posts (DATE_TRUNC('minute', scheduled_post_time), platform);

-- Alternative approach for exact time matching (if needed)
-- CREATE UNIQUE INDEX idx_scheduled_posts_unique_exact_slot_platform 
-- ON public.scheduled_posts (scheduled_post_time, platform);

-- 3. Add performance indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time 
ON public.scheduled_posts (status, scheduled_post_time) 
WHERE status IN ('pending', 'posting');

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_content_lookup 
ON public.scheduled_posts (content_id) 
WHERE content_id IS NOT NULL;

-- 4. Add a default value for status if not already set
ALTER TABLE public.scheduled_posts 
ALTER COLUMN status SET DEFAULT 'pending';

-- 5. Add a reasonable default for updated_at trigger if the function doesn't exist
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger 
LANGUAGE plpgsql 
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS trg_scheduled_posts_updated_at ON public.scheduled_posts;
CREATE TRIGGER trg_scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW 
  EXECUTE FUNCTION public.set_updated_at();

-- 6. Add helpful indexes for common queries
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform_status 
ON public.scheduled_posts (platform, status);

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_slot_index 
ON public.scheduled_posts (scheduled_slot_index, scheduled_post_time);

-- 7. Performance optimization: partial index for active slots
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_active 
ON public.scheduled_posts (scheduled_post_time, platform, content_id) 
WHERE status = 'pending' AND content_id IS NOT NULL;

-- Force PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');