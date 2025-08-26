-- Add unique constraints to prevent duplicate content
-- Run this in your Supabase SQL editor

-- Step 1: Add unique constraint on content_hash
-- This prevents exact duplicate content
ALTER TABLE content_queue 
ADD CONSTRAINT unique_content_hash UNIQUE (content_hash);

-- Step 2: Add composite unique constraint for content similarity
-- This prevents same text/image combination from same platform
ALTER TABLE content_queue 
ADD CONSTRAINT unique_content_per_platform 
UNIQUE NULLS NOT DISTINCT (source_platform, content_text, content_image_url);

-- Step 3: Add unique constraint on posted_content to prevent double posting
ALTER TABLE posted_content 
ADD CONSTRAINT unique_post_per_content 
UNIQUE (content_queue_id);

-- Step 4: Create indexes for better duplicate detection performance
CREATE INDEX IF NOT EXISTS idx_content_similarity 
ON content_queue(
  source_platform, 
  LEFT(content_text, 100),
  content_image_url
);

-- Index for hash lookups
CREATE INDEX IF NOT EXISTS idx_content_hash 
ON content_queue(content_hash);

-- Index for image URL lookups
CREATE INDEX IF NOT EXISTS idx_content_image_url 
ON content_queue(content_image_url) 
WHERE content_image_url IS NOT NULL;

-- Index for video URL lookups
CREATE INDEX IF NOT EXISTS idx_content_video_url 
ON content_queue(content_video_url) 
WHERE content_video_url IS NOT NULL;

-- Index for original URL lookups
CREATE INDEX IF NOT EXISTS idx_original_url 
ON content_queue(original_url) 
WHERE original_url IS NOT NULL;

-- Index for efficient posting queries
CREATE INDEX IF NOT EXISTS idx_content_queue_posting 
ON content_queue(is_posted, is_approved, confidence_score DESC)
WHERE is_approved = true;

-- Step 5: Create function to check for duplicates before insert
CREATE OR REPLACE FUNCTION check_duplicate_content()
RETURNS TRIGGER AS $$
BEGIN
  -- Check for exact hash match
  IF EXISTS (
    SELECT 1 FROM content_queue 
    WHERE content_hash = NEW.content_hash 
    AND id != COALESCE(NEW.id, -1)
  ) THEN
    RAISE EXCEPTION 'Duplicate content detected: hash match';
  END IF;
  
  -- Check for same image URL
  IF NEW.content_image_url IS NOT NULL AND EXISTS (
    SELECT 1 FROM content_queue 
    WHERE content_image_url = NEW.content_image_url 
    AND id != COALESCE(NEW.id, -1)
  ) THEN
    RAISE EXCEPTION 'Duplicate content detected: same image URL';
  END IF;
  
  -- Check for same video URL
  IF NEW.content_video_url IS NOT NULL AND EXISTS (
    SELECT 1 FROM content_queue 
    WHERE content_video_url = NEW.content_video_url 
    AND id != COALESCE(NEW.id, -1)
  ) THEN
    RAISE EXCEPTION 'Duplicate content detected: same video URL';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for duplicate checking
DROP TRIGGER IF EXISTS check_duplicate_before_insert ON content_queue;
CREATE TRIGGER check_duplicate_before_insert
  BEFORE INSERT ON content_queue
  FOR EACH ROW
  EXECUTE FUNCTION check_duplicate_content();

-- Step 6: Create function to sync is_posted flags
CREATE OR REPLACE FUNCTION sync_posted_flags()
RETURNS void AS $$
BEGIN
  -- Set is_posted = true for all content in posted_content
  UPDATE content_queue 
  SET is_posted = true 
  WHERE id IN (SELECT content_queue_id FROM posted_content);
  
  -- Set is_posted = false for all content NOT in posted_content
  UPDATE content_queue 
  SET is_posted = false 
  WHERE id NOT IN (SELECT content_queue_id FROM posted_content);
END;
$$ LANGUAGE plpgsql;

-- Step 7: Function to find and remove duplicates (for cleanup)
CREATE OR REPLACE FUNCTION remove_duplicate_content()
RETURNS TABLE(removed_count integer, details jsonb) AS $$
DECLARE
  removed_count integer := 0;
  duplicate_ids integer[];
BEGIN
  -- Find duplicates keeping the oldest
  WITH duplicates AS (
    SELECT id,
           content_hash,
           ROW_NUMBER() OVER (
             PARTITION BY content_hash 
             ORDER BY created_at ASC, id ASC
           ) as rn
    FROM content_queue
  )
  SELECT array_agg(id) INTO duplicate_ids
  FROM duplicates
  WHERE rn > 1;
  
  -- Delete duplicates from posted_content first
  IF duplicate_ids IS NOT NULL THEN
    DELETE FROM posted_content 
    WHERE content_queue_id = ANY(duplicate_ids);
    
    -- Then delete from content_queue
    DELETE FROM content_queue 
    WHERE id = ANY(duplicate_ids);
    
    removed_count := array_length(duplicate_ids, 1);
  END IF;
  
  RETURN QUERY SELECT 
    removed_count,
    jsonb_build_object(
      'duplicate_ids', duplicate_ids,
      'timestamp', now()
    );
END;
$$ LANGUAGE plpgsql;

-- Add comment to tables for documentation
COMMENT ON CONSTRAINT unique_content_hash ON content_queue IS 
'Ensures each piece of content has a unique hash to prevent exact duplicates';

COMMENT ON CONSTRAINT unique_content_per_platform ON content_queue IS 
'Prevents the same text/image combination from the same platform';

COMMENT ON CONSTRAINT unique_post_per_content ON posted_content IS 
'Ensures each content item can only be posted once';