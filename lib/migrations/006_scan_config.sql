-- Scan Configuration Migration
-- Migration 006: Create scan_config table for automated content scanning

-- Create scan_config table
CREATE TABLE IF NOT EXISTS scan_config (
    id SERIAL PRIMARY KEY,
    enabled_platforms TEXT[] NOT NULL DEFAULT ARRAY['reddit', 'mastodon', 'flickr', 'youtube', 'unsplash'],
    scan_frequency_hours INTEGER NOT NULL DEFAULT 4,
    max_posts_per_scan INTEGER NOT NULL DEFAULT 50,
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    last_scan_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_scan_config_enabled ON scan_config(is_enabled);
CREATE INDEX IF NOT EXISTS idx_scan_config_last_scan ON scan_config(last_scan_at);

-- Create update trigger
CREATE TRIGGER update_scan_config_updated_at
    BEFORE UPDATE ON scan_config
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default configuration
INSERT INTO scan_config (enabled_platforms, scan_frequency_hours, max_posts_per_scan, is_enabled, created_at, updated_at)
VALUES (
    ARRAY['reddit', 'mastodon', 'flickr', 'youtube', 'unsplash'], 
    4, 
    50, 
    true, 
    NOW(), 
    NOW()
) ON CONFLICT DO NOTHING;