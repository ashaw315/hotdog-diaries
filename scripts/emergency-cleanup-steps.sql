-- EMERGENCY DUPLICATE CLEANUP - RUN THESE STEPS IN ORDER
-- Step by step version for Supabase SQL Editor

-- ============================================
-- STEP 1: IDENTIFY DUPLICATES (Run this first to see what will be removed)
-- ============================================
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
SELECT 
  'Will Remove' as action,
  id, 
  LEFT(content_text, 50) as text_preview,
  source_platform,
  is_posted,
  created_at
FROM ranked_content 
WHERE rn > 1
ORDER BY content_text, created_at
LIMIT 20;

-- ============================================
-- STEP 2: COUNT DUPLICATES
-- ============================================
WITH ranked_content AS (
  SELECT 
    id,
    content_text,
    content_image_url,
    source_platform,
    is_posted,
    created_at,
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
SELECT 
  COUNT(*) as total_duplicates_to_remove,
  COUNT(CASE WHEN is_posted = true THEN 1 END) as posted_duplicates,
  COUNT(CASE WHEN is_posted = false THEN 1 END) as unposted_duplicates
FROM ranked_content 
WHERE rn > 1;

-- ============================================
-- STEP 3: REMOVE DUPLICATES FROM posted_content
-- ============================================
DELETE FROM posted_content 
WHERE content_queue_id IN (
  WITH ranked_content AS (
    SELECT 
      id,
      content_text,
      content_image_url,
      source_platform,
      is_posted,
      created_at,
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
  SELECT id FROM ranked_content WHERE rn > 1
);

-- ============================================
-- STEP 4: REMOVE DUPLICATES FROM content_queue
-- ============================================
DELETE FROM content_queue 
WHERE id IN (
  WITH ranked_content AS (
    SELECT 
      id,
      content_text,
      content_image_url,
      source_platform,
      is_posted,
      created_at,
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
  SELECT id FROM ranked_content WHERE rn > 1
);

-- ============================================
-- STEP 5: REMOVE DUPLICATE POSTS (same content posted multiple times)
-- ============================================
WITH duplicate_posts AS (
  SELECT 
    content_queue_id,
    MIN(id) as keep_id,
    COUNT(*) as post_count,
    array_agg(id ORDER BY posted_at) as all_ids
  FROM posted_content
  GROUP BY content_queue_id
  HAVING COUNT(*) > 1
)
DELETE FROM posted_content
WHERE id IN (
  SELECT unnest(all_ids[2:]) -- Keep first, delete rest
  FROM duplicate_posts
);

-- ============================================
-- STEP 6: FIX is_posted FLAGS
-- ============================================
-- First set all to false
UPDATE content_queue SET is_posted = false;

-- Then set posted items to true
UPDATE content_queue 
SET is_posted = true 
WHERE id IN (SELECT DISTINCT content_queue_id FROM posted_content);

-- ============================================
-- STEP 7: UPDATE MISSING HASHES (using MD5)
-- ============================================
UPDATE content_queue
SET content_hash = MD5(
    CONCAT(
      COALESCE(LOWER(source_platform), ''),
      '|',
      COALESCE(LOWER(TRIM(content_text)), ''),
      '|', 
      COALESCE(content_image_url, ''),
      '|',
      COALESCE(content_video_url, ''),
      '|',
      COALESCE(original_url, '')
    )
)
WHERE content_hash IS NULL OR content_hash = '';

-- ============================================
-- STEP 8: FINAL VERIFICATION
-- ============================================
SELECT 
  'Content Queue Stats' as category,
  COUNT(*) as total_items,
  COUNT(DISTINCT content_hash) as unique_hashes,
  COUNT(DISTINCT content_text) as unique_texts,
  COUNT(DISTINCT content_image_url) as unique_images
FROM content_queue

UNION ALL

SELECT 
  'Posted Content Stats',
  COUNT(*),
  COUNT(DISTINCT content_queue_id),
  NULL,
  NULL
FROM posted_content

UNION ALL

SELECT 
  'Ready to Post',
  COUNT(*),
  NULL,
  NULL,
  NULL
FROM content_queue
WHERE is_approved = true AND is_posted = false;

-- ============================================
-- STEP 9: CHECK FOR REMAINING DUPLICATES
-- ============================================
WITH remaining_duplicates AS (
  SELECT 
    LEFT(content_text, 100) as text_preview,
    content_image_url,
    source_platform,
    COUNT(*) as duplicate_count,
    array_agg(id) as ids
  FROM content_queue
  GROUP BY LEFT(content_text, 100), content_image_url, source_platform
  HAVING COUNT(*) > 1
)
SELECT * FROM remaining_duplicates
ORDER BY duplicate_count DESC
LIMIT 10;