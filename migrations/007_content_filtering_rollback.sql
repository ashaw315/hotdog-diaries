-- Rollback: Remove content filtering and analysis tables
-- This rollback removes all filtering-related tables and objects

-- Drop views
DROP VIEW IF EXISTS duplicate_content;
DROP VIEW IF EXISTS flagged_content;
DROP VIEW IF EXISTS content_with_analysis;

-- Drop triggers and functions
DROP TRIGGER IF EXISTS trigger_filtering_stats_updated_at ON filtering_stats;
DROP TRIGGER IF EXISTS trigger_content_analysis_updated_at ON content_analysis;
DROP TRIGGER IF EXISTS trigger_filter_patterns_updated_at ON filter_patterns;

DROP FUNCTION IF EXISTS update_filtering_stats_updated_at();
DROP FUNCTION IF EXISTS update_content_analysis_updated_at();
DROP FUNCTION IF EXISTS update_filter_patterns_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_content_reviews_reviewed_at;
DROP INDEX IF EXISTS idx_content_reviews_reviewed_by;
DROP INDEX IF EXISTS idx_content_reviews_action;
DROP INDEX IF EXISTS idx_content_reviews_content_id;
DROP INDEX IF EXISTS idx_filtering_stats_date;
DROP INDEX IF EXISTS idx_content_analysis_filter_results;
DROP INDEX IF EXISTS idx_content_analysis_processing_notes;
DROP INDEX IF EXISTS idx_content_analysis_flagged_patterns;
DROP INDEX IF EXISTS idx_content_analysis_created_at;
DROP INDEX IF EXISTS idx_content_analysis_duplicate;
DROP INDEX IF EXISTS idx_content_analysis_similarity;
DROP INDEX IF EXISTS idx_content_analysis_flagged;
DROP INDEX IF EXISTS idx_content_analysis_valid_hotdog;
DROP INDEX IF EXISTS idx_content_analysis_unrelated;
DROP INDEX IF EXISTS idx_content_analysis_inappropriate;
DROP INDEX IF EXISTS idx_content_analysis_spam;
DROP INDEX IF EXISTS idx_content_analysis_content_id;
DROP INDEX IF EXISTS idx_filter_patterns_enabled;
DROP INDEX IF EXISTS idx_filter_patterns_type;

-- Drop tables
DROP TABLE IF EXISTS content_reviews;
DROP TABLE IF EXISTS filtering_stats;
DROP TABLE IF EXISTS content_analysis;
DROP TABLE IF EXISTS filter_patterns;

-- Drop enums
DROP TYPE IF EXISTS filter_pattern_type;