-- Migration: Update source platform enum to include new platforms
-- This migration replaces the old platform enum with the new sustainable platforms

-- First, update the enum to include new values
ALTER TYPE source_platform_enum ADD VALUE 'youtube';
ALTER TYPE source_platform_enum ADD VALUE 'flickr';
ALTER TYPE source_platform_enum ADD VALUE 'unsplash';
ALTER TYPE source_platform_enum ADD VALUE 'news';
ALTER TYPE source_platform_enum ADD VALUE 'mastodon';

-- Create a new enum with only the platforms we want to keep
CREATE TYPE source_platform_enum_new AS ENUM ('reddit', 'youtube', 'flickr', 'unsplash', 'news', 'mastodon');

-- Update existing tables to use the new enum (this requires careful handling)
-- Since we're changing enum values, we need to be careful about existing data
-- For safety, we'll keep the old enum and add the new values for now

-- Add indexes for the new platforms
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_youtube ON content_queue(source_platform) WHERE source_platform = 'youtube';
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_flickr ON content_queue(source_platform) WHERE source_platform = 'flickr';
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_unsplash ON content_queue(source_platform) WHERE source_platform = 'unsplash';
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_news ON content_queue(source_platform) WHERE source_platform = 'news';
CREATE INDEX IF NOT EXISTS idx_content_queue_source_platform_mastodon ON content_queue(source_platform) WHERE source_platform = 'mastodon';

-- Create platform-specific data columns for the new platforms

-- Add YouTube-specific data column
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS youtube_data JSONB;

-- Add Flickr-specific data column  
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS flickr_data JSONB;

-- Add Unsplash-specific data column
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS unsplash_data JSONB;

-- Add News-specific data column
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS news_data JSONB;

-- Add Mastodon-specific data column
ALTER TABLE content_queue 
ADD COLUMN IF NOT EXISTS mastodon_data JSONB;

-- Create indexes for the JSONB columns
CREATE INDEX IF NOT EXISTS idx_content_queue_youtube_data ON content_queue USING GIN (youtube_data) WHERE youtube_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_queue_flickr_data ON content_queue USING GIN (flickr_data) WHERE flickr_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_queue_unsplash_data ON content_queue USING GIN (unsplash_data) WHERE unsplash_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_queue_news_data ON content_queue USING GIN (news_data) WHERE news_data IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_content_queue_mastodon_data ON content_queue USING GIN (mastodon_data) WHERE mastodon_data IS NOT NULL;

-- Add comments for the new columns
COMMENT ON COLUMN content_queue.youtube_data IS 'YouTube-specific metadata (video_id, channel_id, views, etc.)';
COMMENT ON COLUMN content_queue.flickr_data IS 'Flickr-specific metadata (photo_id, owner, views, license, etc.)';
COMMENT ON COLUMN content_queue.unsplash_data IS 'Unsplash-specific metadata (photo_id, photographer, likes, etc.)';
COMMENT ON COLUMN content_queue.news_data IS 'News-specific metadata (article_id, source, publish_date, etc.)';
COMMENT ON COLUMN content_queue.mastodon_data IS 'Mastodon-specific metadata (toot_id, instance, boosts, etc.)';

-- Create platform scan configuration tables for the new platforms

-- YouTube scan configuration
CREATE TABLE IF NOT EXISTS youtube_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT false,
    scan_interval INTEGER DEFAULT 180, -- minutes
    max_videos_per_scan INTEGER DEFAULT 25,
    search_terms TEXT[] DEFAULT ARRAY['hotdog', 'hot dog', 'frankfurter'],
    published_after TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '7 days',
    video_duration VARCHAR(20) DEFAULT 'any', -- 'any', 'short', 'medium', 'long'
    video_definition VARCHAR(20) DEFAULT 'any', -- 'any', 'high', 'standard'
    safe_search VARCHAR(20) DEFAULT 'moderate', -- 'none', 'moderate', 'strict'
    channel_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Flickr scan configuration
