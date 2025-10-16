-- EMERGENCY ROLLBACK: Reset all content priorities
-- Run this if rebalancing causes immediate issues

UPDATE public.content_queue 
SET ingest_priority = 0,
    updated_at = NOW()
WHERE ingest_priority < 0;

-- Verification query
SELECT 'ROLLBACK COMPLETE - Platform Distribution:' AS status;
SELECT 
  lower(source_platform) AS platform,
  COUNT(*) AS items
FROM public.content_queue
WHERE is_approved = true AND COALESCE(is_posted, false) = false
GROUP BY 1
ORDER BY 2 DESC;
