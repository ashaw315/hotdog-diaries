-- Rollback Migration: Remove new platform support
-- This migration removes the new platform enum values and tables

-- Drop scan result tables
DROP TABLE IF EXISTS flickr_scan_results CASCADE;
DROP TABLE IF EXISTS youtube_scan_results CASCADE;

-- Drop scan configuration tables
DROP TABLE IF EXISTS flickr_scan_config CASCADE;
DROP TABLE IF EXISTS youtube_scan_config CASCADE;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_flickr_scan_config_updated_at ON flickr_scan_config;
DROP TRIGGER IF EXISTS trigger_youtube_scan_config_updated_at ON youtube_scan_config;
DROP FUNCTION IF EXISTS update_flickr_scan_config_updated_at();
DROP FUNCTION IF EXISTS update_youtube_scan_config_updated_at();

-- Drop indexes for platform-specific data
DROP INDEX IF EXISTS idx_content_queue_mastodon_data;
DROP INDEX IF EXISTS idx_content_queue_news_data;
DROP INDEX IF EXISTS idx_content_queue_unsplash_data;
DROP INDEX IF EXISTS idx_content_queue_flickr_data;
DROP INDEX IF EXISTS idx_content_queue_youtube_data;

-- Drop platform indexes
DROP INDEX IF EXISTS idx_content_queue_source_platform_mastodon;
DROP INDEX IF EXISTS idx_content_queue_source_platform_news;
DROP INDEX IF EXISTS idx_content_queue_source_platform_unsplash;
DROP INDEX IF EXISTS idx_content_queue_source_platform_flickr;
DROP INDEX IF EXISTS idx_content_queue_source_platform_youtube;

-- Remove platform-specific data columns
ALTER TABLE content_queue DROP COLUMN IF EXISTS mastodon_data;
ALTER TABLE content_queue DROP COLUMN IF EXISTS news_data;
ALTER TABLE content_queue DROP COLUMN IF EXISTS unsplash_data;
ALTER TABLE content_queue DROP COLUMN IF EXISTS flickr_data;
ALTER TABLE content_queue DROP COLUMN IF EXISTS youtube_data;

-- Note: We cannot easily remove enum values from PostgreSQL enums
-- The new enum values will remain but won't be used
-- This is a PostgreSQL limitation - enums can only have values added, not removed

-- Drop the new enum type we created
DROP TYPE IF EXISTS source_platform_enum_new;