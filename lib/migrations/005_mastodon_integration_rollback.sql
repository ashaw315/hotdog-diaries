-- Rollback Migration 005: Mastodon Integration Tables
-- Removes all Mastodon-related database objects

-- Drop views
DROP VIEW IF EXISTS mastodon_scan_stats;
DROP VIEW IF EXISTS current_mastodon_config;

-- Drop triggers
DROP TRIGGER IF EXISTS trigger_update_mastodon_config_updated_at ON mastodon_scan_config;

-- Drop functions
DROP FUNCTION IF EXISTS update_mastodon_config_updated_at();

-- Drop indexes
DROP INDEX IF EXISTS idx_mastodon_scan_results_errors;
DROP INDEX IF EXISTS idx_mastodon_scan_results_instances_scanned;
DROP INDEX IF EXISTS idx_mastodon_scan_config_enabled_instances;
DROP INDEX IF EXISTS idx_mastodon_scan_config_instances;
DROP INDEX IF EXISTS idx_mastodon_scan_config_updated_at;
DROP INDEX IF EXISTS idx_mastodon_scan_results_scan_id;
DROP INDEX IF EXISTS idx_mastodon_scan_results_timestamp;

-- Drop tables
DROP TABLE IF EXISTS mastodon_scan_results;
DROP TABLE IF EXISTS mastodon_scan_config;