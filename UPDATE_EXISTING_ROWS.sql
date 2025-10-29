-- ================================================
-- UPDATE EXISTING ROWS TO HAVE PROPER STATUS
-- ================================================
--
-- Run this in Supabase SQL Editor if rows already exist
-- but don't have content_id set
--
-- This will allow the refill to update them properly
-- ================================================

-- First, let's see what we have
SELECT
  id,
  scheduled_slot_index,
  content_id,
  status,
  platform,
  scheduled_post_time,
  actual_posted_at
FROM public.scheduled_posts
WHERE scheduled_day = '2025-10-29'
ORDER BY scheduled_slot_index;

-- If the above shows rows with content_id = NULL and status = 'pending',
-- the refill should update them. But if it's not working, we can force it:

-- Option 1: Delete all rows for today to force fresh creation
-- DELETE FROM public.scheduled_posts WHERE scheduled_day = '2025-10-29';

-- Option 2: Set content_id to NULL to force refill to see them as incomplete
-- UPDATE public.scheduled_posts
-- SET content_id = NULL, status = 'pending'
-- WHERE scheduled_day = '2025-10-29';