CREATE TABLE IF NOT EXISTS flickr_scan_config (
    id SERIAL PRIMARY KEY,
    is_enabled BOOLEAN DEFAULT false,
    scan_interval INTEGER DEFAULT 180, -- minutes
    max_photos_per_scan INTEGER DEFAULT 15,
    search_terms TEXT[] DEFAULT ARRAY['hotdog', 'hot dog', 'sausage'],
    license VARCHAR(50) DEFAULT '1,2,3,4,5,6,9,10', -- Creative Commons licenses
    published_within INTEGER DEFAULT 30, -- days
    min_views INTEGER DEFAULT 100,
    content_type VARCHAR(20) DEFAULT 'photos', -- 'photos', 'screenshots', 'other'
    safe_search VARCHAR(20) DEFAULT 'safe', -- 'safe', 'moderate', 'restricted'
    last_scan_id VARCHAR(255),
    last_scan_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create scan results tables for tracking
CREATE TABLE IF NOT EXISTS youtube_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    videos_found INTEGER DEFAULT 0,
    videos_processed INTEGER DEFAULT 0,
    videos_approved INTEGER DEFAULT 0,
    videos_rejected INTEGER DEFAULT 0,
    videos_flagged INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    quota_used INTEGER DEFAULT 0,
    search_terms_used TEXT[] DEFAULT ARRAY[]::TEXT[],
    highest_views INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS flickr_scan_results (
    id SERIAL PRIMARY KEY,
    scan_id VARCHAR(255) NOT NULL,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    photos_found INTEGER DEFAULT 0,
    photos_processed INTEGER DEFAULT 0,
    photos_approved INTEGER DEFAULT 0,
    photos_rejected INTEGER DEFAULT 0,
    photos_flagged INTEGER DEFAULT 0,
    duplicates_found INTEGER DEFAULT 0,
    requests_used INTEGER DEFAULT 0,
    search_terms_used TEXT[] DEFAULT ARRAY[]::TEXT[],
    highest_views INTEGER DEFAULT 0,
    errors TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for scan results
CREATE INDEX IF NOT EXISTS idx_youtube_scan_results_scan_id ON youtube_scan_results (scan_id);
CREATE INDEX IF NOT EXISTS idx_youtube_scan_results_start_time ON youtube_scan_results (start_time);
CREATE INDEX IF NOT EXISTS idx_flickr_scan_results_scan_id ON flickr_scan_results (scan_id);
CREATE INDEX IF NOT EXISTS idx_flickr_scan_results_start_time ON flickr_scan_results (start_time);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_youtube_scan_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_youtube_scan_config_updated_at
    BEFORE UPDATE ON youtube_scan_config
    FOR EACH ROW
    EXECUTE FUNCTION update_youtube_scan_config_updated_at();

CREATE OR REPLACE FUNCTION update_flickr_scan_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_flickr_scan_config_updated_at
    BEFORE UPDATE ON flickr_scan_config
    FOR EACH ROW
    EXECUTE FUNCTION update_flickr_scan_config_updated_at();

-- Insert default configurations
INSERT INTO youtube_scan_config (is_enabled, search_terms) VALUES (false, ARRAY['hotdog', 'hot dog', 'frankfurter', 'bratwurst', 'ballpark frank'])
ON CONFLICT DO NOTHING;

INSERT INTO flickr_scan_config (is_enabled, search_terms) VALUES (false, ARRAY['hotdog', 'hot dog', 'sausage', 'frankfurter', 'grill'])
ON CONFLICT DO NOTHING;

-- Add comments
COMMENT ON TABLE youtube_scan_config IS 'Configuration for YouTube content scanning';
COMMENT ON TABLE flickr_scan_config IS 'Configuration for Flickr photo scanning';
COMMENT ON TABLE youtube_scan_results IS 'Results from YouTube scanning operations';
COMMENT ON TABLE flickr_scan_results IS 'Results from Flickr scanning operations';