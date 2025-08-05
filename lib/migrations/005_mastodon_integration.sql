-- Migration 005: Mastodon Integration Tables
-- Creates configuration and results tables for Mastodon scanning

-- Create mastodon_scan_config table
CREATE TABLE IF NOT EXISTS mastodon_scan_config (
    id SERIAL PRIMARY KEY,
    instances JSONB NOT NULL DEFAULT '[]'::jsonb,
    search_terms JSONB NOT NULL DEFAULT '["hotdog", "hot dog", "frankfurter"]'::jsonb,
    hashtags_to_track JSONB NOT NULL DEFAULT '["hotdog", "hotdogs", "food"]'::jsonb,
    enabled_instances JSONB NOT NULL DEFAULT '[]'::jsonb,
    scan_interval_minutes INTEGER NOT NULL DEFAULT 30,
    max_posts_per_scan INTEGER NOT NULL DEFAULT 50,
    min_engagement_threshold INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create mastodon_scan_results table
CREATE TABLE IF NOT EXISTS mastodon_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL UNIQUE,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    posts_found INTEGER NOT NULL DEFAULT 0,
    posts_processed INTEGER NOT NULL DEFAULT 0,
    posts_added INTEGER NOT NULL DEFAULT 0,
    instances_scanned JSONB NOT NULL DEFAULT '[]'::jsonb,
    errors JSONB NOT NULL DEFAULT '[]'::jsonb,
    scan_duration_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_results_timestamp ON mastodon_scan_results(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_results_scan_id ON mastodon_scan_results(scan_id);
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_config_updated_at ON mastodon_scan_config(updated_at DESC);

-- Create GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_config_instances ON mastodon_scan_config USING GIN(instances);
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_config_enabled_instances ON mastodon_scan_config USING GIN(enabled_instances);
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_results_instances_scanned ON mastodon_scan_results USING GIN(instances_scanned);
CREATE INDEX IF NOT EXISTS idx_mastodon_scan_results_errors ON mastodon_scan_results USING GIN(errors);

-- Insert default configuration
INSERT INTO mastodon_scan_config (
    instances,
    search_terms,
    hashtags_to_track,
    enabled_instances,
    scan_interval_minutes,
    max_posts_per_scan,
    min_engagement_threshold
) VALUES (
    '[
        {
            "domain": "mastodon.social",
            "name": "Mastodon Social",
            "isActive": true,
            "rateLimitPerMinute": 60,
            "errorCount": 0,
            "successCount": 0
        },
        {
            "domain": "mas.to",
            "name": "Mas.to",
            "isActive": true,
            "rateLimitPerMinute": 60,
            "errorCount": 0,
            "successCount": 0
        },
        {
            "domain": "foodie.fm",
            "name": "Foodie FM",
            "isActive": true,
            "rateLimitPerMinute": 30,
            "errorCount": 0,
            "successCount": 0
        }
    ]'::jsonb,
    '["hotdog", "hot dog", "frankfurter", "wiener", "sausage sandwich"]'::jsonb,
    '["hotdog", "hotdogs", "frankfurter", "streetfood", "food", "cooking", "foodie"]'::jsonb,
    '["mastodon.social", "mas.to"]'::jsonb,
    30,
    50,
    1
) ON CONFLICT DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_mastodon_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
DROP TRIGGER IF EXISTS trigger_update_mastodon_config_updated_at ON mastodon_scan_config;
CREATE TRIGGER trigger_update_mastodon_config_updated_at
    BEFORE UPDATE ON mastodon_scan_config
    FOR EACH ROW
    EXECUTE FUNCTION update_mastodon_config_updated_at();

-- Add constraint to ensure at least one search term
ALTER TABLE mastodon_scan_config 
ADD CONSTRAINT check_search_terms_not_empty 
CHECK (jsonb_array_length(search_terms) > 0);

-- Add constraint to ensure scan interval is reasonable
ALTER TABLE mastodon_scan_config 
ADD CONSTRAINT check_scan_interval_range 
CHECK (scan_interval_minutes >= 5 AND scan_interval_minutes <= 1440); -- 5 minutes to 24 hours

-- Add constraint to ensure max posts is reasonable
ALTER TABLE mastodon_scan_config 
ADD CONSTRAINT check_max_posts_range 
CHECK (max_posts_per_scan >= 1 AND max_posts_per_scan <= 200);

-- Add constraint to ensure engagement threshold is non-negative
ALTER TABLE mastodon_scan_config 
ADD CONSTRAINT check_engagement_threshold_non_negative 
CHECK (min_engagement_threshold >= 0);

-- Create view for easy access to current configuration
CREATE OR REPLACE VIEW current_mastodon_config AS
SELECT 
    instances,
    search_terms,
    hashtags_to_track,
    enabled_instances,
    scan_interval_minutes,
    max_posts_per_scan,
    min_engagement_threshold,
    updated_at
FROM mastodon_scan_config 
ORDER BY updated_at DESC 
LIMIT 1;

-- Create view for scan statistics
CREATE OR REPLACE VIEW mastodon_scan_stats AS
SELECT 
    COUNT(*) as total_scans,
    SUM(posts_found) as total_posts_found,
    SUM(posts_processed) as total_posts_processed,
    SUM(posts_added) as total_posts_added,
    AVG(scan_duration_ms) as avg_scan_duration_ms,
    MAX(timestamp) as last_scan_time,
    COUNT(CASE WHEN posts_processed > 0 THEN 1 END)::float / NULLIF(COUNT(*), 0) as success_rate
FROM mastodon_scan_results;

-- Grant permissions (adjust as needed for your application user)
-- GRANT SELECT, INSERT, UPDATE ON mastodon_scan_config TO your_app_user;
-- GRANT SELECT, INSERT ON mastodon_scan_results TO your_app_user;
-- GRANT SELECT ON current_mastodon_config TO your_app_user;
-- GRANT SELECT ON mastodon_scan_stats TO your_app_user;