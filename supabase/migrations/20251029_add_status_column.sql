-- Add status column to scheduled_posts table
-- This column is required for the posting service to find pending posts

-- Add the status column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'scheduled_posts'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.scheduled_posts
    ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
  END IF;
END $$;

-- Add check constraint
ALTER TABLE public.scheduled_posts
DROP CONSTRAINT IF EXISTS scheduled_posts_status_check;

ALTER TABLE public.scheduled_posts
ADD CONSTRAINT scheduled_posts_status_check
CHECK (status IN ('pending', 'posting', 'posted', 'failed'));

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time
ON public.scheduled_posts (status, scheduled_post_time)
WHERE status IN ('pending', 'posting');

-- Force PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');
