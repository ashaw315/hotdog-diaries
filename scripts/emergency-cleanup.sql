-- EMERGENCY DUPLICATE CLEANUP SCRIPT
-- Run this immediately in Supabase SQL Editor to remove duplicates

-- Step 1: Create temporary tables to track what we're doing
CREATE TEMP TABLE IF NOT EXISTS duplicates_to_remove AS
WITH ranked_content AS (
  SELECT 
    id,
    content_text,
    content_image_url,
    source_platform,
    is_posted,
    created_at,
    -- Prioritize keeping: posted items first, then oldest
    ROW_NUMBER() OVER (
      PARTITION BY 
        LOWER(TRIM(content_text)),
        content_image_url,
        source_platform
      ORDER BY 
        is_posted DESC,
        created_at ASC,
        id ASC
    ) as rn
  FROM content_queue
)
SELECT id, content_text, source_platform, is_posted
FROM ranked_content 
WHERE rn > 1;

-- Show what we're about to remove
SELECT 
  COUNT(*) as duplicates_found,
  COUNT(DISTINCT content_text) as unique_content_groups
FROM duplicates_to_remove;

-- Show sample of duplicates
SELECT * FROM duplicates_to_remove LIMIT 10;

-- Step 2: Remove from posted_content first (foreign key constraint)
DELETE FROM posted_content 
WHERE content_queue_id IN (SELECT id FROM duplicates_to_remove);

-- Step 3: Remove duplicates from content_queue
DELETE FROM content_queue 
WHERE id IN (SELECT id FROM duplicates_to_remove);

-- Step 4: Clean up posted_content duplicates (same content posted multiple times)
WITH duplicate_posts AS (
  SELECT 
    content_queue_id,
    MIN(id) as keep_id
  FROM posted_content
  GROUP BY content_queue_id
  HAVING COUNT(*) > 1
)
DELETE FROM posted_content
WHERE content_queue_id IN (SELECT content_queue_id FROM duplicate_posts)
  AND id NOT IN (SELECT keep_id FROM duplicate_posts);

-- Step 5: Fix is_posted flags
UPDATE content_queue 
SET is_posted = true 
WHERE id IN (SELECT DISTINCT content_queue_id FROM posted_content);

UPDATE content_queue 
SET is_posted = false 
WHERE id NOT IN (SELECT DISTINCT content_queue_id FROM posted_content);

-- Step 6: Add missing content_hash values
-- Using MD5 since SHA256 may not be available
UPDATE content_queue
SET content_hash = MD5(
    COALESCE(LOWER(source_platform), '') || '|' ||
    COALESCE(LOWER(TRIM(content_text)), '') || '|' ||
    COALESCE(content_image_url, '') || '|' ||
    COALESCE(content_video_url, '') || '|' ||
    COALESCE(original_url, '')
)
WHERE content_hash IS NULL OR content_hash = '';

-- Step 7: Final verification
SELECT 
  'Final Statistics' as report,
  (SELECT COUNT(*) FROM content_queue) as total_content,
  (SELECT COUNT(DISTINCT content_hash) FROM content_queue) as unique_hashes,
  (SELECT COUNT(*) FROM posted_content) as total_posts,
  (SELECT COUNT(DISTINCT content_queue_id) FROM posted_content) as unique_posts,
  (SELECT COUNT(*) FROM content_queue WHERE is_posted = true) as flagged_as_posted,
  (SELECT COUNT(*) FROM content_queue WHERE is_approved = true AND is_posted = false) as ready_to_post;

-- Step 8: Show any remaining duplicates
WITH remaining_duplicates AS (
  SELECT 
    content_text,
    content_image_url,
    COUNT(*) as duplicate_count
  FROM content_queue
  GROUP BY content_text, content_image_url
  HAVING COUNT(*) > 1
)
SELECT * FROM remaining_duplicates LIMIT 5;