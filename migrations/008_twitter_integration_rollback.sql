-- Rollback: Twitter Integration Tables
-- This rollback removes all Twitter-related tables and columns

-- Drop functions
DROP FUNCTION IF EXISTS cleanup_expired_twitter_cache();
DROP FUNCTION IF EXISTS get_twitter_scan_summary(INTEGER);

-- Drop views
DROP VIEW IF EXISTS twitter_content_analytics;
DROP VIEW IF EXISTS content_queue_with_twitter;

-- Drop constraints
ALTER TABLE content_queue DROP CONSTRAINT IF EXISTS check_twitter_data;

-- Drop triggers
DROP TRIGGER IF EXISTS update_twitter_scan_config_updated_at ON twitter_scan_config;
DROP TRIGGER IF EXISTS update_twitter_api_usage_updated_at ON twitter_api_usage;

-- Drop indexes
DROP INDEX IF EXISTS idx_content_queue_twitter_data;
DROP INDEX IF EXISTS idx_twitter_scan_results_scan_id;
DROP INDEX IF EXISTS idx_twitter_scan_results_start_time;
DROP INDEX IF EXISTS idx_twitter_api_usage_endpoint;
DROP INDEX IF EXISTS idx_twitter_api_usage_reset_time;
DROP INDEX IF EXISTS idx_twitter_content_cache_tweet_id;
DROP INDEX IF EXISTS idx_twitter_content_cache_author_username;
DROP INDEX IF EXISTS idx_twitter_content_cache_processing_status;
DROP INDEX IF EXISTS idx_twitter_content_cache_expires_at;

-- Drop tables
DROP TABLE IF EXISTS twitter_content_cache;
DROP TABLE IF EXISTS twitter_api_usage;
DROP TABLE IF EXISTS twitter_scan_results;
DROP TABLE IF EXISTS twitter_scan_config;

-- Remove twitter_data column from content_queue
ALTER TABLE content_queue DROP COLUMN IF EXISTS twitter_data;