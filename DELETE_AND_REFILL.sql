-- ================================================
-- DELETE ROWS WITH WRONG TIMES AND REFILL
-- ================================================
--
-- The existing rows have incorrect scheduled_post_time values
-- due to the old DST timezone bug. Delete them so refill
-- can create new rows with correct times.
-- ================================================

-- Delete all scheduled_posts for 2025-10-29
DELETE FROM public.scheduled_posts
WHERE scheduled_day = '2025-10-29';

-- Verify they're gone
SELECT COUNT(*) as remaining_rows
FROM public.scheduled_posts
WHERE scheduled_day = '2025-10-29';

-- Now go back to the admin UI and click Refill
-- It should create 6 new rows with correct times and content
