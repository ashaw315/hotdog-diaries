-- Rollback migration: Remove Bluesky and restore Flickr
-- This rollback removes Bluesky-specific changes

-- Drop the video content statistics view
DROP VIEW IF EXISTS video_content_stats;

-- Drop indexes for video-related queries
DROP INDEX IF EXISTS idx_content_queue_video_content;
DROP INDEX IF EXISTS idx_content_queue_has_video;
DROP INDEX IF EXISTS idx_content_queue_video_duration;

-- Remove content type check constraint
ALTER TABLE content_queue 
DROP CONSTRAINT IF EXISTS content_queue_content_type_check;

-- Drop Bluesky tables and triggers
DROP TRIGGER IF EXISTS trigger_bluesky_scan_config_updated_at ON bluesky_scan_config;
DROP FUNCTION IF EXISTS update_bluesky_scan_config_updated_at();
DROP TABLE IF EXISTS bluesky_scan_results CASCADE;
DROP TABLE IF EXISTS bluesky_scan_config CASCADE;

-- Remove video-related columns
ALTER TABLE content_queue DROP COLUMN IF EXISTS content_video_format;
ALTER TABLE content_queue DROP COLUMN IF EXISTS content_video_duration;
ALTER TABLE content_queue DROP COLUMN IF EXISTS content_video_thumbnail_url;

-- Drop Bluesky and Pixabay indexes and columns
DROP INDEX IF EXISTS idx_content_queue_bluesky_data;
DROP INDEX IF EXISTS idx_content_queue_pixabay_data;
DROP INDEX IF EXISTS idx_content_queue_source_platform_bluesky;
DROP INDEX IF EXISTS idx_content_queue_source_platform_pixabay;

ALTER TABLE content_queue DROP COLUMN IF EXISTS bluesky_data;
ALTER TABLE content_queue DROP COLUMN IF EXISTS pixabay_data;

-- Note: Cannot remove enum values in PostgreSQL without recreating the enum
-- This would require more complex operations that might affect existing data
-- Instead, we'll leave the enum values but they won't be used

-- Restore Flickr-related structures (if needed)
-- Note: This would require recreating the Flickr tables from the previous migration
-- For safety, we'll leave this as a comment since data restoration is complex

/*
-- To fully restore Flickr support, you would need to:
-- 1. Recreate flickr_scan_config table
-- 2. Recreate flickr_scan_results table  
-- 3. Add back flickr_data column
-- 4. Recreate indexes
-- This should be done carefully to avoid data loss
*/