-- ================================================
-- RUN THIS SQL IN SUPABASE SQL EDITOR
-- ================================================
--
-- Go to: https://supabase.com/dashboard/project/_/sql
-- Copy and paste this entire file
-- Click "Run"
--
-- This adds the required 'status' column to scheduled_posts table
-- ================================================

-- Step 1: Add the status column with default value 'pending'
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

    RAISE NOTICE 'Added status column to scheduled_posts';
  ELSE
    RAISE NOTICE 'Status column already exists';
  END IF;
END $$;

-- Step 2: Add check constraint for valid status values
ALTER TABLE public.scheduled_posts
DROP CONSTRAINT IF EXISTS scheduled_posts_status_check;

ALTER TABLE public.scheduled_posts
ADD CONSTRAINT scheduled_posts_status_check
CHECK (status IN ('pending', 'posting', 'posted', 'failed'));

-- Step 3: Add index for performance
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status_time
ON public.scheduled_posts (status, scheduled_post_time)
WHERE status IN ('pending', 'posting');

-- Step 4: Force PostgREST to reload schema cache
SELECT pg_notify('pgrst', 'reload schema');

-- Verify the column was added
SELECT
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'scheduled_posts'
  AND column_name = 'status';
