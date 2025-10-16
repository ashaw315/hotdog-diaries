-- STEP 2: ADD INGEST_PRIORITY COLUMN MIGRATION
-- 
-- This migration adds the ingest_priority column to content_queue table
-- to enable soft rebalancing of platform distribution.
--
-- Run this BEFORE executing soft_rebalance_commands.sql
-- 
-- Author: DevOps Team
-- Date: 2025-10-16
-- Purpose: Fix 99.4% platform imbalance in content pool

-- 1. Add the ingest_priority column with default value of 0
ALTER TABLE public.content_queue 
ADD COLUMN IF NOT EXISTS ingest_priority INTEGER DEFAULT 0;

-- 2. Add an index for efficient filtering by priority
CREATE INDEX IF NOT EXISTS idx_content_queue_ingest_priority 
ON public.content_queue(ingest_priority);

-- 3. Add a composite index for scheduler queries
CREATE INDEX IF NOT EXISTS idx_content_queue_scheduler_priority 
ON public.content_queue(is_approved, is_posted, ingest_priority) 
WHERE is_approved = true AND is_posted = false;

-- 4. Add comment explaining the column
COMMENT ON COLUMN public.content_queue.ingest_priority IS 
'Priority for content ingestion. Positive values = active in scheduler, negative = deprioritized for rebalancing, 0 = default';

-- 5. Verification query - check column was added successfully
SELECT 
  column_name,
  data_type,
  column_default,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name = 'content_queue' 
  AND column_name = 'ingest_priority';

-- Expected output:
-- column_name     | data_type | column_default | is_nullable
-- ----------------+-----------+----------------+-------------
-- ingest_priority | integer   | 0              | YES

-- 6. Check current distribution (before rebalancing)
SELECT 
  'BEFORE REBALANCING:' as status,
  lower(source_platform) AS platform,
  COUNT(*) AS total_items
FROM public.content_queue
WHERE is_approved = true AND COALESCE(is_posted, false) = false
GROUP BY 2
ORDER BY 3 DESC;

-- 7. Safety check - ensure no existing data has non-zero priorities
SELECT 
  'EXISTING PRIORITY VALUES:' as check_type,
  COALESCE(ingest_priority, 0) as priority_value,
  COUNT(*) as item_count
FROM public.content_queue
WHERE COALESCE(ingest_priority, 0) != 0
GROUP BY 2;

-- If the above returns 0 rows, the column is ready for use