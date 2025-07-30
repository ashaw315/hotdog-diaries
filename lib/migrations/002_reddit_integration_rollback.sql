-- Reddit Integration Rollback
-- Migration 002 Rollback: Remove Reddit-specific tables and configuration

-- Drop triggers first
DROP TRIGGER IF EXISTS update_reddit_scan_config_updated_at ON reddit_scan_config;
DROP TRIGGER IF EXISTS update_content_analysis_updated_at ON content_analysis;
DROP TRIGGER IF EXISTS update_processing_queue_updated_at ON processing_queue;

-- Drop indexes
DROP INDEX IF EXISTS idx_reddit_scan_config_enabled;
DROP INDEX IF EXISTS idx_reddit_scan_config_last_scan;

DROP INDEX IF EXISTS idx_reddit_scan_results_scan_id;
DROP INDEX IF EXISTS idx_reddit_scan_results_start_time;
DROP INDEX IF EXISTS idx_reddit_scan_results_end_time;
DROP INDEX IF EXISTS idx_reddit_scan_results_posts_approved;
DROP INDEX IF EXISTS idx_reddit_scan_results_created_at;

DROP INDEX IF EXISTS idx_content_analysis_queue_id;
DROP INDEX IF EXISTS idx_content_analysis_is_spam;
DROP INDEX IF EXISTS idx_content_analysis_is_inappropriate;
DROP INDEX IF EXISTS idx_content_analysis_is_valid_hotdog;
DROP INDEX IF EXISTS idx_content_analysis_confidence_score;
DROP INDEX IF EXISTS idx_content_analysis_similarity_hash;
DROP INDEX IF EXISTS idx_content_analysis_duplicate_of;
DROP INDEX IF EXISTS idx_content_analysis_is_flagged;

DROP INDEX IF EXISTS idx_processing_queue_content_id;
DROP INDEX IF EXISTS idx_processing_queue_status;
DROP INDEX IF EXISTS idx_processing_queue_priority;
DROP INDEX IF EXISTS idx_processing_queue_attempts;
DROP INDEX IF EXISTS idx_processing_queue_created_at;

-- Drop tables (in reverse dependency order)
DROP TABLE IF EXISTS processing_queue;
DROP TABLE IF EXISTS content_analysis;
DROP TABLE IF EXISTS reddit_scan_results;
DROP TABLE IF EXISTS reddit_scan_config;