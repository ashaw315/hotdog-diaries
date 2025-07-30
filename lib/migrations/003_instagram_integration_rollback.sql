-- Instagram Integration Rollback
-- Migration 003 Rollback: Remove Instagram-specific tables and configuration

-- Drop triggers first
DROP TRIGGER IF EXISTS update_instagram_scan_config_updated_at ON instagram_scan_config;
DROP TRIGGER IF EXISTS update_instagram_auth_updated_at ON instagram_auth;

-- Drop indexes
DROP INDEX IF EXISTS idx_instagram_scan_config_enabled;
DROP INDEX IF EXISTS idx_instagram_scan_config_last_scan;

DROP INDEX IF EXISTS idx_instagram_scan_results_scan_id;
DROP INDEX IF EXISTS idx_instagram_scan_results_start_time;
DROP INDEX IF EXISTS idx_instagram_scan_results_end_time;
DROP INDEX IF EXISTS idx_instagram_scan_results_posts_approved;
DROP INDEX IF EXISTS idx_instagram_scan_results_created_at;

DROP INDEX IF EXISTS idx_instagram_auth_user_id;
DROP INDEX IF EXISTS idx_instagram_auth_is_active;
DROP INDEX IF EXISTS idx_instagram_auth_expires_at;

DROP INDEX IF EXISTS idx_content_queue_instagram_data;

-- Remove Instagram data column from content_queue
ALTER TABLE content_queue DROP COLUMN IF EXISTS instagram_data;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS instagram_auth;
DROP TABLE IF EXISTS instagram_scan_results;
DROP TABLE IF EXISTS instagram_scan_config;