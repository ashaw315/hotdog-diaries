-- STEP 4A: SOFT REBALANCE - NON-DESTRUCTIVE DEPRIORITIZATION
-- 
-- WARNING: Run this ONLY after adding the ingest_priority column!
-- 
-- This script moves excess content to low priority without deleting anything.
-- Scheduler will ignore items with ingest_priority < 0.

-- 1) Identify pixabay overflow (keep 300, deprioritize 347 excess)
WITH pixabay_overflow AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn_keep_oldest
    FROM public.content_queue
    WHERE is_approved = true 
      AND COALESCE(is_posted, false) = false
      AND lower(source_platform) = 'pixabay'
  ) t
  WHERE rn_keep_oldest > 300  -- Keep first 300 by creation date, deprioritize rest
)
UPDATE public.content_queue
SET ingest_priority = -1,
    updated_at = NOW()
WHERE id IN (SELECT id FROM pixabay_overflow);

-- 2) Identify bluesky overflow (keep 300, deprioritize 47 excess)  
WITH bluesky_overflow AS (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (ORDER BY created_at ASC) AS rn_keep_oldest
    FROM public.content_queue
    WHERE is_approved = true 
      AND COALESCE(is_posted, false) = false
      AND lower(source_platform) = 'bluesky'
  ) t
  WHERE rn_keep_oldest > 300  -- Keep first 300 by creation date, deprioritize rest
)
UPDATE public.content_queue
SET ingest_priority = -1,
    updated_at = NOW()
WHERE id IN (SELECT id FROM bluesky_overflow);

-- 3) Verification queries
SELECT 
  lower(source_platform) AS platform,
  COUNT(*) FILTER (WHERE COALESCE(ingest_priority, 0) >= 0) AS active_priority,
  COUNT(*) FILTER (WHERE COALESCE(ingest_priority, 0) < 0) AS deprioritized,
  COUNT(*) AS total_approved_unposted
FROM public.content_queue
WHERE is_approved = true AND COALESCE(is_posted, false) = false
GROUP BY 1
ORDER BY active_priority DESC;
